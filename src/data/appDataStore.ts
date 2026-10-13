import { AppData } from "../types";
import { SqlDriver, SqlExecutor } from "./driver";
import { AppDataLoadError } from "./errors";
import { emptyAppData, normalizeAppData, parseLegacyAppData } from "./normalize";
import {
  AppDataSnapshot,
  diffAppData,
  emptySnapshot,
  isEmptyDiff,
  snapshotAppData,
  SnapshotProblem
} from "./rows";
import {
  COLLECTION_KEYS,
  COLLECTION_TABLES,
  CREATE_META_TABLE_SQL,
  LATEST_SCHEMA_VERSION,
  META_MIGRATED_FROM_ASYNC_STORAGE_AT,
  META_SCHEMA_VERSION,
  SCHEMA_MIGRATIONS,
  sql
} from "./schema";

// Read-only access to the pre-SQLite AsyncStorage JSON blob. The store never
// writes or removes it: it stays on the device as a backup.
export type LegacyBlobSource = { read: () => Promise<string | null> };

export type AppDataStoreOptions = {
  openDriver: () => Promise<SqlDriver>;
  legacyBlob: LegacyBlobSource;
  now?: () => string;
  warn?: (message: string, details?: unknown) => void;
};

export type AppDataStore = {
  load: () => Promise<AppData>;
  save: (data: AppData) => Promise<void>;
};

type StoredRow = { id: string; project_id: string | null; position: number; data: string };

function describeProblems(problems: SnapshotProblem[]): string {
  return problems
    .slice(0, 5)
    .map((problem) => `${problem.collection}:${problem.reason}:${String(problem.id)}`)
    .join(", ");
}

async function readMeta(db: SqlExecutor, key: string): Promise<string | null> {
  const rows = await db.getAllAsync<{ value: string }>(sql.selectMeta, [key]);
  return rows[0]?.value ?? null;
}

async function applySchemaMigrations(driver: SqlDriver): Promise<void> {
  await driver.execAsync(CREATE_META_TABLE_SQL);
  const stored = await readMeta(driver, META_SCHEMA_VERSION);
  const current = stored === null ? 0 : Number(stored);
  if (!Number.isInteger(current) || current < 0) {
    throw new AppDataLoadError(`Saved data has an unknown schema version (${stored}).`);
  }
  if (current > LATEST_SCHEMA_VERSION) {
    throw new AppDataLoadError(`Saved data was written by a newer version of the app (schema ${current}).`);
  }
  const pending = SCHEMA_MIGRATIONS.filter((migration) => migration.version > current).sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    await driver.transactionAsync(async (tx) => {
      await migration.up(tx);
      await tx.runAsync(sql.upsertMeta, [META_SCHEMA_VERSION, String(migration.version)]);
    });
  }
}

// One-time copy of the AsyncStorage blob into SQLite. Everything happens in a
// single transaction that also sets the migrated flag, so a crash or failure
// leaves the database exactly as it was before and the next launch retries.
async function migrateFromAsyncStorage(driver: SqlDriver, legacyBlob: LegacyBlobSource, now: string): Promise<void> {
  let raw: string | null;
  try {
    raw = await legacyBlob.read();
  } catch (error) {
    // Android CursorWindow overflow can make an oversized row unreadable.
    throw new AppDataLoadError("Saved data could not be read.", error);
  }

  let data: AppData;
  try {
    data = raw ? parseLegacyAppData(raw) : emptyAppData();
  } catch (error) {
    throw new AppDataLoadError("Saved data could not be parsed.", error);
  }

  const { snapshot, problems } = snapshotAppData(data);
  if (problems.length > 0) {
    // Two records with one id cannot both live under a primary key. Refuse
    // rather than quietly keeping only one of them.
    throw new AppDataLoadError(`Saved data has records that cannot be moved safely (${describeProblems(problems)}).`);
  }

  try {
    await driver.transactionAsync(async (tx) => {
      for (const key of COLLECTION_KEYS) {
        const table = COLLECTION_TABLES[key];
        // Without the flag nothing in these tables was ever committed by a
        // finished migration or a save, so the blob is the source of truth.
        await tx.runAsync(sql.deleteAllRows(table));
        for (const [id, row] of snapshot[key]) {
          await tx.runAsync(sql.insertRow(table), [id, row.projectId, row.position, row.json, now]);
        }
      }
      for (const key of COLLECTION_KEYS) {
        const table = COLLECTION_TABLES[key];
        const [result] = await tx.getAllAsync<{ count: number }>(sql.countRows(table));
        const count = Number(result?.count);
        if (count !== data[key].length) {
          throw new Error(`Row count mismatch in ${table}: expected ${data[key].length}, found ${count}.`);
        }
      }
      await tx.runAsync(sql.upsertMeta, [META_MIGRATED_FROM_ASYNC_STORAGE_AT, now]);
    });
  } catch (error) {
    throw new AppDataLoadError("Saved data could not be moved to the new storage.", error);
  }
}

async function readAllRows(driver: SqlDriver): Promise<{ data: AppData; stored: AppDataSnapshot }> {
  const raw = emptyAppData() as Record<keyof AppData, unknown[]>;
  const stored = emptySnapshot();
  for (const key of COLLECTION_KEYS) {
    const table = COLLECTION_TABLES[key];
    const rows = await driver.getAllAsync<StoredRow>(sql.selectRows(table));
    for (const row of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.data);
      } catch (error) {
        throw new AppDataLoadError(`Saved ${table} record ${row.id} could not be parsed.`, error);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as { id?: unknown }).id !== row.id) {
        throw new AppDataLoadError(`Saved ${table} record ${row.id} is not valid.`);
      }
      raw[key].push(parsed);
      stored[key].set(row.id, { projectId: row.project_id ?? null, position: Number(row.position), json: row.data });
    }
  }
  let data: AppData;
  try {
    data = normalizeAppData(raw as unknown as AppData);
  } catch (error) {
    throw new AppDataLoadError("Saved data could not be parsed.", error);
  }
  return { data, stored };
}

export function createAppDataStore(options: AppDataStoreOptions): AppDataStore {
  const now = options.now ?? (() => new Date().toISOString());
  const warn = options.warn ?? ((message: string, details?: unknown) => console.warn(message, details));

  let driverPromise: Promise<SqlDriver> | null = null;
  // What the database holds as of the last successful load or save. Null until
  // a load succeeds; saving is refused before that so an empty in-memory state
  // can never be written over the user's data.
  let snapshot: AppDataSnapshot | null = null;

  // Every database operation runs through this queue, so writes never
  // interleave and always land in call order.
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  }

  function getDriver(): Promise<SqlDriver> {
    if (!driverPromise) {
      driverPromise = options.openDriver().catch((error) => {
        driverPromise = null;
        throw error;
      });
    }
    return driverPromise;
  }

  async function load(): Promise<AppData> {
    snapshot = null;
    let driver: SqlDriver;
    try {
      driver = await getDriver();
    } catch (error) {
      throw new AppDataLoadError("Saved data could not be opened.", error);
    }

    try {
      await applySchemaMigrations(driver);
      if (!(await readMeta(driver, META_MIGRATED_FROM_ASYNC_STORAGE_AT))) {
        await migrateFromAsyncStorage(driver, options.legacyBlob, now());
      }
    } catch (error) {
      throw error instanceof AppDataLoadError ? error : new AppDataLoadError("Saved data could not be prepared.", error);
    }

    let result: { data: AppData; stored: AppDataSnapshot };
    try {
      result = await readAllRows(driver);
    } catch (error) {
      throw error instanceof AppDataLoadError ? error : new AppDataLoadError("Saved data could not be read.", error);
    }

    // Seed the diff baseline with what the database holds: the normalized
    // record JSON, and the stored project_id and position (so any drift there
    // is corrected by the next save).
    const { snapshot: seeded } = snapshotAppData(result.data, result.stored);
    for (const key of COLLECTION_KEYS) {
      seeded[key].forEach((row, id) => {
        const stored = result.stored[key].get(id);
        if (stored) {
          row.projectId = stored.projectId;
          row.position = stored.position;
        }
      });
    }
    snapshot = seeded;
    return result.data;
  }

  async function write(data: AppData): Promise<void> {
    if (!snapshot) {
      throw new Error("Saved data has not been loaded; refusing to save.");
    }
    const { snapshot: next, problems } = snapshotAppData(data, snapshot);
    if (problems.length > 0) {
      warn(`Some records could not be saved (${describeProblems(problems)}).`, problems);
    }
    const diff = diffAppData(snapshot, next);
    if (isEmptyDiff(diff)) {
      snapshot = next;
      return;
    }
    const driver = await getDriver();
    const updatedAt = now();
    await driver.transactionAsync(async (tx) => {
      for (const key of COLLECTION_KEYS) {
        const table = COLLECTION_TABLES[key];
        for (const id of diff[key].deletes) {
          await tx.runAsync(sql.deleteRow(table), [id]);
        }
        for (const row of diff[key].upserts) {
          await tx.runAsync(sql.upsertRow(table), [row.id, row.projectId, row.position, row.json, updatedAt]);
        }
      }
    });
    // Only advance the baseline once the transaction committed; a failed save
    // is retried in full by the next one.
    snapshot = next;
  }

  // Saves coalesce: while one write runs, further calls just replace the
  // pending snapshot, and every caller settles when a snapshot at least as new
  // as theirs has been written.
  let pendingData: AppData | null = null;
  let pendingWaiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  let flushQueued = false;

  async function flush(): Promise<void> {
    flushQueued = false;
    const data = pendingData as AppData;
    const waiters = pendingWaiters;
    pendingData = null;
    pendingWaiters = [];
    try {
      await write(data);
      waiters.forEach((waiter) => waiter.resolve());
    } catch (error) {
      waiters.forEach((waiter) => waiter.reject(error));
    }
  }

  return {
    load: () => enqueue(load),
    save: (data) =>
      new Promise<void>((resolve, reject) => {
        pendingData = data;
        pendingWaiters.push({ resolve, reject });
        if (!flushQueued) {
          flushQueued = true;
          void enqueue(flush);
        }
      })
  };
}
