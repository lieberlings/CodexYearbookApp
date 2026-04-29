import type * as ImagePicker from "expo-image-picker";
import type * as MediaLibrary from "expo-media-library";
import { normalizePhotoLocation } from "../lib/photoLocation";
import { PhotoImportMetadata, PhotoItem } from "../types";
import type { CanonicalAssetMetadataSource, CanonicalPhotoMetadataResolution } from "./photoCanonicalResolver";

export type PickedPhotoAsset = {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
  capturedAt?: string;
  location?: PhotoItem["location"];
  importMetadata?: PhotoImportMetadata;
};

export type AssetMetadataSource = CanonicalAssetMetadataSource;

function toIsoDateString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const timestamp = value < 1e12 ? value * 1000 : value;
    return new Date(timestamp).toISOString();
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function parseExifFraction(part: string): number | undefined {
  const trimmed = part.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!trimmed.includes("/")) {
    const direct = Number.parseFloat(trimmed);
    return Number.isFinite(direct) ? direct : undefined;
  }

  const [numerator, denominator] = trimmed.split("/");
  const num = Number.parseFloat(numerator ?? "");
  const den = Number.parseFloat(denominator ?? "");
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return undefined;
  }
  return num / den;
}

function applyCoordinateRef(value: number, ref: unknown): number {
  const normalizedRef = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  if (normalizedRef === "S" || normalizedRef === "W") {
    return -Math.abs(value);
  }
  return value;
}

function parseExifCoordinate(value: unknown, ref?: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return applyCoordinateRef(value, ref);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return applyCoordinateRef(numeric, ref);
  }

  const parts = trimmed.split(",").map((part) => parseExifFraction(part));
  if (parts.length === 0 || parts.some((part) => part === undefined)) {
    return undefined;
  }

  const [degrees = 0, minutes = 0, seconds = 0] = parts as number[];
  const decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  return applyCoordinateRef(decimal, ref);
}

export function extractCapturedAtFromMetadata(source: AssetMetadataSource | undefined): string | undefined {
  const exif = source?.exif ?? undefined;
  return (
    toIsoDateString(exif?.DateTimeOriginal) ??
    toIsoDateString(exif?.DateTimeDigitized) ??
    toIsoDateString(exif?.DateTime) ??
    toIsoDateString(exif?.CreationDate) ??
    toIsoDateString(source?.creationTime)
  );
}

export function extractLocationFromMetadata(source: AssetMetadataSource | undefined): PhotoItem["location"] | undefined {
  const directLocation = normalizePhotoLocation(
    source?.location &&
      typeof source.location === "object" &&
      "latitude" in source.location &&
      "longitude" in source.location
      ? {
          latitude: Number(source.location.latitude),
          longitude: Number(source.location.longitude)
        }
      : undefined
  );
  if (directLocation) {
    return directLocation;
  }

  const exif = source?.exif ?? undefined;
  const latitude = parseExifCoordinate(exif?.GPSLatitude ?? exif?.latitude, exif?.GPSLatitudeRef);
  const longitude = parseExifCoordinate(exif?.GPSLongitude ?? exif?.longitude, exif?.GPSLongitudeRef);

  return normalizePhotoLocation(
    typeof latitude === "number" && typeof longitude === "number"
      ? {
          latitude,
          longitude
        }
      : undefined
  );
}

export function buildPickedPhotoAsset(
  asset: ImagePicker.ImagePickerAsset,
  resolvedMetadata?: CanonicalPhotoMetadataResolution | null
): PickedPhotoAsset {
  const pickerKeySample = Object.keys(asset as Record<string, unknown>).sort().slice(0, 12);
  const pickerCapturedAt = extractCapturedAtFromMetadata({
    exif: asset.exif ?? undefined,
    creationTime: asset.file?.lastModified
  });
  const mediaLibraryCapturedAt = extractCapturedAtFromMetadata(resolvedMetadata?.metadata ?? undefined);
  const pickerLocation = extractLocationFromMetadata({
    exif: asset.exif ?? undefined
  });
  const mediaLibraryLocation = extractLocationFromMetadata(resolvedMetadata?.metadata ?? undefined);
  const capturedAt = mediaLibraryCapturedAt ?? pickerCapturedAt;
  const location = mediaLibraryLocation ?? pickerLocation;

  return {
    uri: asset.uri,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
    capturedAt,
    location,
    importMetadata: {
      assetId: resolvedMetadata?.assetId,
      resolutionKind: resolvedMetadata?.kind,
      capturedAtSource: mediaLibraryCapturedAt ? "media-library" : pickerCapturedAt ? "picker" : undefined,
      locationSource: mediaLibraryLocation ? "media-library" : pickerLocation ? "picker" : undefined,
      pickerAssetIdPresent: typeof asset.assetId === "string" && asset.assetId.length > 0,
      pickerExifPresent: Boolean(asset.exif && Object.keys(asset.exif).length > 0),
      pickerKeySample: pickerKeySample.length > 0 ? pickerKeySample : undefined
    }
  };
}

export function buildPickedPhotoAssetFromMediaLibraryAsset(
  asset: Pick<MediaLibrary.Asset, "id" | "uri" | "filename" | "width" | "height" | "creationTime">,
  mediaLibraryAssetInfo?: AssetMetadataSource | null
): PickedPhotoAsset {
  const mediaLibraryCapturedAt = extractCapturedAtFromMetadata(mediaLibraryAssetInfo ?? { creationTime: asset.creationTime });
  const mediaLibraryLocation = extractLocationFromMetadata(mediaLibraryAssetInfo ?? undefined);

  return {
    uri: asset.uri,
    fileName: asset.filename,
    width: asset.width,
    height: asset.height,
    capturedAt: mediaLibraryCapturedAt,
    location: mediaLibraryLocation,
    importMetadata: {
      assetId: asset.id,
      resolutionKind: "canonical-direct",
      capturedAtSource: mediaLibraryCapturedAt ? "media-library" : undefined,
      locationSource: mediaLibraryLocation ? "media-library" : undefined,
      pickerAssetIdPresent: true,
      pickerExifPresent: false,
      pickerKeySample: ["media-library-asset"]
    }
  };
}
