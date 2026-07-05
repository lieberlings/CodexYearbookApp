import * as MediaLibrary from "expo-media-library";
import { getDateBoundary } from "../context/appDataHelpers";
import { normalizePhotoLocation } from "../lib/photoLocation";
import { PhotoItem, Project, Suggestion, SuggestionCandidatePhotoRef } from "../types";
import { ensureAndroidMediaLibraryPermission } from "./photoCanonicalResolver.android";
import { extractCapturedAtFromMetadata, extractLocationFromMetadata } from "./photoMetadataIngestion";
import { generateProjectPhotoClusters, ProjectPhotoCluster } from "./projectClusterEngine";

const SCAN_PAGE_SIZE = 100;
const DEFAULT_SCAN_ASSET_LIMIT = 350;
const DEFAULT_SUGGESTION_LIMIT = 12;

export type MediaLibrarySuggestionScanBounds = {
  createdAfter?: number;
  createdBefore?: number;
};

export type MediaLibrarySuggestionScanOptions = {
  maxAssets?: number;
  suggestionLimit?: number;
  excludeAssetIds?: string[];
};

export type MediaLibrarySuggestionScanResult = {
  suggestions: Suggestion[];
  scannedAssetCount: number;
  candidateAssetCount: number;
  locatedAssetCount: number;
};

type MediaLibraryAssetMetadata = Pick<MediaLibrary.Asset, "id" | "uri" | "filename" | "width" | "height" | "creationTime"> & {
  exif?: Record<string, unknown> | null;
  location?: {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
};

function getProjectMediaLibraryScanBounds(project: Project): MediaLibrarySuggestionScanBounds {
  const startBoundary = getDateBoundary(project.startDate);
  const explicitEndBoundary = getDateBoundary(project.endDate, true);
  const createdAtBoundary = Date.parse(project.createdAt);
  const endBoundary =
    project.timelineMode === "past"
      ? explicitEndBoundary
      : project.includeFutureProjectPhotos
        ? undefined
        : explicitEndBoundary ?? (Number.isFinite(createdAtBoundary) ? createdAtBoundary : undefined);

  return {
    createdAfter: startBoundary,
    createdBefore: endBoundary
  };
}

function assetToMetadata(asset: MediaLibrary.Asset, assetInfo?: MediaLibrary.AssetInfo | null): MediaLibraryAssetMetadata {
  const info = assetInfo ?? undefined;
  return {
    id: asset.id,
    uri: info?.localUri ?? info?.uri ?? asset.uri,
    filename: info?.filename ?? asset.filename,
    width: info?.width ?? asset.width,
    height: info?.height ?? asset.height,
    creationTime: info?.creationTime ?? asset.creationTime,
    exif: (info as { exif?: Record<string, unknown> | null } | undefined)?.exif,
    location: info?.location
  };
}

function metadataToCandidateRef(metadata: MediaLibraryAssetMetadata): SuggestionCandidatePhotoRef {
  const capturedAt = extractCapturedAtFromMetadata({
    exif: metadata.exif ?? undefined,
    creationTime: metadata.creationTime
  });
  const location = extractLocationFromMetadata({
    exif: metadata.exif ?? undefined,
    location: metadata.location ?? undefined,
    creationTime: metadata.creationTime
  });

  return {
    id: `media-library:${metadata.id}`,
    source: "media-library",
    assetId: metadata.id,
    uri: metadata.uri,
    fileName: metadata.filename,
    width: metadata.width,
    height: metadata.height,
    capturedAt,
    location: normalizePhotoLocation(location)
  };
}

function refToTemporaryPhoto(projectId: string, ref: SuggestionCandidatePhotoRef): PhotoItem | undefined {
  const timestamp = ref.capturedAt ? Date.parse(ref.capturedAt) : 0;
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }

  return {
    id: ref.id,
    projectId,
    uri: ref.uri,
    width: ref.width,
    height: ref.height,
    capturedAt: ref.capturedAt as string,
    addedAt: ref.capturedAt as string,
    location: ref.location,
    importMetadata: {
      assetId: ref.assetId,
      resolutionKind: "canonical-direct",
      capturedAtSource: "media-library",
      locationSource: ref.location ? "media-library" : undefined,
      pickerAssetIdPresent: true,
      pickerExifPresent: false,
      pickerKeySample: ["media-library-scan"]
    }
  };
}

function formatSuggestionDate(cluster: ProjectPhotoCluster): string {
  const start = cluster.startTime ? new Date(cluster.startTime) : undefined;
  if (!start || Number.isNaN(start.getTime())) {
    return "this moment";
  }
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getStableClusterSuggestionId(
  projectId: string,
  cluster: ProjectPhotoCluster,
  refsById: Map<string, SuggestionCandidatePhotoRef>
): string {
  const orderedRefs = cluster.photoIds
    .map((photoId) => refsById.get(photoId))
    .filter((ref): ref is SuggestionCandidatePhotoRef => Boolean(ref))
    .sort((a, b) => (a.capturedAt ?? "").localeCompare(b.capturedAt ?? ""));
  const first = orderedRefs[0]?.assetId ?? "start";
  const last = orderedRefs[orderedRefs.length - 1]?.assetId ?? "end";
  const startDay = cluster.startTime?.slice(0, 10) ?? "unknown-day";
  const locationKey = cluster.locationSummary?.center
    ? `${cluster.locationSummary.center.latitude.toFixed(2)}:${cluster.locationSummary.center.longitude.toFixed(2)}`
    : `buckets-${cluster.locationSummary?.bucketCount ?? 0}`;

  return `suggestion:library-scan:${cluster.type}:${projectId}:${startDay}:${locationKey}:${first}:${last}:${cluster.photoCount}`;
}

function clusterToSuggestion(
  projectId: string,
  cluster: ProjectPhotoCluster,
  refsById: Map<string, SuggestionCandidatePhotoRef>
): Suggestion {
  const candidatePhotoRefs = cluster.photoIds
    .map((photoId) => refsById.get(photoId))
    .filter((ref): ref is SuggestionCandidatePhotoRef => Boolean(ref));
  const locatedCount = candidatePhotoRefs.filter((ref) => ref.location).length;
  const dateLabel = formatSuggestionDate(cluster);
  const locationPhrase =
    locatedCount > 0
      ? `${locatedCount} candidate photos include MediaLibrary GPS context`
      : "MediaLibrary GPS was not available for these candidates";

  return {
    id: getStableClusterSuggestionId(projectId, cluster, refsById),
    projectId,
    type: "event",
    status: "new",
    title: `Suggested memory from ${dateLabel}`,
    message: `${cluster.explanation} ${locationPhrase}. Score ${cluster.score}.`,
    candidatePhotoIds: candidatePhotoRefs.map((ref) => ref.id),
    candidatePhotoRefs,
    createdAt: cluster.startTime ?? candidatePhotoRefs[0]?.capturedAt ?? new Date().toISOString()
  };
}

async function getMediaLibraryAssetMetadata(asset: MediaLibrary.Asset): Promise<MediaLibraryAssetMetadata> {
  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
    return assetToMetadata(asset, assetInfo);
  } catch {
    return assetToMetadata(asset);
  }
}

async function getScopedMediaLibraryAssets(
  project: Project,
  maxAssets: number
): Promise<MediaLibraryAssetMetadata[]> {
  const bounds = getProjectMediaLibraryScanBounds(project);
  const assets: MediaLibrary.Asset[] = [];
  let after: string | undefined;

  while (assets.length < maxAssets) {
    const page = await MediaLibrary.getAssetsAsync({
      first: Math.min(SCAN_PAGE_SIZE, maxAssets - assets.length),
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      createdAfter: bounds.createdAfter,
      createdBefore: bounds.createdBefore
    });

    assets.push(...page.assets);
    if (!page.hasNextPage || !page.endCursor) {
      break;
    }
    after = page.endCursor;
  }

  const metadata: MediaLibraryAssetMetadata[] = [];
  for (const asset of assets) {
    metadata.push(await getMediaLibraryAssetMetadata(asset));
  }
  return metadata;
}

export async function scanMediaLibrarySuggestionsForProject(
  project: Project,
  options: MediaLibrarySuggestionScanOptions = {}
): Promise<MediaLibrarySuggestionScanResult> {
  const permissionGranted = await ensureAndroidMediaLibraryPermission();
  if (!permissionGranted) {
    throw new Error("Photo library permission was not granted.");
  }

  const excludedAssetIds = new Set(options.excludeAssetIds ?? []);
  const maxAssets = options.maxAssets ?? DEFAULT_SCAN_ASSET_LIMIT;
  const suggestionLimit = options.suggestionLimit ?? DEFAULT_SUGGESTION_LIMIT;
  const metadata = await getScopedMediaLibraryAssets(project, maxAssets);
  const candidateRefs = metadata
    .filter((asset) => !excludedAssetIds.has(asset.id))
    .map(metadataToCandidateRef);
  const refsById = new Map(candidateRefs.map((ref) => [ref.id, ref] as const));
  const temporaryPhotos = candidateRefs
    .map((ref) => refToTemporaryPhoto(project.id, ref))
    .filter((photo): photo is PhotoItem => Boolean(photo));

  const eventClusters = generateProjectPhotoClusters(project.id, temporaryPhotos)
    .filter((cluster) => cluster.type === "event")
    .slice(0, suggestionLimit);
  const suggestions = eventClusters.map((cluster) => clusterToSuggestion(project.id, cluster, refsById));

  return {
    suggestions,
    scannedAssetCount: metadata.length,
    candidateAssetCount: candidateRefs.length,
    locatedAssetCount: candidateRefs.filter((ref) => ref.location).length
  };
}
