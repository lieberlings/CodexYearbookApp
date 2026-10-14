// A real SQLite (Node's built-in node:sqlite) behind the app's SqlDriver
// interface, for tests that need actual SQL semantics.
import type { SqlDriver, SqlExecutor, SqlValue } from "../data/driver";

type NodeStatement = { run: (...params: SqlValue[]) => unknown; all: (...params: SqlValue[]) => unknown[] };
type NodeDatabase = { exec: (sql: string) => void; prepare: (sql: string) => NodeStatement };

export function createNodeSqliteDriver(): SqlDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => NodeDatabase };
  const db = new DatabaseSync(":memory:");
  const executor: SqlExecutor = {
    execAsync: async (sql) => db.exec(sql),
    runAsync: async (sql, params = []) => {
      db.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[]
  };
  return {
    ...executor,
    transactionAsync: async (task) => {
      db.exec("BEGIN");
      try {
        await task(executor);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
