import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createFakeSqlDriver, FakeSqlDriver } from "./test/fakeSqlDriver";
import { AppData } from "./types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
}));

// The SQLite file lives as long as mockDriver: tests that "relaunch" the app
// get a fresh storage module (fresh in-memory caches) over the same database.
let mockDriver: FakeSqlDriver;
jest.mock("./data/expoSqliteDriver", () => ({ openExpoSqliteDriver: async () => mockDriver }));

type StorageModule = typeof import("./storage");
type StorageMock = { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };

let storage: StorageModule;
let mockedStorage: StorageMock;
let blob: string | null;

function launchApp() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mockedStorage = require("@react-native-async-storage/async-storage").default as StorageMock;
  mockedStorage.getItem.mockImplementation(async () => blob);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  storage = require("./storage") as StorageModule;
  const { loadAppData, saveAppData, AppDataLoadError } = storage;
  return { loadAppData, saveAppData, AppDataLoadError };
}

const empty: AppData = { projects: [], memories: [], pageSections: [], photos: [], suggestions: [] };

beforeEach(() => {
  mockDriver = createFakeSqlDriver();
  blob = null;
});

it("persists hidden ZIP folder settings on pages", async () => {
  const data: AppData = { projects: [], memories: [], photos: [], suggestions: [], pageSections: [
    { id: "page", memoryId: "memory", order: 0, photoIds: [], exportToFolder: true, exportFolderName: "Beach photos" }
  ] };
  const first = launchApp();
  await first.loadAppData();
  await first.saveAppData(data);
  expect((await launchApp().loadAppData()).pageSections[0]).toEqual(data.pageSections[0]);
});

it("round-trips freestyle geometry, text shapes, stickers and cover roles", async () => {
  const data: AppData = { projects: [], memories: [{ id: "cover", projectId: "project", title: "Front cover", bookRole: "front-cover", kind: "event", status: "active", order: 0, createdAt: "", updatedAt: "" }], photos: [], suggestions: [], pageSections: [
    { id: "page", memoryId: "cover", order: 0, photoIds: [], templateId: "freestyle", layoutLocked: true, freestyleSlots: [{ id: "frame", role: "photo", fitMode: "cover", photoScale: 1, photoOffsetX: 0, photoOffsetY: 0, rotation: 35, zIndex: 4, shape: "heart", frame: { x: .1, y: .2, width: .3, height: .4 } }], textBoxes: [{ id: "sticker", text: "😊", sticker: true, rotation: 10, zIndex: 5, shape: "thought", x: .1, y: .1, width: .2, height: .2 }] }
  ] };
  const first = launchApp();
  await first.loadAppData();
  await first.saveAppData(data);
  const loaded = await launchApp().loadAppData();
  expect(loaded.pageSections).toEqual(data.pageSections);
  expect(loaded.memories[0].bookRole).toBe("front-cover");
});

describe("storage Milestone 2 foundations", () => {
  it("normalizes legacy saved data and preserves unassigned project photos", async () => {
    blob = JSON.stringify({
        projects: [
          {
            id: "project-1",
            name: "Trip",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z"
          }
        ],
        memories: [
          {
            id: "memory-1",
            projectId: "project-1",
            title: "Beach Day",
            order: 0,
            createdAt: "2024-01-02T00:00:00.000Z",
            updatedAt: "2024-01-02T00:00:00.000Z"
          }
        ],
        pageSections: [],
        photos: [
          {
            id: "photo-memory",
            memoryId: "memory-1",
            uri: "file:///memory.jpg",
            capturedAt: "2024-01-02T10:00:00.000Z",
            addedAt: "2024-01-10T10:00:00.000Z",
            exportDataUri: "data:image/png;base64,abc"
          },
          {
            id: "photo-project",
            projectId: "project-1",
            uri: "file:///project.jpg",
            capturedAt: "2024-01-03T10:00:00.000Z",
            addedAt: "2024-01-10T10:00:00.000Z",
            analysis: {
              analysisVersion: 1,
              sceneTags: [" beach ", ""],
              localOnly: {
                privateFaceDataRef: " local-face-ref "
              }
            }
          }
        ],
        suggestions: [
          {
            id: "suggestion-1",
            projectId: "project-1",
            message: "",
            candidatePhotoIds: null
          }
        ]
      });

    const data = await launchApp().loadAppData();

    expect(data.projects[0]).toMatchObject({
      id: "project-1",
      projectType: "general",
      timelineMode: "ongoing",
      includeFutureProjectPhotos: true,
      assistLevel: "balanced",
      styleIntensity: "warm",
      finalizationStatus: "idle"
    });
    expect(data.memories[0]).toMatchObject({
      id: "memory-1",
      kind: "event",
      status: "active"
    });
    expect(data.photos).toHaveLength(2);
    expect(data.photos.find((photo) => photo.id === "photo-memory")).toMatchObject({
      id: "photo-memory",
      projectId: "project-1",
      memoryId: "memory-1"
    });
    expect(data.photos.find((photo) => photo.id === "photo-project")).toMatchObject({
      id: "photo-project",
      projectId: "project-1",
      memoryId: undefined,
      analysis: {
        analysisVersion: 1,
        sceneTags: ["beach"],
        localOnly: {
          privateFaceDataRef: "local-face-ref"
        }
      }
    });
    expect("exportDataUri" in (data.photos[0] as Record<string, unknown>)).toBe(false);
    expect(data.suggestions[0]).toMatchObject({
      id: "suggestion-1",
      type: "event",
      status: "new",
      title: "Untitled suggestion",
      candidatePhotoIds: []
    });

    // The migrated copy reads back identically on the next launch, and the
    // AsyncStorage blob is left untouched as a backup.
    expect(await launchApp().loadAppData()).toEqual(data);
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
    expect(mockedStorage.removeItem).not.toHaveBeenCalled();
  });

  it("strips export data when saving persisted project-photo-pool data", async () => {
    const data: AppData = {
      projects: [],
      memories: [],
      pageSections: [],
      photos: [
        {
          id: "photo-1",
          projectId: "project-1",
          uri: "file:///photo.jpg",
          exportDataUri: "data:image/jpeg;base64,abc",
          capturedAt: "2024-01-01T00:00:00.000Z",
          addedAt: "2024-01-01T00:00:00.000Z",
          analysis: {
            analysisVersion: 2,
            quality: {
              qualityScore: 0.77
            },
            safeExternalTags: ["travel"]
          }
        }
      ],
      suggestions: []
    };

    const { loadAppData, saveAppData } = launchApp();
    await loadAppData();
    await saveAppData(data);

    const rows = mockDriver.rows("photos");
    expect(rows).toHaveLength(1);
    const persisted = { photos: rows.map((row) => JSON.parse(row.data as string)) } as AppData;

    expect(persisted.photos[0]).toMatchObject({
      id: "photo-1",
      projectId: "project-1",
      uri: "file:///photo.jpg",
      analysis: {
        analysisVersion: 2,
        quality: {
          qualityScore: 0.77
        },
        safeExternalTags: ["travel"]
      }
    });
    expect("exportDataUri" in (persisted.photos[0] as Record<string, unknown>)).toBe(false);
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("loading never erases saved data", () => {
  it("starts empty on a fresh install", async () => {
    await expect(launchApp().loadAppData()).resolves.toEqual(empty);
  });

  it("reports an unreadable row instead of deleting it", async () => {
    const { loadAppData, saveAppData, AppDataLoadError } = launchApp();
    mockedStorage.getItem.mockImplementation(async () => {
      throw new Error("Row too big to fit into CursorWindow");
    });
    await expect(loadAppData()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(mockedStorage.removeItem).not.toHaveBeenCalled();
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
    // Saving stays refused, so an empty in-memory state cannot overwrite anything.
    await expect(saveAppData(empty)).rejects.toThrow();
    expect(mockDriver.rows("projects")).toEqual([]);
  });

  it("reports corrupt JSON instead of returning empty data", async () => {
    blob = '{"projects": [';
    const { loadAppData, AppDataLoadError } = launchApp();
    await expect(loadAppData()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(mockedStorage.removeItem).not.toHaveBeenCalled();
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
  });

  it("reports a corrupt database row instead of dropping it", async () => {
    blob = JSON.stringify({ projects: [{ id: "project-1", name: "Trip", createdAt: "t", updatedAt: "t" }] });
    await launchApp().loadAppData();
    mockDriver.tables.get("projects")!.rows.get("project-1")!.data = "{";
    const { loadAppData, AppDataLoadError } = launchApp();
    await expect(loadAppData()).rejects.toBeInstanceOf(AppDataLoadError);
    expect(mockDriver.rows("projects")).toHaveLength(1);
    expect(mockedStorage.removeItem).not.toHaveBeenCalled();
  });
});
