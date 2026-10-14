import type { AppData, Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { FakeCloud, memorySyncState } from "../test/fakeCloud";
import { runCloudSync } from "./syncEngine";
import { applyCloudPatchToData, SyncStateStore } from "./syncTypes";

const OWNER = "owner-user";
const BOB = "bob-user";

function emptyData(): AppData {
  return { projects: [], memories: [], pageSections: [], photos: [], suggestions: [] };
}

function ownerBook(): AppData {
  const project = { id: "p1", name: "Summer", projectType: "yearbook", createdAt: "", updatedAt: "", cloud: { role: "owner", ownerId: OWNER } } as unknown as Project;
  const memory = { id: "m1", projectId: "p1", title: "Beach", kind: "event", status: "active", order: 0, createdAt: "", updatedAt: "" } as unknown as Memory;
  const section: MemoryPageSection = { id: "s1", memoryId: "m1", order: 0, photoIds: ["ph1"] };
  const photo: PhotoItem = {
    id: "ph1", projectId: "p1", memoryId: "m1", uri: "file:///owner/ph1.jpg", width: 4000, height: 3000,
    capturedAt: "2026-07-01T10:00:00.000Z", addedAt: "2026-07-01T10:00:00.000Z", location: { latitude: 52.374, longitude: 4.889 }
  };
  return { ...emptyData(), projects: [project], memories: [memory], pageSections: [section], photos: [photo] };
}

// One phone: its app data and its sync bookkeeping.
class Device {
  data: AppData;
  state: SyncStateStore = memorySyncState();
  files;
  constructor(readonly cloud: FakeCloud, readonly userId: string, readonly name: string, data: AppData = emptyData()) {
    this.data = data;
    this.files = cloud.photoFiles(name);
  }
  async sync() {
    const result = await runCloudSync(this.data, { remote: this.cloud.api(this.userId), state: this.state, files: this.files });
    this.data = { ...this.data, ...applyCloudPatchToData(this.data, result.patch) };
    return result;
  }
}

it("uploads a project once, with its photo, and keeps the location on the phone", async () => {
  const cloud = new FakeCloud();
  const phone = new Device(cloud, OWNER, "owner", ownerBook());
  const first = await phone.sync();
  expect(first.errors).toEqual([]);
  expect(cloud.tables.projects.get("p1")?.owner_id).toBe(OWNER);
  expect(phone.files.uploads).toEqual(["p1/ph1.jpg"]);
  const photoRow = cloud.tables.photos.get("p1/ph1")!;
  expect(photoRow.storage_path).toBe("p1/ph1.jpg");
  expect(JSON.stringify(photoRow.data)).not.toContain("52.374");
  expect(cloud.tables.memories.get("p1/m1")).toMatchObject({ area_lat: 52.37, area_lng: 4.89 });
  expect(phone.data.photos[0].cloud).toEqual({ path: "p1/ph1.jpg", addedBy: OWNER });

  const writes = cloud.now();
  await phone.sync();
  const changedAfter = [...cloud.tables.memories.values(), ...cloud.tables.photos.values()].filter((row) => row.updated_at > writes);
  expect(changedAfter).toEqual([]);
  expect(phone.files.uploads).toHaveLength(1);
});

it("brings an edit from one of the owner's phones to the other", async () => {
  const cloud = new FakeCloud();
  const a = new Device(cloud, OWNER, "a", ownerBook());
  await a.sync();
  const b = new Device(cloud, OWNER, "b");
  await b.sync();
  expect(b.data.memories.map((memory) => memory.title)).toEqual(["Beach"]);
  expect(b.data.photos[0].uri).toBe("file:///b/p1/ph1.jpg");
  expect(b.data.photos[0].location).toBeUndefined();

  a.data = { ...a.data, memories: a.data.memories.map((memory) => ({ ...memory, title: "Beach day" })) };
  await a.sync();
  await b.sync();
  expect(b.data.memories[0].title).toBe("Beach day");
});

it("lets a contributor add photos, and undoes edits it isn't allowed to make", async () => {
  const cloud = new FakeCloud();
  const owner = new Device(cloud, OWNER, "owner", ownerBook());
  await owner.sync();
  cloud.addMember("p1", BOB, "contributor");

  const bob = new Device(cloud, BOB, "bob");
  await bob.sync();
  expect(bob.data.projects[0].cloud).toEqual({ role: "contributor", ownerId: OWNER });
  expect(bob.data.memories[0].cloud).toEqual({ createdBy: OWNER, controllerId: null });

  const bobPhoto: PhotoItem = { id: "ph2", projectId: "p1", memoryId: "m1", uri: "file:///bob/new.jpg", capturedAt: "", addedAt: "" };
  bob.data = {
    ...bob.data,
    photos: [...bob.data.photos, bobPhoto],
    memories: bob.data.memories.map((memory) => ({ ...memory, title: "Renamed by Bob" }))
  };
  await bob.sync();
  expect(cloud.tables.photos.get("p1/ph2")?.added_by).toBe(BOB);
  expect(cloud.tables.memories.get("p1/m1")?.data).toMatchObject({ title: "Beach" });
  expect(bob.data.memories[0].title).toBe("Beach");

  await owner.sync();
  expect(owner.data.photos.map((photo) => photo.id).sort()).toEqual(["ph1", "ph2"]);
  expect(owner.data.photos.find((photo) => photo.id === "ph2")?.cloud?.addedBy).toBe(BOB);
});

it("lets a contributor build its own memory", async () => {
  const cloud = new FakeCloud();
  const owner = new Device(cloud, OWNER, "owner", ownerBook());
  await owner.sync();
  cloud.addMember("p1", BOB, "contributor");
  const bob = new Device(cloud, BOB, "bob");
  await bob.sync();
  const memory = { id: "m2", projectId: "p1", title: "Bob's trip", kind: "event", status: "active", order: 1, createdAt: "", updatedAt: "" } as unknown as Memory;
  bob.data = { ...bob.data, memories: [...bob.data.memories, memory], pageSections: [...bob.data.pageSections, { id: "s2", memoryId: "m2", order: 0, photoIds: [] }] };
  await bob.sync();
  expect(cloud.tables.memories.get("p1/m2")).toMatchObject({ created_by: BOB, controller_id: BOB });
  expect(cloud.tables.pageSections.get("p1/s2")).toBeDefined();
  expect(bob.data.memories.find((item) => item.id === "m2")?.cloud).toEqual({ createdBy: BOB, controllerId: BOB });
});

it("syncs deletions both ways", async () => {
  const cloud = new FakeCloud();
  const owner = new Device(cloud, OWNER, "owner", ownerBook());
  await owner.sync();
  cloud.addMember("p1", BOB, "viewer");
  const viewer = new Device(cloud, BOB, "viewer");
  await viewer.sync();

  owner.data = { ...owner.data, photos: [], pageSections: owner.data.pageSections.map((section) => ({ ...section, photoIds: [] })) };
  await owner.sync();
  expect(cloud.tables.photos.get("p1/ph1")?.deleted_at).toBeTruthy();
  await viewer.sync();
  expect(viewer.data.photos).toEqual([]);

  // A viewer deleting locally gets the record back.
  viewer.data = { ...viewer.data, memories: [] };
  await viewer.sync();
  expect(viewer.data.memories.map((memory) => memory.id)).toEqual(["m1"]);
});

it("keeps a read-only copy when access is removed, and drops a project the owner deleted", async () => {
  const cloud = new FakeCloud();
  const owner = new Device(cloud, OWNER, "owner", ownerBook());
  await owner.sync();
  cloud.addMember("p1", BOB, "contributor");
  const bob = new Device(cloud, BOB, "bob");
  await bob.sync();

  cloud.removeMember("p1", BOB);
  const result = await bob.sync();
  expect(result.lostAccess).toEqual(["p1"]);
  expect(bob.data.projects[0].cloud?.accessRemovedAt).toBeTruthy();
  expect(bob.data.memories).toHaveLength(1);

  cloud.addMember("p1", "carol", "viewer");
  const carol = new Device(cloud, "carol", "carol");
  await carol.sync();
  owner.data = emptyData();
  await owner.sync();
  expect(cloud.tables.projects.get("p1")?.deleted_at).toBeTruthy();
  await carol.sync();
  expect(carol.data.projects).toEqual([]);
  expect(carol.data.photos).toEqual([]);
});

it("doesn't overwrite an edit made while the sync was running", async () => {
  const cloud = new FakeCloud();
  const a = new Device(cloud, OWNER, "a", ownerBook());
  await a.sync();
  const b = new Device(cloud, OWNER, "b");
  await b.sync();
  a.data = { ...a.data, memories: a.data.memories.map((memory) => ({ ...memory, title: "From A" })) };
  await a.sync();

  const result = await runCloudSync(b.data, { remote: cloud.api(OWNER), state: b.state, files: b.files });
  const editedMeanwhile = { ...b.data, memories: b.data.memories.map((memory) => ({ ...memory, title: "Typed on B" })) };
  const applied = applyCloudPatchToData(editedMeanwhile, result.patch);
  expect(applied.memories[0].title).toBe("Typed on B");
});
