// In-memory stand-in for expo-sqlite used by the data-layer tests. It only
// understands the handful of statement shapes src/data issues and throws on
// anything else, so SQL drift shows up as a test failure.
import { SqlDriver, SqlExecutor, SqlValue } from "../data/driver";

type Row = Record<string, SqlValue> & { __rowid: number };
type Table = { columns: string[]; notNull: Set<string>; primaryKey: string; rows: Map<string, Row> };

export type FakeSqlDriver = SqlDriver & {
  tables: Map<string, Table>;
  statements: string[];
  // Return true to make the matching statement throw (simulates a crash/failure).
  failWhen?: (sql: string, params: SqlValue[]) => boolean;
  rows: (table: string) => Row[];
  inTransaction: () => boolean;
};

const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim().replace(/;$/, "");

export function createFakeSqlDriver(): FakeSqlDriver {
  const tables = new Map<string, Table>();
  let nextRowId = 1;
  let transactionOpen = false;

  function table(name: string): Table {
    const found = tables.get(name);
    if (!found) {
      throw new Error(`no such table: ${name}`);
    }
    return found;
  }

  function sortedRows(t: Table): Row[] {
    return [...t.rows.values()].sort((a, b) => a.__rowid - b.__rowid);
  }

  function execute(rawSql: string, params: SqlValue[]): Record<string, SqlValue>[] {
    const statement = normalize(rawSql);
    driver.statements.push(statement);
    if (driver.failWhen?.(statement, params)) {
      throw new Error(`Injected failure: ${statement}`);
    }
    let match: RegExpMatchArray | null;

    if ((match = statement.match(/^PRAGMA /))) {
      return [];
    }
    if ((match = statement.match(/^CREATE TABLE (IF NOT EXISTS )?(\w+) \((.+)\)$/))) {
      const [, ifNotExists, name, body] = match;
      if (tables.has(name)) {
        if (ifNotExists) return [];
        throw new Error(`table ${name} already exists`);
      }
      const defs = body.split(",").map((part) => part.trim());
      const columns = defs.map((def) => def.split(" ")[0]);
      const primaryKey = defs.find((def) => def.includes("PRIMARY KEY"))?.split(" ")[0];
      if (!primaryKey) throw new Error("fake driver needs a PRIMARY KEY column");
      const notNull = new Set(defs.filter((def) => def.includes("NOT NULL") || def.includes("PRIMARY KEY")).map((def) => def.split(" ")[0]));
      tables.set(name, { columns, notNull, primaryKey, rows: new Map() });
      return [];
    }
    if ((match = statement.match(/^CREATE INDEX \w+ ON (\w+) \(\w+\)$/))) {
      table(match[1]);
      return [];
    }
    if ((match = statement.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)(?: ON CONFLICT\((\w+)\) DO UPDATE SET (.+))?$/))) {
      const [, name, columnList, placeholders, conflictColumn, updateList] = match;
      const t = table(name);
      const columns = columnList.split(",").map((column) => column.trim());
      if (placeholders.split(",").length !== columns.length || params.length !== columns.length) {
        throw new Error(`bind count mismatch: ${statement}`);
      }
      const values: Record<string, SqlValue> = {};
      columns.forEach((column, index) => {
        if (!t.columns.includes(column)) throw new Error(`no such column: ${column}`);
        values[column] = params[index] ?? null;
      });
      for (const column of t.notNull) {
        if (values[column] === null || values[column] === undefined) {
          throw new Error(`NOT NULL constraint failed: ${name}.${column}`);
        }
      }
      const key = String(values[t.primaryKey]);
      const existing = t.rows.get(key);
      if (existing) {
        if (!conflictColumn) throw new Error(`UNIQUE constraint failed: ${name}.${t.primaryKey}`);
        for (const assignment of updateList.split(",")) {
          const [column, source] = assignment.split("=").map((part) => part.trim());
          if (source !== `excluded.${column}`) throw new Error(`unsupported update: ${assignment}`);
          existing[column] = values[column];
        }
      } else {
        t.rows.set(key, { ...values, __rowid: nextRowId++ });
      }
      return [];
    }
    if ((match = statement.match(/^DELETE FROM (\w+)(?: WHERE (\w+) = \?)?$/))) {
      const [, name, column] = match;
      const t = table(name);
      if (!column) {
        t.rows.clear();
      } else {
        if (column !== t.primaryKey) throw new Error("fake driver only deletes by primary key");
        t.rows.delete(String(params[0]));
      }
      return [];
    }
    if ((match = statement.match(/^SELECT COUNT\(\*\) AS count FROM (\w+)$/))) {
      return [{ count: table(match[1]).rows.size }];
    }
    if ((match = statement.match(/^SELECT ([\w, ]+) FROM (\w+)(?: WHERE (\w+) = \?)?(?: ORDER BY ([\w, ]+))?$/))) {
      const [, columnList, name, whereColumn, orderBy] = match;
      const t = table(name);
      const columns = columnList.split(",").map((column) => column.trim());
      let rows = sortedRows(t);
      if (whereColumn) rows = rows.filter((row) => row[whereColumn] === params[0]);
      if (orderBy) {
        const keys = orderBy.split(",").map((key) => key.trim());
        rows = [...rows].sort((a, b) => {
          for (const key of keys) {
            const left = key === "rowid" ? a.__rowid : (a[key] as number);
            const right = key === "rowid" ? b.__rowid : (b[key] as number);
            if (left !== right) return left < right ? -1 : 1;
          }
          return 0;
        });
      }
      return rows.map((row) => Object.fromEntries(columns.map((column) => {
        if (!t.columns.includes(column)) throw new Error(`no such column: ${column}`);
        return [column, row[column]];
      })));
    }
    throw new Error(`fake driver does not understand: ${statement}`);
  }

  const executor: SqlExecutor = {
    execAsync: async (sql) => {
      for (const part of sql.split(";").map((piece) => piece.trim()).filter(Boolean)) {
        execute(part, []);
      }
    },
    runAsync: async (sql, params = []) => {
      execute(sql, params);
    },
    getAllAsync: async <T>(sql: string, params: SqlValue[] = []) => execute(sql, params) as unknown as T[]
  };

  const driver: FakeSqlDriver = {
    ...executor,
    tables,
    statements: [],
    rows: (name) => sortedRows(table(name)),
    inTransaction: () => transactionOpen,
    transactionAsync: async (task) => {
      if (transactionOpen) throw new Error("cannot start a transaction within a transaction");
      const backup = new Map([...tables].map(([name, t]) => [
        name,
        { ...t, rows: new Map([...t.rows].map(([key, row]) => [key, { ...row }])) }
      ]));
      const backupRowId = nextRowId;
      transactionOpen = true;
      try {
        await task(executor);
      } catch (error) {
        tables.clear();
        backup.forEach((t, name) => tables.set(name, t));
        nextRowId = backupRowId;
        throw error;
      } finally {
        transactionOpen = false;
      }
    }
  };
  return driver;
}
