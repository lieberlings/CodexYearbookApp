import type { Memory, MemoryPageSection, PhotoItem, Project } from "../../types";
import { runSync, type CloudApi } from "./engine";
import {
  CLOUD_URI_PREFIX,
  emptySyncState,
  planPush,
  type CloudRecords,
  type CloudRow,
  type CloudTable,
  type LocalPatch,
  type SyncState
} from "./model";

// In-memory stand-in for the Supabase tables, photo bucket and access rules.
class FakeServer {
  tables: Record<CloudTable, Map<string, CloudRow>> = {
    projects: new Map(),
    memories: new Map(),
    page_sections: new Map(),
    photos: new Map()
  };
  files = new Map<string, string>();
  // project id -> user id -> role
  members = new Map<string, Map<string, "owner" | "contributor">>();
  private clock = Date.parse("2026-10-14T00:00:00Z");

  private tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  addMember(projectId: string, userId: string, role: "owner" | "contributor") {
    if (!this.members.has(projectId)) this.members.set(projectId, new Map());
    this.members.get(projectId)!.set(userId, role);
  }

  private role(projectId: string, userId: string) {
    return this.members.get(projectId)?.get(userId);
  }

  // Mirrors the row-level security rules in supabase/migrations.
  private assertMayWrite(table: CloudTable, row: CloudRow, userId: string) {
    const projectId = table === "projects" ? row.id : row.project_id!;
    if (table === "projects" && !this.tables.projects.has(row.id) && row.owner_id === userId) return;
    const role = this.role(projectId, userId);
    if (role === "owner") return;
    const existing = this.tables[table].get(row.id);
    if (role === "contributor" && table === "photos" && row.added_by === userId && (!existing || existing.added_by === userId)) {
      return;
    }
    throw new Error(`denied: ${userId} writing ${table} ${row.id}`);
  }

  api(userId: string, device: string, options: { failUploads?: boolean } = {}): CloudApi {
    return {
      upsert: async (table, rows) => {
        for (const row of rows) {
          const existing = this.tables[table].get(row.id);
          this.assertMayWrite(table, { ...existing, ...row }, userId);
          this.tables[table].set(row.id, { ...existing, ...row, updated_at: this.tick(), deleted_at: null });
          if (table === "projects" && !existing) this.addMember(row.id, userId, "owner");
        }
      },
      markDeleted: async (table, ids) => {
        for (const id of ids) {
          const existing = this.tables[table].get(id);
          if (!existing) continue;
          this.assertMayWrite(table, existing, userId);
          this.tables[table].set(id, { ...existing, deleted_at: this.tick(), updated_at: this.tick() });
        }
      },
      pullSince: async (table, cursor) =>
        [...this.tables[table].values()]
          .filter((row) => this.role(table === "projects" ? row.id : row.project_id!, userId))
          .filter((row) => !cursor || (row.updated_at ?? "") > cursor)
          .sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? "")),
      uploadPhotoFile: async (path, localUri) => {
        if (options.failUploads) throw new Error("offline");
        this.files.set(path, `bytes of ${localUri}`);
      },
      setPhotoStoragePath: async (photoId, path) => {
        const existing = this.tables.photos.get(photoId)!;
        this.assertMayWrite("photos", existing, userId);
        this.tables.photos.set(photoId, { ...existing, storage_path: path, updated_at: this.tick() });
      },
      downloadPhotoFile: async (path, photoId) => {
        if (!this.files.has(path)) throw new Error("missing file");
        return `file:///${device}/photos/${photoId}.jpg`;
      },
      listMyProjectIds: async () =>
        [...this.members.entries()].filter(([, users]) => users.has(userId)).map(([projectId]) => projectId)
    };
  }
}

function applyPatch(records: CloudRecords, patch: LocalPatch): CloudRecords {
  const merge = <T extends { id: string }>(items: T[], upserts: T[], removed: string[]) => {
    const byId = new Map(items.filter((item) => !removed.includes(item.id)).map((item) => [item.id, item]));
    for (const item of upserts) byId.set(item.id, item);
    return [...byId.values()];
  };
  return {
    projects: merge(records.projects, patch.upsert.projects, patch.remove.projects),
    memories: merge(records.memories, patch.upsert.memories, patch.remove.memories),
    pageSections: merge(records.pageSections, patch.upsert.pageSections, patch.remove.pageSections),
    photos: merge(records.photos, patch.upsert.photos, patch.remove.photos)
  };
}

const project = { id: "p1", name: "Summer", projectType: "general", thumbnailUri: "file:///a/thumb.jpg", createdAt: "t", updatedAt: "t" } as Project;
const memory = { id: "m1", projectId: "p1", title: "Beach", order: 0 } as Memory;
const section = { id: "s1", memoryId: "m1", order: 0, photoIds: ["ph1"] } as MemoryPageSection;
const photo = {
  id: "ph1",
  projectId: "p1",
  memoryId: "m1",
  uri: "file:///a/photos/ph1.jpg",
  capturedAt: "c",
  addedAt: "a",
  analysis: { faces: "private" }
} as unknown as PhotoItem;

function deviceA(): { records: CloudRecords; state: SyncState } {
  return {
    records: { projects: [project], memories: [memory], pageSections: [section], photos: [photo] },
    state: { ...emptySyncState("user-1"), syncedProjectIds: ["p1"] }
  };
}

async function sync(server: FakeServer, device: string, records: CloudRecords, state: SyncState) {
  const result = await runSync(server.api(state.userId, device), records, state);
  return { ...result, records: applyPatch(records, result.patch) };
}

it("backs up a project with its photo file and restores it on a second device", async () => {
  const server = new FakeServer();
  const a = deviceA();
  const first = await sync(server, "a", a.records, a.state);
  expect(first.report).toMatchObject({ pushed: 4, uploaded: 1, fileErrors: [] });
  expect(server.files.has("p1/ph1.jpg")).toBe(true);
  // Device-only and sensitive fields never leave the device.
  const savedPhoto = server.tables.photos.get("ph1")!;
  expect(savedPhoto.data).not.toHaveProperty("uri");
  expect(savedPhoto.data).not.toHaveProperty("analysis");
  expect(server.tables.projects.get("p1")!.data).not.toHaveProperty("thumbnailUri");

  // A second phone signed in to the same account starts empty.
  const empty: CloudRecords = { projects: [], memories: [], pageSections: [], photos: [] };
  const restored = await sync(server, "b", empty, emptySyncState("user-1"));
  expect(restored.records.projects.map((item) => item.id)).toEqual(["p1"]);
  expect(restored.records.memories.map((item) => item.title)).toEqual(["Beach"]);
  expect(restored.records.pageSections[0].photoIds).toEqual(["ph1"]);
  expect(restored.records.photos[0].uri).toBe("file:///b/photos/ph1.jpg");
  expect(restored.state.syncedProjectIds).toEqual(["p1"]);
  expect(restored.report.downloaded).toBe(1);
});

it("only sends what changed, and nothing when nothing changed", async () => {
  const server = new FakeServer();
  const a = deviceA();
  const first = await sync(server, "a", a.records, a.state);
  const second = await sync(server, "a", first.records, first.state);
  expect(second.report.pushed).toBe(0);
  expect(second.report.uploaded).toBe(0);

  const renamed = { ...second.records, memories: [{ ...memory, title: "Beach day" }] };
  const plan = planPush(renamed, second.state);
  expect(plan.upserts.memories.map((row) => row.id)).toEqual(["m1"]);
  expect(plan.upserts.projects).toEqual([]);
});

it("carries deletions to the other device", async () => {
  const server = new FakeServer();
  const a = deviceA();
  const first = await sync(server, "a", a.records, a.state);
  const b = await sync(server, "b", { projects: [], memories: [], pageSections: [], photos: [] }, emptySyncState("user-1"));

  const withoutMemory = { ...first.records, memories: [], pageSections: [], photos: [] };
  await sync(server, "a", withoutMemory, first.state);
  expect(server.tables.memories.get("m1")!.deleted_at).toBeTruthy();

  const bAfter = await sync(server, "b", b.records, b.state);
  expect(bAfter.records.memories).toEqual([]);
  expect(bAfter.records.photos).toEqual([]);
  expect(bAfter.records.projects.map((item) => item.id)).toEqual(["p1"]);
});

it("keeps an unpushed local edit instead of overwriting it with the server copy", async () => {
  const server = new FakeServer();
  const a = deviceA();
  const first = await sync(server, "a", a.records, a.state);
  const b = await sync(server, "b", { projects: [], memories: [], pageSections: [], photos: [] }, emptySyncState("user-1"));

  // Device A renames and syncs; device B renamed too but hasn't synced yet.
  await sync(server, "a", { ...first.records, memories: [{ ...memory, title: "From A" }] }, first.state);
  const bEdited = { ...b.records, memories: [{ ...b.records.memories[0], title: "From B" }] };
  const bAfter = await sync(server, "b", bEdited, b.state);
  // B's own edit was pushed first and wins; it is not replaced by A's.
  expect(bAfter.records.memories[0].title).toBe("From B");
  expect((server.tables.memories.get("m1")!.data as Memory).title).toBe("From B");
});

it("leaves projects that aren't backed up alone", async () => {
  const server = new FakeServer();
  const local = { ...deviceA().records };
  const result = await sync(server, "a", local, emptySyncState("user-1"));
  expect(result.report.pushed).toBe(0);
  expect(server.tables.projects.size).toBe(0);
});

it("reports a failed photo upload and retries it next time", async () => {
  const server = new FakeServer();
  const a = deviceA();
  const failed = await runSync(server.api("user-1", "a", { failUploads: true }), a.records, a.state);
  expect(failed.report.fileErrors).toEqual(["Upload ph1: offline"]);
  expect(failed.state.uploadedFiles).toEqual({});
  const retried = await runSync(server.api("user-1", "a"), applyPatch(a.records, failed.patch), failed.state);
  expect(retried.report.uploaded).toBe(1);
  expect(server.tables.photos.get("ph1")!.storage_path).toBe("p1/ph1.jpg");
});

it("marks restored photos as waiting for their file until it downloads", async () => {
  const server = new FakeServer();
  const a = deviceA();
  // Push the rows but fail the file upload, so the cloud has no file yet.
  await runSync(server.api("user-1", "a", { failUploads: true }), a.records, a.state);
  const b = await sync(server, "b", { projects: [], memories: [], pageSections: [], photos: [] }, emptySyncState("user-1"));
  expect(b.records.photos[0].uri).toBe(CLOUD_URI_PREFIX);
  expect(b.report.downloaded).toBe(0);
});

describe("sharing with a contributor", () => {
  const empty = (): CloudRecords => ({ projects: [], memories: [], pageSections: [], photos: [] });

  async function sharedSetup() {
    const server = new FakeServer();
    const a = deviceA();
    const owner = await sync(server, "owner", a.records, a.state);
    server.addMember("p1", "user-2", "contributor");
    const guest = await sync(server, "guest", empty(), emptySyncState("user-2"));
    return { server, owner, guest };
  }

  it("lets a contributor see the project and add a photo, which reaches the owner", async () => {
    const { server, owner, guest } = await sharedSetup();
    expect(guest.records.projects.map((item) => item.id)).toEqual(["p1"]);
    expect(guest.state.roles).toEqual({ p1: "contributor" });

    const guestPhoto = { id: "ph2", projectId: "p1", memoryId: "m1", uri: "file:///guest/photos/ph2.jpg", capturedAt: "c", addedAt: "b" } as PhotoItem;
    const added = await sync(server, "guest", { ...guest.records, photos: [...guest.records.photos, guestPhoto] }, guest.state);
    expect(added.report).toMatchObject({ pushed: 1, uploaded: 1, fileErrors: [] });
    expect(server.tables.photos.get("ph2")!.added_by).toBe("user-2");

    const ownerAfter = await sync(server, "owner", owner.records, owner.state);
    const arrived = ownerAfter.records.photos.find((item) => item.id === "ph2")!;
    expect(arrived.addedBy).toBe("user-2");
    expect(arrived.uri).toBe("file:///owner/photos/ph2.jpg");

    // The owner editing that photo keeps who added it, and the server accepts it.
    const edited = {
      ...ownerAfter.records,
      photos: ownerAfter.records.photos.map((item) => (item.id === "ph2" ? { ...item, capturedAt: "fixed" } : item))
    };
    const ownerEdit = await sync(server, "owner", edited, ownerAfter.state);
    expect(ownerEdit.report.pushed).toBe(1);
    expect(server.tables.photos.get("ph2")!.added_by).toBe("user-2");
  });

  it("never sends a contributor's layout edits and lets the owner's version win", async () => {
    const { server, owner, guest } = await sharedSetup();
    const edited = { ...guest.records, memories: [{ ...guest.records.memories[0], title: "Guest rename" }] };
    const result = await sync(server, "guest", edited, guest.state);
    expect(result.report.pushed).toBe(0);
    expect((server.tables.memories.get("m1")!.data as Memory).title).toBe("Beach");

    await sync(server, "owner", { ...owner.records, memories: [{ ...memory, title: "Owner rename" }] }, owner.state);
    const guestAfter = await sync(server, "guest", result.records, result.state);
    expect(guestAfter.records.memories[0].title).toBe("Owner rename");
  });

  it("does not delete the owner's photos when they are missing on a contributor's phone", async () => {
    const { server, guest } = await sharedSetup();
    const result = await sync(server, "guest", { ...guest.records, photos: [] }, guest.state);
    expect(result.report.pushed).toBe(0);
    expect(server.tables.photos.get("ph1")!.deleted_at).toBeFalsy();
  });

  it("removes the project from a contributor's phone after they are removed", async () => {
    const { server, guest } = await sharedSetup();
    server.members.get("p1")!.delete("user-2");
    const after = await sync(server, "guest", guest.records, guest.state);
    expect(after.records.projects).toEqual([]);
    expect(after.records.memories).toEqual([]);
    expect(after.records.photos).toEqual([]);
    expect(after.state.syncedProjectIds).toEqual([]);
  });

  it("keeps an owner's own projects even if the membership list comes back without them", async () => {
    const { server, owner } = await sharedSetup();
    server.members.get("p1")!.delete("user-1");
    const after = await sync(server, "owner", owner.records, owner.state);
    expect(after.records.projects.map((item) => item.id)).toEqual(["p1"]);
  });
});
