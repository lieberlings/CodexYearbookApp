import { AppData } from "../types";
import { SqlExecutor } from "./driver";

export type CollectionKey = keyof AppData;

// One table per AppData collection. Every table has the same shape:
//   id          TEXT PRIMARY KEY  record id
//   project_id  TEXT              owning project (null for projects themselves)
//   position    REAL NOT NULL     the record's place in the in-memory array
//   data        TEXT NOT NULL     the record as JSON
//   updated_at  TEXT NOT NULL     ISO time the row was last written
export const COLLECTION_TABLES: Record<CollectionKey, string> = {
  projects: "projects",
  memories: "memories",
  pageSections: "page_sections",
  photos: "photos",
  suggestions: "suggestions"
};

export const COLLECTION_KEYS = Object.keys(COLLECTION_TABLES) as CollectionKey[];

export const META_TABLE = "meta";
export const META_SCHEMA_VERSION = "schema_version";
export const META_MIGRATED_FROM_ASYNC_STORAGE_AT = "migrated_from_async_storage_at";

export const CREATE_META_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS ${META_TABLE} (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`;

export type SchemaMigration = {
  version: number;
  up: (tx: SqlExecutor) => Promise<void>;
};

// Append new versions here; never edit a shipped migration.
export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    up: async (tx) => {
      for (const key of COLLECTION_KEYS) {
        const table = COLLECTION_TABLES[key];
        await tx.execAsync(
          `CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL, project_id TEXT, position REAL NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL)`
        );
        if (key !== "projects") {
          await tx.execAsync(`CREATE INDEX ${table}_project_id ON ${table} (project_id)`);
        }
      }
    }
  }
];

export const LATEST_SCHEMA_VERSION = Math.max(...SCHEMA_MIGRATIONS.map((migration) => migration.version));

export const sql = {
  selectMeta: `SELECT value FROM ${META_TABLE} WHERE key = ?`,
  upsertMeta: `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  selectRows: (table: string) => `SELECT id, project_id, position, data FROM ${table} ORDER BY position, rowid`,
  countRows: (table: string) => `SELECT COUNT(*) AS count FROM ${table}`,
  insertRow: (table: string) =>
    `INSERT INTO ${table} (id, project_id, position, data, updated_at) VALUES (?, ?, ?, ?, ?)`,
  upsertRow: (table: string) =>
    `INSERT INTO ${table} (id, project_id, position, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, position = excluded.position, data = excluded.data, updated_at = excluded.updated_at`,
  deleteRow: (table: string) => `DELETE FROM ${table} WHERE id = ?`,
  deleteAllRows: (table: string) => `DELETE FROM ${table}`
};
