import { NativeModules } from "react-native";
import { normalizePhotoLocation } from "../lib/photoLocation";
import type { PhotoItem } from "../types";
import type { PickedPhotoAsset } from "./photoMetadataIngestion";
import type { AndroidPhotoPickerOptions, AndroidPhotoPickerResult } from "./androidPhotoPicker";

type NativeAndroidPhotoPickerAsset = {
  uri?: unknown;
  fileName?: unknown;
  width?: unknown;
  height?: unknown;
  location?: unknown;
  metadataDebug?: unknown;
};

type YearbookPhotoPickerModule = {
  pickImages(options: AndroidPhotoPickerOptions): Promise<NativeAndroidPhotoPickerAsset[]>;
};

const nativeModule = NativeModules.YearbookPhotoPicker as YearbookPhotoPickerModule | undefined;

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeNativeLocation(value: unknown): PhotoItem["location"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const location = value as { latitude?: unknown; longitude?: unknown };
  return normalizePhotoLocation({
    latitude: Number(location.latitude),
    longitude: Number(location.longitude)
  });
}

function normalizeMetadataDebug(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => {
      if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
        return `${key}:${rawValue}`;
      }
      return undefined;
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 20);
}

function normalizePickedAsset(asset: NativeAndroidPhotoPickerAsset): PickedPhotoAsset | undefined {
  if (typeof asset?.uri !== "string" || !asset.uri.trim()) {
    return undefined;
  }
  const location = normalizeNativeLocation(asset.location);
  const metadataDebug = normalizeMetadataDebug(asset.metadataDebug);
  return {
    uri: asset.uri,
    fileName: typeof asset.fileName === "string" && asset.fileName.trim() ? asset.fileName : undefined,
    width: normalizeNumber(asset.width),
    height: normalizeNumber(asset.height),
    location,
    importMetadata: {
      resolutionKind: "picker-fallback",
      locationSource: location ? "picker" : undefined,
      pickerAssetIdPresent: false,
      pickerExifPresent: Boolean(location),
      pickerKeySample: ["android-photo-picker", ...metadataDebug]
    }
  };
}

export async function pickImagesWithAndroidPhotoPicker(
  options: AndroidPhotoPickerOptions = {}
): Promise<AndroidPhotoPickerResult> {
  const searchQuery = options.searchQuery?.trim();
  if (!nativeModule) {
    return {
      available: false,
      assets: [],
      highlighted: false,
      error: "YearbookPhotoPicker native module is not available."
    };
  }

  try {
    const assets = await nativeModule.pickImages({
      selectionLimit: options.selectionLimit,
      searchQuery
    });
    return {
      available: true,
      assets: Array.isArray(assets)
        ? assets.map(normalizePickedAsset).filter((asset): asset is PickedPhotoAsset => Boolean(asset))
        : [],
      highlighted: Boolean(searchQuery)
    };
  } catch (error) {
    return {
      available: false,
      assets: [],
      highlighted: false,
      error: error instanceof Error ? error.message : "Android Photo Picker failed."
    };
  }
}
