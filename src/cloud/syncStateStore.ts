import type { SqlDriver } from "../data/driver";
import type { ProjectSyncState, SyncStateStore } from "./syncTypes";

// Sync bookkeeping lives in its own database file per account, apart from
// the app data, so it never shares a transaction with saves and signing in
// as someone else starts clean.
export const SYNC_STATE_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS sync_records (project_id TEXT NOT NULL, record_key TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (project_id, record_key))",
  "CREATE TABLE IF NOT EXISTS sync_projects (project_id TEXT PRIMARY KEY NOT NULL, cursor TEXT)"
];

export function syncDatabaseName(userId: string): string {
  return `yearbook-sync-${userId.replace(/[^A-Za-z0-9-]/g, "")}.db`;
}

export function createSqlSyncStateStore(openDriver: () => Promise<SqlDriver>): SyncStateStore {
  let ready: Promise<SqlDriver> | null = null;
  function db(): Promise<SqlDriver> {
    if (!ready) {
      ready = openDriver().then(async (driver) => {
        for (const statement of SYNC_STATE_SCHEMA) {
          await driver.execAsync(statement);
        }
        return driver;
      });
      ready.catch(() => {
        ready = null;
      });
    }
    return ready;
  }

  return {
    async listProjects() {
      const rows = await (await db()).getAllAsync<{ project_id: string }>("SELECT project_id FROM sync_projects");
      return rows.map((row) => row.project_id);
    },
    async load(projectId): Promise<ProjectSyncState> {
      const driver = await db();
      const records = await driver.getAllAsync<{ record_key: string; hash: string }>(
        "SELECT record_key, hash FROM sync_records WHERE project_id = ?",
        [projectId]
      );
      const [project] = await driver.getAllAsync<{ cursor: string | null }>("SELECT cursor FROM sync_projects WHERE project_id = ?", [projectId]);
      return { hashes: new Map(records.map((row) => [row.record_key, row.hash])), cursor: project?.cursor ?? null };
    },
    async save(projectId, changes) {
      const driver = await db();
      await driver.transactionAsync(async (tx) => {
        for (const key of changes.remove) {
          await tx.runAsync("DELETE FROM sync_records WHERE project_id = ? AND record_key = ?", [projectId, key]);
        }
        for (const [key, hash] of changes.set) {
          await tx.runAsync(
            "INSERT INTO sync_records (project_id, record_key, hash) VALUES (?, ?, ?) ON CONFLICT(project_id, record_key) DO UPDATE SET hash = excluded.hash",
            [projectId, key, hash]
          );
        }
        await tx.runAsync(
          "INSERT INTO sync_projects (project_id, cursor) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET cursor = excluded.cursor",
          [projectId, changes.cursor]
        );
      });
    },
    async forget(projectId) {
      const driver = await db();
      await driver.transactionAsync(async (tx) => {
        await tx.runAsync("DELETE FROM sync_records WHERE project_id = ?", [projectId]);
        await tx.runAsync("DELETE FROM sync_projects WHERE project_id = ?", [projectId]);
      });
    }
  };
}
