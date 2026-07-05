import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Project } from "../types";
import { scanMediaLibrarySuggestionsForProject } from "./librarySuggestionScanner";

const mockGetPermissionsAsync: any = jest.fn();
const mockRequestPermissionsAsync: any = jest.fn();
const mockGetAssetsAsync: any = jest.fn();
const mockGetAssetInfoAsync: any = jest.fn();

jest.mock("expo-media-library", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getAssetsAsync: (...args: unknown[]) => mockGetAssetsAsync(...args),
  getAssetInfoAsync: (...args: unknown[]) => mockGetAssetInfoAsync(...args),
  MediaType: { photo: "photo" },
  SortBy: { creationTime: "creationTime" }
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Trip",
    projectType: "vacation",
    timelineMode: "past",
    includeFutureProjectPhotos: false,
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    assistLevel: "balanced",
    styleIntensity: "warm",
    finalizationStatus: "idle",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides
  };
}

function makeAsset(id: string, capturedAt: string) {
  const creationTime = Date.parse(capturedAt);
  return {
    id,
    uri: `file:///${id}.jpg`,
    filename: `${id}.jpg`,
    width: 1600,
    height: 1200,
    creationTime,
    modificationTime: creationTime,
    mediaType: "photo",
    duration: 0
  };
}

describe("scanMediaLibrarySuggestionsForProject", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockGetAssetsAsync.mockReset();
    mockGetAssetInfoAsync.mockReset();
  });

  it("scans project date bounds and produces event suggestions with temporary media-library refs", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true
    });
    const assets = [
      makeAsset("asset-1", "2026-04-10T10:00:00.000Z"),
      makeAsset("asset-2", "2026-04-10T10:45:00.000Z"),
      makeAsset("asset-3", "2026-04-10T11:30:00.000Z")
    ];
    mockGetAssetsAsync.mockResolvedValue({
      assets,
      hasNextPage: false,
      endCursor: undefined,
      totalCount: assets.length
    });
    mockGetAssetInfoAsync.mockImplementation(async (assetId: string) => {
      const asset = assets.find((item) => item.id === assetId);
      return {
        ...asset,
        location: {
          latitude: 47.371,
          longitude: 8.541
        }
      };
    });

    const result = await scanMediaLibrarySuggestionsForProject(makeProject());

    expect(mockGetAssetsAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "photo",
        createdAfter: Date.parse("2026-04-10T00:00:00.000Z"),
        createdBefore: Date.parse("2026-04-12T23:59:59.999Z")
      })
    );
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      projectId: "project-1",
      type: "event",
      status: "new",
      candidatePhotoIds: ["media-library:asset-1", "media-library:asset-2", "media-library:asset-3"]
    });
    expect(result.suggestions[0]?.candidatePhotoRefs?.map((ref) => ref.assetId)).toEqual([
      "asset-1",
      "asset-2",
      "asset-3"
    ]);
    expect(result.locatedAssetCount).toBe(3);
  });

  it("excludes already imported media-library assets from scan candidates", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true
    });
    const assets = [
      makeAsset("asset-1", "2026-04-10T10:00:00.000Z"),
      makeAsset("asset-2", "2026-04-10T10:45:00.000Z"),
      makeAsset("asset-3", "2026-04-10T11:30:00.000Z")
    ];
    mockGetAssetsAsync.mockResolvedValue({
      assets,
      hasNextPage: false,
      endCursor: undefined,
      totalCount: assets.length
    });
    mockGetAssetInfoAsync.mockImplementation(async (assetId: string) => assets.find((item) => item.id === assetId));

    const result = await scanMediaLibrarySuggestionsForProject(makeProject(), {
      excludeAssetIds: ["asset-2"]
    });

    expect(result.candidateAssetCount).toBe(2);
    expect(result.suggestions).toHaveLength(0);
  });

  it("requires media-library permission", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "denied",
      canAskAgain: false
    });
    mockRequestPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "denied",
      canAskAgain: false
    });

    await expect(scanMediaLibrarySuggestionsForProject(makeProject())).rejects.toThrow(
      "Photo library permission was not granted."
    );
    expect(mockGetAssetsAsync).not.toHaveBeenCalled();
  });
});
