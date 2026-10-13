import { openDatabaseAsync } from "expo-sqlite";
import { SqlDriver, SqlValue } from "./driver";

export const DATABASE_NAME = "yearbook.db";

export async function openExpoSqliteDriver(name = DATABASE_NAME): Promise<SqlDriver> {
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  const driver: SqlDriver = {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params: SqlValue[] = []) => {
      await db.runAsync(sql, params);
    },
    getAllAsync: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    // withTransactionAsync shares this connection. That is safe because the
    // app data store runs every load and save through one serial queue, so no
    // unrelated statement can land inside the transaction.
    transactionAsync: (task) => db.withTransactionAsync(() => task(driver))
  };
  return driver;
}
