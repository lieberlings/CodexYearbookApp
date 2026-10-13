import { describe, expect, it, jest } from "@jest/globals";
import { createFakeSqlDriver, FakeSqlDriver } from "../test/fakeSqlDriver";
import { AppData, Memory, PhotoItem, Project } from "../types";
import { createAppDataStore } from "./appDataStore";
import { AppDataLoadError } from "./errors";
import { normalizeAppData, parseLegacyAppData } from "./normalize";
import { COLLECTION_TABLES } from "./schema";

const project = (id: string, name = "Trip"): Project =>
  ({ id, name, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" }) as Project;
const memory = (id: string, projectId: string, title = "Beach"): Memory => ({
  id, projectId, title, kind: "event", status: "active", order: 0, createdAt: "t", updatedAt: "t"
});
const photo = (id: string, projectId: string, memoryId?: string): PhotoItem => ({
  id, projectId, memoryId, uri: `file:///${id}.jpg`, capturedAt: "t", addedAt: "t"
});

const legacyData = {
  projects: [project("p1"), project("p2", "School")],
  memories: [memory("m1", "p1")],
  pageSections: [{ id: "s1", memoryId: "m1", order: 0, photoIds: ["ph1"] }],
  photos: [{ ...photo("ph1", "p1", "m1"), exportDataUri: "data:image/png;base64,abc" }, photo("ph2", "p2")],
  suggestions: [{ id: "sg1", projectId: "p1", message: "", candidatePhotoIds: null, createdAt: "2024-01-05T00:00:00.000Z" }]
};

function setup(blob: string | null = JSON.stringify(legacyData), driver: FakeSqlDriver = createFakeSqlDriver()) {
  const read = jest.fn(async () => blob);
  const warn = jest.fn();
  let tick = 0;
  const store = createAppDataStore({
    openDriver: async () => driver,
    legacyBlob: { read },
    now: () => `2025-01-01T00:00:${String(tick++).padStart(2, "0")}.000Z`,
    warn
  });
  return { store, driver, read, warn };
}

const meta = (driver: FakeSqlDriver, key: string) => driver.rows("meta").find((row) => row.key === key)?.value;
const counts = (driver: FakeSqlDriver) =>
  Object.fromEntries(Object.values(COLLECTION_TABLES).map((table) => [table, driver.rows(table).length]));
const upsertCount = (driver: FakeSqlDriver) => driver.statements.filter((sql) => sql.includes("ON CONFLICT(id)")).length;

describe("migration from AsyncStorage", () => {
  it("copies every record in one transaction and sets the flag", async () => {
    const { store, driver, read } = setup();
    const loaded = await store.load();

    expect(read).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual(parseLegacyAppData(JSON.stringify(legacyData)));
    expect(counts(driver)).toEqual({ projects: 2, memories: 1, page_sections: 1, photos: 2, suggestions: 1 });
    expect(meta(driver, "schema_version")).toBe("1");
    expect(meta(driver, "migrated_from_async_storage_at")).toBe("2025-01-01T00:00:00.000Z");
    expect(driver.rows("photos")[0].data).not.toContain("exportDataUri");
    expect(driver.rows("page_sections")[0].project_id).toBe("p1");
    expect(driver.rows("projects")[0].project_id).toBeNull();
    expect(loaded.suggestions[0]).toMatchObject({ status: "new", title: "Untitled suggestion", candidatePhotoIds: [] });
  });

  it.each([null, ""])("treats a missing blob (%p) as a fresh install", async (blob) => {
    const { store, driver } = setup(blob);
    await expect(store.load()).resolves.toEqual({ projects: [], memories: [], pageSections: [], photos: [], suggestions: [] });
    expect(meta(driver, "migrated_from_async_storage_at")).toBeDefined();
  });

  it("rolls back without setting the flag when a write fails, then retries cleanly", async () => {
    const driver = createFakeSqlDriver();
    driver.failWhen = (sql) => sql.startsWith("INSERT INTO photos");
    const first = setup(undefined, driver);
    await expect(first.store.load()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(counts(driver)).toEqual({ projects: 0, memories: 0, page_sections: 0, photos: 0, suggestions: 0 });
    expect(meta(driver, "migrated_from_async_storage_at")).toBeUndefined();
    await expect(first.store.save(legacyData as unknown as AppData)).rejects.toThrow(/not been loaded/);

    driver.failWhen = undefined;
    const retry = setup(undefined, driver);
    expect((await retry.store.load()).photos).toHaveLength(2);
    expect(counts(driver).photos).toBe(2);
  });

  it("rolls back when the flag write itself fails (crash before commit)", async () => {
    const driver = createFakeSqlDriver();
    driver.failWhen = (sql, params) => sql.startsWith("INSERT INTO meta") && params[0] === "migrated_from_async_storage_at";
    await expect(setup(undefined, driver).store.load()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(counts(driver).projects).toBe(0);
  });

  it("never migrates again once the flag is set", async () => {
    const driver = createFakeSqlDriver();
    await setup(undefined, driver).store.load();
    const changedBlob = JSON.stringify({ ...legacyData, projects: [project("other")] });
    const relaunch = setup(changedBlob, driver);
    const loaded = await relaunch.store.load();
    expect(relaunch.read).not.toHaveBeenCalled();
    expect(loaded.projects.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("reports an unreadable or corrupt blob without touching the database", async () => {
    const unreadable = createFakeSqlDriver();
    const failing = createAppDataStore({
      openDriver: async () => unreadable,
      legacyBlob: { read: async () => { throw new Error("Row too big to fit into CursorWindow"); } }
    });
    await expect(failing.load()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(meta(unreadable, "migrated_from_async_storage_at")).toBeUndefined();

    const { store, driver } = setup('{"projects": [');
    await expect(store.load()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(meta(driver, "migrated_from_async_storage_at")).toBeUndefined();
  });

  it("refuses to migrate duplicate ids instead of dropping one", async () => {
    const { store, driver } = setup(JSON.stringify({ ...legacyData, projects: [project("p1"), project("p1", "Copy")] }));
    await expect(store.load()).rejects.toThrow(/projects:duplicate-id:p1/);
    expect(counts(driver).projects).toBe(0);
    expect(meta(driver, "migrated_from_async_storage_at")).toBeUndefined();
  });
});

describe("loading from SQLite", () => {
  it("throws on a corrupt row and leaves it in place", async () => {
    const { store, driver } = setup();
    await store.load();
    driver.tables.get("memories")!.rows.get("m1")!.data = "{not json";
    await expect(setup(undefined, driver).store.load()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(driver.rows("memories")).toHaveLength(1);
  });

  it("refuses a database written by a newer schema", async () => {
    const { store, driver } = setup();
    await store.load();
    driver.tables.get("meta")!.rows.get("schema_version")!.value = "99";
    await expect(setup(undefined, driver).store.load()).rejects.toThrow(/newer version/);
  });

  it("wraps a failure to open the database", async () => {
    const store = createAppDataStore({ openDriver: async () => { throw new Error("disk I/O error"); }, legacyBlob: { read: async () => null } });
    await expect(store.load()).rejects.toBeInstanceOf(AppDataLoadError);
  });
});

describe("saving by diff", () => {
  async function loaded() {
    const context = setup();
    const data = await context.store.load();
    context.driver.statements.length = 0;
    return { ...context, data };
  }

  it("round-trips through a relaunch and preserves array order", async () => {
    const { store, driver, data } = await loaded();
    const next: AppData = {
      ...data,
      projects: [project("p0", "New"), ...data.projects],
      photos: [photo("ph0", "p1", "m1"), ...data.photos.filter((item) => item.id !== "ph2")],
      memories: data.memories.map((item) => ({ ...item, title: "Renamed" }))
    };
    await store.save(next);
    const reloaded = await setup(undefined, driver).store.load();
    expect(reloaded).toEqual(normalizeAppData(next));
    expect(reloaded.projects.map((p) => p.id)).toEqual(["p0", "p1", "p2"]);
  });

  it("writes only changed rows and deletes removed ones", async () => {
    const { store, driver, data } = await loaded();
    await store.save({ ...data, projects: data.projects.map((item) => ({ ...item })) });
    expect(driver.statements).toEqual([]);

    await store.save({
      ...data,
      projects: [data.projects[0], { ...data.projects[1], name: "Renamed" }],
      photos: data.photos.slice(0, 1)
    });
    expect(upsertCount(driver)).toBe(1);
    expect(driver.statements.filter((sql) => sql.startsWith("DELETE"))).toEqual(["DELETE FROM photos WHERE id = ?"]);
    expect(driver.rows("photos").map((row) => row.id)).toEqual(["ph1"]);
  });

  it("strips exportDataUri when saving", async () => {
    const { store, driver, data } = await loaded();
    await store.save({ ...data, photos: [{ ...data.photos[0], exportDataUri: "data:image/jpeg;base64,abc" }, data.photos[1]] });
    expect(driver.statements).toEqual([]);
    expect(driver.rows("photos")[0].data).not.toContain("exportDataUri");
  });

  it("coalesces bursts to the newest snapshot and resolves every caller", async () => {
    const { store, driver, data } = await loaded();
    const rename = (name: string): AppData => ({ ...data, projects: [{ ...data.projects[0], name }, data.projects[1]] });
    await Promise.all([store.save(rename("A")), store.save(rename("B")), store.save(rename("C"))]);
    expect(upsertCount(driver)).toBe(1);
    expect(JSON.parse(driver.rows("projects")[0].data as string).name).toBe("C");
  });

  it("never interleaves: a save made during a write lands after it", async () => {
    const { store, driver, data } = await loaded();
    const rename = (name: string): AppData => ({ ...data, projects: [{ ...data.projects[0], name }, data.projects[1]] });
    const first = store.save(rename("first"));
    await Promise.resolve();
    await Promise.resolve();
    const second = store.save(rename("second"));
    const third = store.save(rename("third"));
    await Promise.all([first, second, third]);
    expect(JSON.parse(driver.rows("projects")[0].data as string).name).toBe("third");
    expect(driver.inTransaction()).toBe(false);
  });

  it("retries a failed save's changes with the next save", async () => {
    const { store, driver, data } = await loaded();
    driver.failWhen = (sql) => sql.startsWith("INSERT INTO memories");
    const changed: AppData = { ...data, memories: [{ ...data.memories[0], title: "Lost?" }] };
    await expect(store.save(changed)).rejects.toThrow(/Injected failure/);
    expect(JSON.parse(driver.rows("memories")[0].data as string).title).toBe("Beach");

    driver.failWhen = undefined;
    await store.save({ ...changed, projects: [...changed.projects] });
    expect(JSON.parse(driver.rows("memories")[0].data as string).title).toBe("Lost?");
  });

  it("refuses to save before a successful load", async () => {
    const { store, driver } = setup();
    await expect(store.save(legacyData as unknown as AppData)).rejects.toThrow(/not been loaded/);
    expect(driver.tables.size).toBe(0);
  });
});
