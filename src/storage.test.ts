import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { loadAppData, saveAppData } from "./storage";
import { AppData } from "./types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
}));

const mockedStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

describe("storage Milestone 2 foundations", () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset();
    mockedStorage.setItem.mockReset();
    mockedStorage.removeItem.mockReset();
  });

  it("normalizes legacy saved data and preserves unassigned project photos", async () => {
    (mockedStorage.getItem as jest.Mock).mockImplementation(async () =>
      JSON.stringify({
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
      })
    );

    const data = await loadAppData();

    expect(data.projects[0]).toMatchObject({
      id: "project-1",
      projectType: "general",
      timelineMode: "ongoing",
      includeFutureProjectPhotos: true,
      assistLevel: "balanced",
      styleIntensity: "warm"
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

    await saveAppData(data);

    expect(mockedStorage.setItem).toHaveBeenCalledTimes(1);
    const [, persistedRaw] = mockedStorage.setItem.mock.calls[0] as [string, string];
    const persisted = JSON.parse(persistedRaw) as AppData;

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
  });
});
