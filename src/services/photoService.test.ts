import { describe, expect, it } from "@jest/globals";
import type * as ImagePicker from "expo-image-picker";
import { CanonicalPhotoMetadataResolution } from "./photoCanonicalResolver";
import { buildPickedPhotoAsset, buildPickedPhotoAssetFromMediaLibraryAsset } from "./photoMetadataIngestion";

function makePickerAsset(
  overrides: Partial<ImagePicker.ImagePickerAsset> = {}
): ImagePicker.ImagePickerAsset {
  return {
    assetId: "asset-1",
    uri: "file:///photo.jpg",
    width: 1200,
    height: 900,
    fileName: "photo.jpg",
    type: "image",
    mimeType: "image/jpeg",
    fileSize: 1024,
    duration: null,
    base64: null,
    exif: null,
    file: undefined,
    pairedVideoAsset: undefined,
    ...overrides
  } as ImagePicker.ImagePickerAsset;
}

describe("photoService media-library metadata enrichment", () => {
  it("prefers media-library GPS when available", () => {
    const asset = makePickerAsset({
      exif: {
        GPSLatitude: "12/1, 0/1, 0/1",
        GPSLongitude: "34/1, 0/1, 0/1"
      }
    });

    const picked = buildPickedPhotoAsset(asset, {
      kind: "canonical-direct",
      assetId: "asset-1",
      metadata: {
        location: {
          latitude: 47.3769,
          longitude: 8.5417
        }
      }
    } satisfies CanonicalPhotoMetadataResolution);

    expect(picked.location).toEqual({
      latitude: 47.3769,
      longitude: 8.5417
    });
    expect(picked.importMetadata).toMatchObject({
      assetId: "asset-1",
      resolutionKind: "canonical-direct",
      locationSource: "media-library",
      pickerAssetIdPresent: true,
      pickerExifPresent: true
    });
  });

  it("falls back to picker GPS when media-library GPS is absent", () => {
    const asset = makePickerAsset({
      exif: {
        GPSLatitude: "47/1, 22/1, 3684/100",
        GPSLongitude: "8/1, 32/1, 300/10"
      }
    });

    const picked = buildPickedPhotoAsset(asset, {
      kind: "picker-fallback",
      assetId: undefined,
      metadata: undefined
    } satisfies CanonicalPhotoMetadataResolution);

    expect(picked.location).toEqual({
      latitude: 47.3769,
      longitude: 8.541666666666666
    });
    expect(picked.importMetadata?.locationSource).toBe("picker");
    expect(picked.importMetadata?.resolutionKind).toBe("picker-fallback");
    expect(picked.importMetadata?.pickerExifPresent).toBe(true);
  });

  it("uses media-library metadata when picker metadata is absent", () => {
    const asset = makePickerAsset({
      assetId: "asset-2",
      exif: null
    });

    const picked = buildPickedPhotoAsset(asset, {
      kind: "canonical-direct",
      assetId: "asset-2",
      metadata: {
        location: {
          latitude: 34.0522,
          longitude: -118.2437
        },
        creationTime: 1710000000000
      }
    } satisfies CanonicalPhotoMetadataResolution);

    expect(picked.location).toEqual({
      latitude: 34.0522,
      longitude: -118.2437
    });
    expect(picked.capturedAt).toBe("2024-03-09T16:00:00.000Z");
    expect(picked.importMetadata).toMatchObject({
      assetId: "asset-2",
      resolutionKind: "canonical-direct",
      locationSource: "media-library",
      capturedAtSource: "media-library",
      pickerAssetIdPresent: true,
      pickerExifPresent: false
    });
  });

  it("keeps invalid GPS undefined instead of falling back to 0,0", () => {
    const asset = makePickerAsset({
      exif: {
        GPSLatitude: "0/1, 0/1, 0/1",
        GPSLongitude: "0/1, 0/1, 0/1"
      }
    });

    const picked = buildPickedPhotoAsset(asset, {
      kind: "canonical-direct",
      assetId: "asset-1",
      metadata: {
        location: {
          latitude: 0,
          longitude: 0
        }
      }
    } satisfies CanonicalPhotoMetadataResolution);

    expect(picked.location).toBeUndefined();
    expect(picked.importMetadata?.locationSource).toBeUndefined();
    expect(picked.importMetadata?.pickerAssetIdPresent).toBe(true);
  });

  it("records when the picker result had no assetId at selection time", () => {
    const asset = makePickerAsset({
      assetId: null,
      exif: {
        DateTimeOriginal: "2026:04:18 11:52:54"
      }
    });

    const picked = buildPickedPhotoAsset(asset);

    expect(picked.importMetadata).toMatchObject({
      assetId: undefined,
      pickerAssetIdPresent: false,
      pickerExifPresent: true
    });
    expect(picked.importMetadata?.pickerKeySample).toContain("assetId");
  });

  it("builds a picked photo asset directly from a Media Library asset while preserving asset identity", () => {
    const picked = buildPickedPhotoAssetFromMediaLibraryAsset(
      {
        id: "media-asset-1",
        uri: "file:///media.jpg",
        filename: "media.jpg",
        width: 2000,
        height: 1500,
        creationTime: 1710000000000
      },
      {
        location: {
          latitude: 47.3769,
          longitude: 8.5417
        },
        creationTime: 1710000000000
      }
    );

    expect(picked.location).toEqual({
      latitude: 47.3769,
      longitude: 8.5417
    });
    expect(picked.importMetadata).toMatchObject({
      assetId: "media-asset-1",
      resolutionKind: "canonical-direct",
      capturedAtSource: "media-library",
      locationSource: "media-library"
    });
  });
});
