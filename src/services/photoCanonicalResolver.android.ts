import type * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import type {
  CanonicalAssetMetadataSource,
  CanonicalPhotoMetadataResolution,
  CanonicalPhotoMetadataResolver
} from "./photoCanonicalResolver";
import {
  createPickerFallbackResolution
} from "./photoCanonicalResolver";
import { extractCapturedAtFromMetadata } from "./photoMetadataIngestion";

export type AndroidMediaLibraryPermissionProbe = {
  permissionGranted: boolean;
  permissionStatus?: string;
  canAskAgain: boolean;
  requestAttempted: boolean;
  requestGranted: boolean;
};

export async function getAndroidMediaLibraryPermissionProbe(): Promise<AndroidMediaLibraryPermissionProbe> {
  try {
    const existing = await MediaLibrary.getPermissionsAsync();
    if (existing.granted) {
      return {
        permissionGranted: true,
        permissionStatus: existing.status,
        canAskAgain: existing.canAskAgain,
        requestAttempted: false,
        requestGranted: true
      };
    }
    const requested = await MediaLibrary.requestPermissionsAsync();
    return {
      permissionGranted: requested.granted,
      permissionStatus: requested.status,
      canAskAgain: requested.canAskAgain,
      requestAttempted: true,
      requestGranted: requested.granted
    };
  } catch {
    return {
      permissionGranted: false,
      permissionStatus: "error",
      canAskAgain: false,
      requestAttempted: false,
      requestGranted: false
    };
  }
}

export async function ensureAndroidMediaLibraryPermission(): Promise<boolean> {
  const probe = await getAndroidMediaLibraryPermissionProbe();
  return probe.permissionGranted;
}

export async function getAndroidMediaLibraryAssetInfo(
  assetId: string | null | undefined
): Promise<CanonicalAssetMetadataSource | undefined> {
  if (!assetId) {
    return undefined;
  }
  const granted = await ensureAndroidMediaLibraryPermission();
  if (!granted) {
    return undefined;
  }

  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
    return assetInfo
      ? {
          exif: (assetInfo as { exif?: Record<string, unknown> | null }).exif ?? undefined,
          location:
            assetInfo.location && typeof assetInfo.location === "object"
              ? {
                  latitude: (assetInfo.location as { latitude?: unknown }).latitude,
                  longitude: (assetInfo.location as { longitude?: unknown }).longitude
                }
              : undefined,
          creationTime: assetInfo.creationTime
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export type AndroidMediaLibraryAssetProbe = {
  assetId?: string;
  assetIdPresent: boolean;
  permissionGranted: boolean;
  lookupAttempted: boolean;
  hasLocation: boolean;
  hasExif: boolean;
  rawLocationPreview?: string;
  exifKeySample?: string[];
  error?: string;
};

export async function probeAndroidMediaLibraryAssetMetadata(
  assetId: string | undefined
): Promise<AndroidMediaLibraryAssetProbe> {
  if (!assetId) {
    return {
      assetId,
      assetIdPresent: false,
      permissionGranted: false,
      lookupAttempted: false,
      hasLocation: false,
      hasExif: false
    };
  }

  const permissionGranted = await ensureAndroidMediaLibraryPermission();
  if (!permissionGranted) {
    return {
      assetId,
      assetIdPresent: true,
      permissionGranted: false,
      lookupAttempted: false,
      hasLocation: false,
      hasExif: false
    };
  }

  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
    const rawLocation = assetInfo?.location;
    const rawExif = (assetInfo as { exif?: Record<string, unknown> | null } | null)?.exif;
    const latitude = rawLocation && "latitude" in rawLocation ? Number(rawLocation.latitude) : undefined;
    const longitude = rawLocation && "longitude" in rawLocation ? Number(rawLocation.longitude) : undefined;
    const locationPreview =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}`
        : rawLocation
          ? "Location object present"
          : undefined;
    const exifKeys = rawExif && typeof rawExif === "object" ? Object.keys(rawExif).sort() : [];

    return {
      assetId,
      assetIdPresent: true,
      permissionGranted: true,
      lookupAttempted: true,
      hasLocation: Boolean(rawLocation),
      hasExif: exifKeys.length > 0,
      rawLocationPreview: locationPreview,
      exifKeySample: exifKeys.slice(0, 6)
    };
  } catch (error) {
    return {
      assetId,
      assetIdPresent: true,
      permissionGranted: true,
      lookupAttempted: true,
      hasLocation: false,
      hasExif: false,
      error: error instanceof Error ? error.message : "Media Library asset info lookup failed."
    };
  }
}

function normalizeComparableFileName(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || undefined;
}

function scoreMediaLibraryCandidate(
  pickerAsset: ImagePicker.ImagePickerAsset,
  pickerCapturedAtMs: number | undefined,
  candidate: MediaLibrary.Asset
): number {
  let score = 0;
  const pickerName = normalizeComparableFileName(pickerAsset.fileName);
  const candidateName = normalizeComparableFileName(candidate.filename);
  if (pickerName && candidateName) {
    if (pickerName === candidateName) {
      score += 120;
    } else if (pickerName.replace(/\.[^.]+$/, "") === candidateName.replace(/\.[^.]+$/, "")) {
      score += 80;
    }
  }

  const sameOrientation = pickerAsset.width === candidate.width && pickerAsset.height === candidate.height;
  const swappedOrientation = pickerAsset.width === candidate.height && pickerAsset.height === candidate.width;
  if (sameOrientation) {
    score += 70;
  } else if (swappedOrientation) {
    score += 45;
  }

  if (pickerCapturedAtMs && Number.isFinite(candidate.creationTime)) {
    const deltaMs = Math.abs(candidate.creationTime - pickerCapturedAtMs);
    if (deltaMs <= 5 * 60 * 1000) {
      score += 60;
    } else if (deltaMs <= 60 * 60 * 1000) {
      score += 40;
    } else if (deltaMs <= 24 * 60 * 60 * 1000) {
      score += 20;
    } else if (deltaMs <= 72 * 60 * 60 * 1000) {
      score += 8;
    }
  }

  return score;
}

async function findCanonicalAndroidMediaLibraryMatch(
  pickerAsset: ImagePicker.ImagePickerAsset
): Promise<CanonicalPhotoMetadataResolution | undefined> {
  const permissionGranted = await ensureAndroidMediaLibraryPermission();
  if (!permissionGranted) {
    return undefined;
  }

  const pickerCapturedAt = extractCapturedAtFromMetadata({
    exif: pickerAsset.exif ?? undefined,
    creationTime: pickerAsset.file?.lastModified
  });
  const pickerCapturedAtMs = pickerCapturedAt ? Date.parse(pickerCapturedAt) : undefined;

  const queryOptions: Parameters<typeof MediaLibrary.getAssetsAsync>[0] = {
    first: 200,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [MediaLibrary.SortBy.creationTime]
  };
  if (pickerCapturedAtMs && Number.isFinite(pickerCapturedAtMs)) {
    queryOptions.createdAfter = pickerCapturedAtMs - 72 * 60 * 60 * 1000;
    queryOptions.createdBefore = pickerCapturedAtMs + 72 * 60 * 60 * 1000;
  }

  let candidates: MediaLibrary.Asset[] = [];
  try {
    const page = await MediaLibrary.getAssetsAsync(queryOptions);
    candidates = page.assets;
  } catch {
    return undefined;
  }

  if (candidates.length === 0) {
    return undefined;
  }

  const bestMatch = candidates
    .map((candidate) => ({
      candidate,
      score: scoreMediaLibraryCandidate(pickerAsset, pickerCapturedAtMs, candidate)
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!bestMatch || bestMatch.score < 150) {
    return undefined;
  }

  const metadata = await getAndroidMediaLibraryAssetInfo(bestMatch.candidate.id);
  return {
    assetId: bestMatch.candidate.id,
    metadata,
    kind: "canonical-recovered"
  };
}

export const resolveCanonicalPhotoMetadataAndroid: CanonicalPhotoMetadataResolver = async (asset) => {
  const directAssetId = typeof asset.assetId === "string" && asset.assetId.length > 0 ? asset.assetId : undefined;
  if (directAssetId) {
    return {
      assetId: directAssetId,
      metadata: await getAndroidMediaLibraryAssetInfo(directAssetId),
      kind: "canonical-direct"
    };
  }

  const recovered = await findCanonicalAndroidMediaLibraryMatch(asset);
  if (recovered) {
    return recovered;
  }

  return createPickerFallbackResolution(asset);
};
