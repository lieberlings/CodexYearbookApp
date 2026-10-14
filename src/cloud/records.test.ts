import type { Memory, PhotoItem, Project } from "../types";
import {
  canDeleteRecord,
  canWriteRecord,
  cloudPhotoData,
  hashString,
  memoryArea,
  memoryFromCloud,
  photoFromCloud,
  projectFromCloud,
  recordHash,
  stableStringify,
  type AccessContext
} from "./records";

const photo: PhotoItem = {
  id: "ph1",
  projectId: "p1",
  memoryId: "m1",
  uri: "file:///local/photo.jpg",
  width: 4000,
  height: 3000,
  capturedAt: "2026-07-01T10:00:00.000Z",
  addedAt: "2026-07-02T10:00:00.000Z",
  location: { latitude: 52.37403, longitude: 4.88969 },
  importMetadata: { assetId: "123" }
};

it("keeps exact location, file paths and picker details off the cloud copy", () => {
  const data = cloudPhotoData(photo);
  expect(data).toEqual({
    id: "ph1",
    projectId: "p1",
    memoryId: "m1",
    width: 4000,
    height: 3000,
    capturedAt: "2026-07-01T10:00:00.000Z",
    addedAt: "2026-07-02T10:00:00.000Z"
  });
});

it("round-trips records without changing their hash", () => {
  const row = { project_id: "p1", id: "ph1", memory_id: "m1", added_by: "u1", storage_path: "p1/ph1.jpg", data: cloudPhotoData(photo), updated_at: "", deleted_at: null };
  const local = photoFromCloud(row, photo);
  expect(local.uri).toBe(photo.uri);
  expect(local.location).toEqual(photo.location);
  expect(local.cloud).toEqual({ path: "p1/ph1.jpg", addedBy: "u1" });
  expect(recordHash("photos", local)).toBe(recordHash("photos", photo));

  const project = { id: "p1", name: "Book", thumbnailUri: "file:///thumb.jpg" } as Project;
  const fromCloud = projectFromCloud({ id: "p1", owner_id: "u1", data: { id: "p1", name: "Book" }, updated_at: "", deleted_at: null }, "owner", project);
  expect(fromCloud.thumbnailUri).toBe("file:///thumb.jpg");
  expect(recordHash("projects", fromCloud)).toBe(recordHash("projects", project));
});

it("hashes the same content the same way regardless of key order", () => {
  expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe('{"a":[1,{"d":2}],"b":1}');
  expect(hashString("a")).not.toBe(hashString("b"));
});

it("shares only a rough area and the date range of a memory", () => {
  const second = { ...photo, id: "ph2", capturedAt: "2026-07-03T10:00:00.000Z", location: { latitude: 52.3801, longitude: 4.8999 } };
  expect(memoryArea("m1", [photo, second, { ...photo, id: "x", memoryId: "other" }])).toEqual({
    date_from: "2026-07-01T10:00:00.000Z",
    date_to: "2026-07-03T10:00:00.000Z",
    area_lat: 52.38,
    area_lng: 4.89
  });
  expect(memoryArea("none", [photo])).toEqual({ date_from: null, date_to: null, area_lat: null, area_lng: null });
});

describe("access mirrors the database rules", () => {
  const ownerMemory = memoryFromCloud({ project_id: "p1", id: "m1", data: { id: "m1" }, created_by: "owner", controller_id: null, date_from: null, date_to: null, area_lat: null, area_lng: null, updated_at: "", deleted_at: null });
  const bobMemory = memoryFromCloud({ project_id: "p1", id: "m2", data: { id: "m2" }, created_by: "bob", controller_id: "bob", date_from: null, date_to: null, area_lat: null, area_lng: null, updated_at: "", deleted_at: null });
  const context = (role: AccessContext["role"]): AccessContext => ({
    role,
    userId: "bob",
    memoriesById: new Map<string, Memory>([["m1", ownerMemory], ["m2", bobMemory]])
  });

  it("lets contributors edit only what they control or added", () => {
    const contributor = context("contributor");
    expect(canWriteRecord(contributor, "projects", { id: "p1" } as Project, false)).toBe(false);
    expect(canWriteRecord(contributor, "memories", ownerMemory, false)).toBe(false);
    expect(canWriteRecord(contributor, "memories", bobMemory, false)).toBe(true);
    expect(canWriteRecord(contributor, "pageSections", { id: "s", memoryId: "m1", order: 0, photoIds: [] }, false)).toBe(false);
    expect(canWriteRecord(contributor, "pageSections", { id: "s", memoryId: "m2", order: 0, photoIds: [] }, false)).toBe(true);
    expect(canWriteRecord(contributor, "photos", { ...photo, memoryId: "m1" }, true)).toBe(true);
    expect(canWriteRecord(contributor, "photos", { ...photo, memoryId: "m1", cloud: { addedBy: "owner" } }, false)).toBe(false);
    expect(canDeleteRecord(contributor, "memories", ownerMemory)).toBe(false);
    expect(canDeleteRecord(contributor, "memories", bobMemory)).toBe(true);
  });

  it("gives viewers nothing and owners everything", () => {
    expect(canWriteRecord(context("viewer"), "photos", photo, true)).toBe(false);
    expect(canDeleteRecord(context("owner"), "memories", bobMemory)).toBe(true);
  });
});
