import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { exportProjectPhotosToZip } from "./photoZipExportService";
import { Memory, PhotoItem, Project } from "../types";
import { buildLayoutDocument } from "../layout/engine";

jest.mock("../layout/engine", () => {
  Object.assign(globalThis, { __DEV__: false });
  return jest.requireActual("../layout/engine");
});

jest.mock("expo-file-system", () => {
  const files = new Map<string, Uint8Array>();
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((p) => typeof p === "string" ? p : p.uri).join("/"); }
    create() {}
  }
  class File extends Directory {
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    create() { files.set(this.uri, new Uint8Array()); }
    delete() { files.delete(this.uri); }
    open() {
      let offset = 0;
      const uri = this.uri;
      return {
        close() {},
        readBytes(size: number) { const result = files.get(uri)!.slice(offset, offset + size); offset += result.length; return result; },
        writeBytes(bytes: Uint8Array) {
          const old = files.get(uri)!;
          const next = new Uint8Array(old.length + bytes.length);
          next.set(old); next.set(bytes, old.length); files.set(uri, next);
        }
      };
    }
  }
  return { File, Directory, Paths: { cache: "file:///cache" }, testFiles: files };
});
jest.mock("expo-file-system/legacy", () => ({ copyAsync: jest.fn(async () => { throw new Error("unreadable content URI"); }) }));
jest.mock("expo-media-library", () => ({ getPermissionsAsync: jest.fn(), getAssetInfoAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const files = (FileSystem as unknown as { testFiles: Map<string, Uint8Array> }).testFiles;
const project: Project = { id: "project", name: "Summer", projectType: "yearbook", timelineMode: "ongoing", includeFutureProjectPhotos: true, assistLevel: "balanced", styleIntensity: "warm", finalizationStatus: "idle", createdAt: "", updatedAt: "" };
const memory: Memory = { id: "memory", projectId: "project", title: "Beach", kind: "event", status: "active", order: 0, createdAt: "", updatedAt: "" };
const photo: PhotoItem = { id: "photo", projectId: "project", memoryId: "memory", uri: "file:///stored.jpg", capturedAt: "2026-01-01", addedAt: "2026-01-01", importMetadata: { assetId: "asset" } };
const original = Uint8Array.from([0xff, 0xd8, 19, 23, 44, 57, 77, 0xff, 0xd9]);
const stored = Uint8Array.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);

beforeEach(() => {
  files.clear(); jest.clearAllMocks();
  files.set(photo.uri, stored);
  (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValue({ localUri: "file:///original.jpg", filename: "Camera.jpg" });
});

it("exports the original bytes when accessible, never the compressed stored copy", async () => {
  files.set("file:///original.jpg", original);
  const result = await exportProjectPhotosToZip(project, [memory], [photo], [], {});
  const zip = Buffer.from(files.get(result.uri)!);
  expect(zip.includes(Buffer.from(original))).toBe(true);
  expect(zip.includes(Buffer.from(stored))).toBe(false);
  expect(result).toMatchObject({ exported: 1, storedCopies: 0, missing: 0 });
  expect(MediaLibrary.getAssetInfoAsync).toHaveBeenCalledWith("asset", { shouldDownloadFromNetwork: false });
});

it("falls back to stored files and reports missing files without losing the rest", async () => {
  const result = await exportProjectPhotosToZip(project, [memory], [photo, { ...photo, id: "missing", uri: "file:///gone.jpg" }], [], {});
  expect(Buffer.from(files.get(result.uri)!).includes(Buffer.from(stored))).toBe(true);
  expect(result).toMatchObject({ exported: 1, storedCopies: 1, missing: 1 });
  expect(Buffer.from(files.get(result.uri)!).toString()).toContain("export-report.json");
});

it("exports stored files without library permission and leaves no archive if all files are missing", async () => {
  (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  const result = await exportProjectPhotosToZip(project, [memory], [photo], [], {});
  expect(result.storedCopies).toBe(1);
  expect(MediaLibrary.getAssetInfoAsync).not.toHaveBeenCalled();
  files.clear();
  await expect(exportProjectPhotosToZip(project, [memory], [photo], [], {})).rejects.toThrow("None of the project's photos");
  expect([...files.keys()].filter((name) => name.endsWith(".zip"))).toEqual([]);
});

it("only exports photos actually on pages, respecting editor replacements", async () => {
  const replacement = { ...photo, id: "replacement", uri: "file:///replacement.jpg" };
  files.set(replacement.uri, original);
  const sections = [{ id: "page", memoryId: memory.id, order: 0, photoIds: [photo.id], exportToFolder: true, exportFolderName: "First page" }];
  const document = buildLayoutDocument(project, [memory], { [memory.id]: [photo, replacement] }, { [memory.id]: sections });
  const slotId = document.pages[0].slots[0].id;
  const overrides = { page: { [slotId]: { photoId: replacement.id } } };
  const result = await exportProjectPhotosToZip(project, [memory], [photo, replacement], sections, overrides, undefined, false);
  expect(result.exported).toBe(1);
  const zip = Buffer.from(files.get(result.uri)!);
  expect(zip.includes(Buffer.from(original))).toBe(true);
  expect(zip.includes(Buffer.from(stored))).toBe(false);
  expect(zip.toString()).toContain("Beach/First page/Photo-replacement.jpg");
  const all = await exportProjectPhotosToZip(project, [memory], [photo, replacement], sections, overrides, undefined, true);
  expect(all.exported).toBe(2);
});

it("explains an empty placed-only export instead of silently including unplaced photos", async () => {
  await expect(exportProjectPhotosToZip(project, [memory], [photo], [{ id: "page", memoryId: memory.id, order: 0, photoIds: [] }], {}, undefined, false))
    .rejects.toThrow("no photos placed on pages");
});
