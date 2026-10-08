import { buildLayoutDocument, buildLayoutPage } from "./engine";
import { droppedPhoto, unlockPage, bookOrder, snapRotation, stepLayer } from "./freestyle";
import { listAllTemplates } from "./templates";
import { applySlotOverridesToPage } from "./overrides";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { getPreviewCenterPoint, resolveDropAction } from "../editor/drag/dragController";

jest.mock("./templates", () => {
  Object.assign(globalThis, { __DEV__: false });
  return jest.requireActual("./templates");
});
const memory: Memory = { id: "m", projectId: "p", title: "Trip", kind: "event", status: "active", order: 0, createdAt: "", updatedAt: "" };
const photos: PhotoItem[] = [1, 2, 3, 4].map(n => ({ id: `p${n}`, memoryId: "m", projectId: "p", uri: `file://${n}.jpg`, addedAt: String(n), capturedAt: "" }));
const section: MemoryPageSection = { id: "page", memoryId: "m", order: 0, photoIds: photos.map(p => p.id), backgroundAssetId: "keep-background" };

it("unlocks the applied page without losing crop, assignment, background or anchored text position", () => {
  const initial = buildLayoutPage(memory, section, photos, 0, 1);
  const slot = initial.slots[0];
  initial.textBoxes = [{ id: "text", text: "Hello", anchorSlotId: slot.id, x: 0, y: 0, width: .2, height: .2 }];
  const applied = applySlotOverridesToPage(initial, { [slot.id]: { photoScale: 1.8, photoOffsetX: .1, x: .15 } });
  const free = unlockPage(section, applied);
  expect(free.freestyleSlots).toEqual(applied.slots);
  expect(free.backgroundAssetId).toBe(section.backgroundAssetId);
  expect(free.textBoxes?.[0]).toMatchObject({ ...applied.slots[0].frame, anchorSlotId: undefined });
  expect(buildLayoutPage(memory, free, photos, 0, 1).slots).toEqual(applied.slots);
});

it("places new photos at the release position and clamps them to the page", () => {
  expect(droppedPhoto("p1", .5, .5, "free", 4).frame).toEqual({ x: .325, y: .325, width: .35, height: .35 });
  expect(droppedPhoto("p1", 2, -1, "free", 4).frame).toMatchObject({ x: .65, y: 0 });
});

it("keeps manually shaped and rotated frames when locked and respects removed photos", () => {
  const slot = { ...droppedPhoto("p1", .5, .5, "free", 4), rotation: 35, shape: "heart" as const };
  const free = { ...section, templateId: "freestyle", layoutLocked: true, freestyleSlots: [slot] };
  expect(buildLayoutPage(memory, free, photos, 0, 1).slots[0]).toEqual(slot);
  expect(buildLayoutPage(memory, { ...free, photoIds: [] }, [], 0, 1).slots[0].photoId).toBeUndefined();
});

it("fits four freestyle photos into three template slots while retaining the extra source photo", () => {
  const template = listAllTemplates().find(t => t.photoCount === 3)!;
  const page = buildLayoutPage(memory, { ...section, templateId: template.id }, photos, 0, 1);
  expect(page.slots.filter(slot => slot.photoId)).toHaveLength(3);
  expect(photos.filter(photo => !page.slots.some(slot => slot.photoId === photo.id))).toHaveLength(1);
});

it("keeps covers and dedication at book boundaries regardless of ordinary memory order", () => {
  const memories = [memory, { ...memory, id: "back", bookRole: "back-cover" as const, order: -10 }, { ...memory, id: "front", bookRole: "front-cover" as const, order: 20 }, { ...memory, id: "dedication", bookRole: "dedication" as const, order: 30 }];
  expect([...memories].sort(bookOrder).map(m => m.id)).toEqual(["front", "dedication", "m", "back"]);
  const project = { id: "p", name: "Book" } as Project;
  expect(buildLayoutDocument(project, memories, {}).pages.map(p => p.memoryId)).toEqual(["front", "dedication", "m", "back"]);
});

it("accepts gallery drops on the freestyle canvas without changing locked slot drops", () => {
  const payload = { dragType: "gallery-photo" as const, itemId: "p1", sourceRect: { x: 0, y: 0, width: 10, height: 10 }, previewData: { kind: "photo" as const, uri: "file://1.jpg" } };
  const target = { id: "canvas", targetType: "page-canvas" as const, rect: payload.sourceRect, priority: 20, targetPageId: "page" };
  expect(resolveDropAction(payload, target)).toMatchObject({ action: "add-freestyle", photoId: "p1", targetPageId: "page" });
  expect(resolveDropAction(payload, { ...target, targetType: "page-slot", targetSlotId: "s" })).toMatchObject({ action: "add-to-page", targetSlotId: "s" });
});

it("snaps rotation near right angles and normalizes wraparound", () => {
  expect(snapRotation(88)).toBe(90);
  expect(snapRotation(359)).toBe(0);
  expect(snapRotation(38)).toBe(38);
});

it("moves only one layer forwards or backwards, stopping at the boundaries", () => {
  const layers = ["photo A", "text", "photo B", "emoji"];
  expect(stepLayer(layers, 0, true)).toEqual(["text", "photo A", "photo B", "emoji"]);
  expect(stepLayer(layers, 2, false)).toEqual(["photo A", "photo B", "text", "emoji"]);
  expect(stepLayer(layers, 0, false)).toEqual(layers);
  expect(stepLayer(layers, 3, true)).toEqual(layers);
});

it("uses the dragged preview center when the finger grabs a photo off-center", () => {
  const payload = { dragType: "gallery-photo" as const, itemId: "p1", sourceRect: { x: 0, y: 0, width: 80, height: 80 }, previewData: { kind: "photo" as const, uri: "file://1.jpg" } };
  const center = getPreviewCenterPoint(payload, { x: 150, y: 160 }, { x: 10, y: 20 });
  expect(center).toEqual({ x: 180, y: 180 });
  const frame = droppedPhoto("p1", center.x / 400, center.y / 400, "slot", 2).frame;
  expect((frame.x + frame.width / 2) * 400).toBeCloseTo(center.x);
  expect((frame.y + frame.height / 2) * 400).toBeCloseTo(center.y);
});
