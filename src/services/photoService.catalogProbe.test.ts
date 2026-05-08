import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getRecentMediaLibraryPhotoChoicesWithProbe, pickImagesFromLibrary } from "./photoService";

const mockGetPermissionsAsync: any = jest.fn();
const mockRequestPermissionsAsync: any = jest.fn();
const mockGetAssetsAsync: any = jest.fn();
const mockGetAssetInfoAsync: any = jest.fn();
const mockRequestMediaLibraryPermissionsAsync: any = jest.fn();
const mockLaunchImageLibraryAsync: any = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn()
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args)
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: "balanced" }
}));

jest.mock("expo-media-library", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getAssetsAsync: (...args: unknown[]) => mockGetAssetsAsync(...args),
  getAssetInfoAsync: (...args: unknown[]) => mockGetAssetInfoAsync(...args),
  MediaType: { photo: "photo" },
  SortBy: { creationTime: "creationTime" }
}));

describe("getRecentMediaLibraryPhotoChoicesWithProbe", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockGetAssetsAsync.mockReset();
    mockGetAssetInfoAsync.mockReset();
    mockRequestMediaLibraryPermissionsAsync.mockReset();
    mockLaunchImageLibraryAsync.mockReset();
  });

  it("returns permission diagnostics when media access is blocked", async () => {
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

    const result = await getRecentMediaLibraryPhotoChoicesWithProbe();

    expect(result.choices).toEqual([]);
    expect(result.probe).toMatchObject({
      permissionStatus: "denied",
      permissionGranted: false,
      canAskAgain: false,
      requestAttempted: true,
      requestGranted: false,
      queryAttempted: false,
      returnedCount: 0
    });
  });

  it("returns query diagnostics when recent media-library assets are available", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true
    });
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        {
          id: "asset-1",
          uri: "file:///asset-1.jpg",
          filename: "asset-1.jpg",
          width: 1000,
          height: 800,
          creationTime: 1710000000000
        }
      ],
      totalCount: 42,
      hasNextPage: true,
      endCursor: "cursor-1"
    });

    const result = await getRecentMediaLibraryPhotoChoicesWithProbe(12);

    expect(mockGetAssetsAsync).toHaveBeenCalledWith({
      first: 12,
      mediaType: "photo",
      sortBy: ["creationTime"]
    });
    expect(result.choices).toEqual([
      {
        id: "asset-1",
        uri: "file:///asset-1.jpg",
        filename: "asset-1.jpg",
        width: 1000,
        height: 800,
        creationTime: 1710000000000
      }
    ]);
    expect(result.probe).toMatchObject({
      permissionStatus: "granted",
      permissionGranted: true,
      canAskAgain: true,
      requestAttempted: false,
      requestGranted: true,
      queryAttempted: true,
      returnedCount: 1,
      totalCount: 42,
      hasNextPage: true,
      endCursor: "cursor-1"
    });
  });

  it("requests the next media-library page when an after cursor is provided", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true
    });
    mockGetAssetsAsync.mockResolvedValue({
      assets: [],
      totalCount: 42,
      hasNextPage: false,
      endCursor: undefined
    });

    await getRecentMediaLibraryPhotoChoicesWithProbe(60, "cursor-1");

    expect(mockGetAssetsAsync).toHaveBeenCalledWith({
      first: 60,
      after: "cursor-1",
      mediaType: "photo",
      sortBy: ["creationTime"]
    });
  });

  it("recovers a canonical media-library asset for picker imports that arrive without assetId", async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true
    });
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true
    });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          assetId: null,
          uri: "file:///picker-photo.jpg",
          width: 2268,
          height: 4032,
          fileName: "IMG_12058.jpg",
          type: "image",
          mimeType: "image/jpeg",
          fileSize: 2048,
          duration: null,
          base64: null,
          exif: {
            DateTimeOriginal: "2026:04:18 15:19:19"
          }
        }
      ]
    });
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        {
          id: "12058",
          uri: "file:///media-photo.jpg",
          filename: "IMG_12058.jpg",
          width: 2268,
          height: 4032,
          creationTime: Date.parse("2026-04-18T15:19:19.000Z")
        }
      ],
      totalCount: 1
    });
    mockGetAssetInfoAsync.mockResolvedValue({
      id: "12058",
      uri: "file:///media-photo.jpg",
      filename: "IMG_12058.jpg",
      width: 2268,
      height: 4032,
      creationTime: Date.parse("2026-04-18T15:19:19.000Z"),
      location: {
        latitude: 47.33109,
        longitude: 8.60188
      },
      exif: {
        DateTimeOriginal: "2026:04:18 15:19:19",
        GPSLatitude: "47/1, 19/1, 519/100",
        GPSLongitude: "8/1, 36/1, 68/100"
      }
    });

    const picked = await pickImagesFromLibrary();

    expect(mockGetAssetsAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 200,
        mediaType: "photo",
        sortBy: ["creationTime"]
      })
    );
    const mediaQuery = mockGetAssetsAsync.mock.calls[0]?.[0];
    expect(typeof mediaQuery?.createdAfter).toBe("number");
    expect(typeof mediaQuery?.createdBefore).toBe("number");
    expect(mediaQuery.createdBefore).toBeGreaterThan(mediaQuery.createdAfter);
    expect(mockGetAssetInfoAsync).toHaveBeenCalledWith("12058");
    expect(picked).toHaveLength(1);
    expect(picked[0]?.location).toEqual({
      latitude: 47.33109,
      longitude: 8.60188
    });
    expect(picked[0]?.importMetadata).toMatchObject({
      assetId: "12058",
      resolutionKind: "canonical-recovered",
      pickerAssetIdPresent: false,
      pickerExifPresent: true,
      locationSource: "media-library",
      capturedAtSource: "media-library"
    });
  });
});
