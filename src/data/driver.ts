// Minimal SQL surface the data layer needs. The app uses the expo-sqlite
// implementation (expoSqliteDriver.ts); tests use an in-memory fake.
export type SqlValue = string | number | null;

export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export interface SqlDriver extends SqlExecutor {
  // Runs task inside BEGIN/COMMIT and rolls back when it throws. Callers must
  // not issue other statements on the driver while a transaction is open.
  transactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}
