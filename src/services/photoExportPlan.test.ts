import { buildPhotoExportPlan, safeExportName, uniqueExportFilename } from "./photoExportPlan";
import { Memory, MemoryPageSection, PhotoItem } from "../types";

const memory = (id: string, title: string, order = 0): Memory => ({ id, title, order, projectId: "project", kind: "event", status: "active", createdAt: "", updatedAt: "" });
const photo = (id: string, memoryId?: string): PhotoItem => ({ id, memoryId, projectId: "project", uri: `file:///${id}.jpg`, addedAt: "", capturedAt: "" });

it("exports unused photos and unnamed pages directly under the memory", () => {
  const sections: MemoryPageSection[] = [{ id: "page", memoryId: "memory", order: 0, photoIds: ["one"], exportToFolder: false, exportFolderName: "Hidden title" }];
  const plan = buildPhotoExportPlan([memory("memory", "Trip")], [photo("one", "memory"), photo("unused", "memory"), photo("legacy")], sections, {});
  expect(plan.map((entry) => [entry.photo.id, entry.folder])).toEqual([["one", "Trip"], ["unused", "Trip"], ["legacy", "Other photos"]]);
});

it("uses actual page assignments and disambiguates duplicate memory and page names", () => {
  const sections: MemoryPageSection[] = [0, 1].map((order) => ({ id: `page${order}`, memoryId: "a", order, photoIds: ["old"], exportToFolder: true, exportFolderName: "Beach" }));
  const plan = buildPhotoExportPlan([memory("a", "Trip"), memory("b", "trip", 1)], [photo("new", "a"), photo("old", "a"), photo("b", "b")], sections, { page0: ["new"], page1: ["new"] });
  expect(plan.map((entry) => [entry.photo.id, entry.folder])).toEqual([["new", "Trip/Beach"], ["new", "Trip/Beach (2)"], ["old", "Trip"], ["b", "trip (2)"]]);
});

it("uses a safe fallback when the toggle is on but no folder name was entered", () => {
  const plan = buildPhotoExportPlan([memory("m", "...")], [photo("p", "m")], [{ id: "page", memoryId: "m", order: 1, photoIds: ["p"], exportToFolder: true }], {});
  expect(plan[0].folder).toBe("Memory/Page 2");
  expect(safeExportName("../Summer\\Trip:2026", "Memory")).toBe("-Summer-Trip-2026");
  expect(safeExportName("CON", "Memory")).toBe("_CON");
});

it("keeps photo files distinct from folders and the export report", () => {
  expect(uniqueExportFilename("Camera.jpg", new Set(["camera.jpg"]))).toBe("Camera (2).jpg");
  const plan = buildPhotoExportPlan([memory("m", "export-report.json")], [photo("p", "m")], [], {});
  expect(plan[0].folder).toBe("export-report.json (2)");
});
