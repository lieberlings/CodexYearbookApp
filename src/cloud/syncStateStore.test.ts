import { createNodeSqliteDriver } from "../test/nodeSqliteDriver";
import { createSqlSyncStateStore, syncDatabaseName } from "./syncStateStore";

it("remembers record hashes and the pull cursor per project", async () => {
  const store = createSqlSyncStateStore(async () => createNodeSqliteDriver());
  expect(await store.load("p1")).toEqual({ hashes: new Map(), cursor: null });
  await store.save("p1", { set: [["memories:m1", "h1"], ["photos:ph1", "h2"]], remove: [], cursor: "2026-10-01T00:00:00Z" });
  await store.save("p1", { set: [["memories:m1", "h3"]], remove: ["photos:ph1"], cursor: "2026-10-02T00:00:00Z" });
  await store.save("p2", { set: [["memories:m9", "x"]], remove: [], cursor: null });
  expect(await store.load("p1")).toEqual({ hashes: new Map([["memories:m1", "h3"]]), cursor: "2026-10-02T00:00:00Z" });
  expect((await store.listProjects()).sort()).toEqual(["p1", "p2"]);
  await store.forget("p1");
  expect(await store.listProjects()).toEqual(["p2"]);
  expect((await store.load("p1")).hashes.size).toBe(0);
});

it("keeps one database file per account", () => {
  expect(syncDatabaseName("8a6f-12/../x")).toBe("yearbook-sync-8a6f-12x.db");
});
