import { PhotoItem } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_GAP_MS = 8 * 60 * 60 * 1000;
const EVENT_MIN_PHOTOS = 3;
const COLLECTION_MIN_PHOTOS = 5;
const COLLECTION_MIN_DISTINCT_DAYS = 3;
const COLLECTION_MIN_SPAN_DAYS = 7;
const BEST_PHOTO_LIMIT = 6;
const COLLECTION_OVERLAP_DEDUPE_THRESHOLD = 0.72;

export type ProjectClusterType = "event" | "collection";

export type NormalizedProjectCue =
  | "time-burst"
  | "same-day"
  | "multi-day"
  | "location-cluster"
  | "location-shift"
  | "high-quality"
  | "group-faces"
  | "portrait"
  | "recurring-theme"
  | "recurring-location"
  | "scenic"
  | "food"
  | "pet"
  | "travel";

export type ProjectPhotoCluster = {
  id: string;
  projectId: string;
  type: ProjectClusterType;
  photoIds: string[];
  bestPhotoIds: string[];
  startTime?: string;
  endTime?: string;
  locationSummary?: {
    locatedPhotoCount: number;
    bucketCount: number;
    center?: {
      latitude: number;
      longitude: number;
    };
  };
  photoCount: number;
  qualitySummary: {
    averageQuality: number;
    bestQuality: number;
    weakPhotoCount: number;
    heroCandidatePhotoId?: string;
  };
  faceSummary: {
    facePhotoCount: number;
    groupPhotoCount: number;
    totalFaces: number;
  };
  cues: NormalizedProjectCue[];
  supportingTags: string[];
  score: number;
  explanation: string;
  recurrence?: {
    key: string;
    distinctDays: number;
    spanDays: number;
  };
};

function getPhotoTimestamp(photo: PhotoItem): number {
  const capturedAt = Date.parse(photo.capturedAt);
  if (Number.isFinite(capturedAt)) {
    return capturedAt;
  }
  const addedAt = Date.parse(photo.addedAt);
  return Number.isFinite(addedAt) ? addedAt : 0;
}

function sortByTimeline(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => getPhotoTimestamp(a) - getPhotoTimestamp(b));
}

function getDateKey(photo: PhotoItem): string | undefined {
  const timestamp = getPhotoTimestamp(photo);
  return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
}

function getLocationBucket(photo: PhotoItem): string | undefined {
  if (!photo.location) {
    return undefined;
  }
  return `${photo.location.latitude.toFixed(2)}:${photo.location.longitude.toFixed(2)}`;
}

function getQualityScore(photo: PhotoItem): number {
  return photo.analysis?.quality?.qualityScore ?? 0.5;
}

function getHeroScore(photo: PhotoItem): number {
  return photo.analysis?.quality?.heroCandidateScore ?? getQualityScore(photo);
}

function isWeakPhoto(photo: PhotoItem): boolean {
  return photo.analysis?.quality?.isBlurry === true || getQualityScore(photo) < 0.28;
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function getTrustedPhotoTags(photo: PhotoItem): string[] {
  const tags = new Set<string>([
    ...(photo.analysis?.sceneTags ?? []),
    ...(photo.analysis?.themeTags ?? []),
    ...(photo.analysis?.safeExternalTags ?? [])
  ]);

  if (photo.analysis?.subjectCues?.groupPhotoLike || photo.analysis?.faces?.hasMultipleFaces) {
    tags.add("group");
  }
  if (photo.analysis?.subjectCues?.portraitLike || photo.analysis?.faces?.hasFace) {
    tags.add("portrait");
  }

  return Array.from(tags).sort();
}

function getDominantTags(photos: PhotoItem[], limit = 5): string[] {
  const counts = new Map<string, number>();
  photos.forEach((photo) => {
    getTrustedPhotoTags(photo).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function getLocationSummary(photos: PhotoItem[]): ProjectPhotoCluster["locationSummary"] | undefined {
  const located = photos.filter((photo) => photo.location);
  if (located.length === 0) {
    return undefined;
  }

  const buckets = new Set(located.map(getLocationBucket).filter((bucket): bucket is string => Boolean(bucket)));
  const center =
    buckets.size === 1
      ? {
          latitude: Number((located.reduce((sum, photo) => sum + (photo.location?.latitude ?? 0), 0) / located.length).toFixed(5)),
          longitude: Number((located.reduce((sum, photo) => sum + (photo.location?.longitude ?? 0), 0) / located.length).toFixed(5))
        }
      : undefined;

  return {
    locatedPhotoCount: located.length,
    bucketCount: buckets.size,
    center
  };
}

function summarizeQuality(photos: PhotoItem[]): ProjectPhotoCluster["qualitySummary"] {
  const ranked = rankBestPhotos(photos);
  const scores = photos.map(getQualityScore);
  const averageQuality = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);
  return {
    averageQuality: roundScore(averageQuality),
    bestQuality: roundScore(Math.max(...scores, 0)),
    weakPhotoCount: photos.filter(isWeakPhoto).length,
    heroCandidatePhotoId: ranked[0]?.id
  };
}

function summarizeFaces(photos: PhotoItem[]): ProjectPhotoCluster["faceSummary"] {
  const facePhotoCount = photos.filter((photo) => photo.analysis?.faces?.hasFace).length;
  const groupPhotoCount = photos.filter((photo) => photo.analysis?.faces?.hasMultipleFaces).length;
  const totalFaces = photos.reduce((sum, photo) => sum + (photo.analysis?.faces?.faceCount ?? 0), 0);
  return {
    facePhotoCount,
    groupPhotoCount,
    totalFaces
  };
}

function rankBestPhotos(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => {
    const aScore = getQualityScore(a) * 2 + getHeroScore(a) * 2 - (isWeakPhoto(a) ? 1.5 : 0);
    const bScore = getQualityScore(b) * 2 + getHeroScore(b) * 2 - (isWeakPhoto(b) ? 1.5 : 0);
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    return getPhotoTimestamp(a) - getPhotoTimestamp(b);
  });
}

function getBaseCues(photos: PhotoItem[]): NormalizedProjectCue[] {
  const cues = new Set<NormalizedProjectCue>();
  const locationSummary = getLocationSummary(photos);
  const tags = getDominantTags(photos, 8);
  const faceSummary = summarizeFaces(photos);
  const qualitySummary = summarizeQuality(photos);
  const distinctDays = new Set(photos.map(getDateKey).filter(Boolean)).size;

  if (distinctDays <= 1) {
    cues.add("same-day");
  } else {
    cues.add("multi-day");
  }
  if (locationSummary && locationSummary.locatedPhotoCount >= Math.max(2, photos.length * 0.4)) {
    cues.add(locationSummary.bucketCount > 1 ? "location-shift" : "location-cluster");
  }
  if (qualitySummary.averageQuality >= 0.65 || qualitySummary.bestQuality >= 0.82) {
    cues.add("high-quality");
  }
  if (faceSummary.groupPhotoCount > 0) {
    cues.add("group-faces");
  } else if (faceSummary.facePhotoCount > 0) {
    cues.add("portrait");
  }
  if (tags.some((tag) => ["scenic", "landscape", "nature-like", "sunset-like", "beach", "water"].includes(tag))) {
    cues.add("scenic");
  }
  if (tags.includes("food")) {
    cues.add("food");
  }
  if (tags.includes("pet-like") || tags.includes("animal")) {
    cues.add("pet");
  }
  if (tags.includes("travel") || tags.includes("vacation") || tags.includes("beach")) {
    cues.add("travel");
  }

  return Array.from(cues).sort();
}

function buildEventGroups(projectId: string, photos: PhotoItem[]): PhotoItem[][] {
  const ordered = sortByTimeline(photos.filter((photo) => photo.projectId === projectId));
  const groups: PhotoItem[][] = [];
  let current: PhotoItem[] = [];

  for (const photo of ordered) {
    if (current.length === 0) {
      current = [photo];
      continue;
    }

    const previous = current[current.length - 1];
    const previousTime = previous ? getPhotoTimestamp(previous) : 0;
    const photoTime = getPhotoTimestamp(photo);
    const sameDate = previous && getDateKey(previous) === getDateKey(photo);

    if (previousTime > 0 && photoTime > 0 && (photoTime - previousTime <= EVENT_GAP_MS || sameDate)) {
      current.push(photo);
      continue;
    }

    groups.push(current);
    current = [photo];
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups.filter((group) => group.length >= EVENT_MIN_PHOTOS);
}

function getClusterTimeBounds(photos: PhotoItem[]): Pick<ProjectPhotoCluster, "startTime" | "endTime"> {
  const timestamps = photos.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0);
  if (timestamps.length === 0) {
    return {};
  }
  return {
    startTime: new Date(Math.min(...timestamps)).toISOString(),
    endTime: new Date(Math.max(...timestamps)).toISOString()
  };
}

function scoreEventCluster(photos: PhotoItem[], cues: NormalizedProjectCue[]): number {
  const quality = summarizeQuality(photos);
  let score = Math.min(45, photos.length * 5);
  score += quality.averageQuality * 22;
  score += Math.min(12, Math.max(0, photos.length - quality.weakPhotoCount) * 1.5);
  if (cues.includes("same-day") || cues.includes("time-burst")) {
    score += 10;
  }
  if (cues.includes("location-cluster") || cues.includes("location-shift")) {
    score += 7;
  }
  if (cues.includes("group-faces")) {
    score += 6;
  }
  if (cues.includes("high-quality")) {
    score += 6;
  }
  const ceiling = cues.includes("high-quality") && cues.includes("group-faces") ? 96 : 92;
  return roundScore(Math.min(ceiling, score));
}

function buildEventCluster(projectId: string, photos: PhotoItem[], index: number): ProjectPhotoCluster {
  const ordered = sortByTimeline(photos);
  const cues = new Set<NormalizedProjectCue>(getBaseCues(ordered));
  const timeBounds = getClusterTimeBounds(ordered);
  const duration = timeBounds.startTime && timeBounds.endTime
    ? Date.parse(timeBounds.endTime) - Date.parse(timeBounds.startTime)
    : 0;
  if (duration <= EVENT_GAP_MS || new Set(ordered.map(getDateKey).filter(Boolean)).size <= 1) {
    cues.add("time-burst");
  }

  const allCues = Array.from(cues).sort();
  const best = rankBestPhotos(ordered).slice(0, BEST_PHOTO_LIMIT);
  const locationSummary = getLocationSummary(ordered);
  const qualitySummary = summarizeQuality(ordered);
  const faceSummary = summarizeFaces(ordered);
  const supportingTags = getDominantTags(ordered);
  const score = scoreEventCluster(ordered, allCues);
  const dateLabel = timeBounds.startTime ? timeBounds.startTime.slice(0, 10) : "unknown date";
  const why = [
    `${ordered.length} photos are close together around ${dateLabel}`,
    locationSummary ? `${locationSummary.locatedPhotoCount} have GPS context` : undefined,
    faceSummary.groupPhotoCount > 0 ? `${faceSummary.groupPhotoCount} look group-oriented` : undefined,
    qualitySummary.bestQuality >= 0.75 ? "the group has at least one strong hero candidate" : undefined
  ].filter(Boolean);

  return {
    id: `cluster:event:${projectId}:${timeBounds.startTime ?? index}:${ordered.length}`,
    projectId,
    type: "event",
    photoIds: ordered.map((photo) => photo.id),
    bestPhotoIds: best.map((photo) => photo.id),
    ...timeBounds,
    locationSummary,
    photoCount: ordered.length,
    qualitySummary,
    faceSummary,
    cues: allCues,
    supportingTags,
    score,
    explanation: `Event-like cluster: ${why.join("; ")}.`
  };
}

function getCollectionBuckets(photos: PhotoItem[]): Map<string, PhotoItem[]> {
  const buckets = new Map<string, PhotoItem[]>();

  photos.forEach((photo) => {
    const cues = getBaseCues([photo]);
    const tags = getTrustedPhotoTags(photo);
    const bucketKeys = new Set<string>();

    cues.forEach((cue) => {
      if (["scenic", "food", "pet", "travel", "group-faces"].includes(cue)) {
        bucketKeys.add(cue === "group-faces" ? "group" : cue);
      }
    });
    tags.forEach((tag) => {
      if (["beach", "food", "group", "nature-like", "pet-like", "scenic", "sunset-like", "travel"].includes(tag)) {
        bucketKeys.add(tag);
      }
    });

    bucketKeys.forEach((key) => {
      const list = buckets.get(key) ?? [];
      list.push(photo);
      buckets.set(key, list);
    });
  });

  return buckets;
}

function scoreCollectionCluster(photos: PhotoItem[], spanDays: number, distinctDays: number, cues: NormalizedProjectCue[]): number {
  const quality = summarizeQuality(photos);
  let score = Math.min(36, photos.length * 4);
  score += Math.min(22, distinctDays * 5);
  score += Math.min(14, spanDays / 2);
  score += quality.averageQuality * 18;
  if (cues.includes("recurring-theme")) {
    score += 8;
  }
  if (cues.includes("recurring-location")) {
    score += 6;
  }
  if (cues.includes("high-quality")) {
    score += 6;
  }
  return roundScore(Math.min(90, score));
}

function buildCollectionCluster(projectId: string, key: string, photos: PhotoItem[]): ProjectPhotoCluster | undefined {
  const ordered = sortByTimeline(photos);
  const timestamps = ordered.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0);
  if (ordered.length < COLLECTION_MIN_PHOTOS || timestamps.length < COLLECTION_MIN_PHOTOS) {
    return undefined;
  }

  const distinctDays = new Set(ordered.map(getDateKey).filter(Boolean)).size;
  const spanDays = Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / DAY_MS);
  if (distinctDays < COLLECTION_MIN_DISTINCT_DAYS || spanDays < COLLECTION_MIN_SPAN_DAYS) {
    return undefined;
  }

  const cues = new Set<NormalizedProjectCue>(getBaseCues(ordered));
  cues.add("recurring-theme");
  const locationSummary = getLocationSummary(ordered);
  if (locationSummary && locationSummary.bucketCount <= 2 && locationSummary.locatedPhotoCount >= 3) {
    cues.add("recurring-location");
  }

  const allCues = Array.from(cues).sort();
  const best = rankBestPhotos(ordered).slice(0, BEST_PHOTO_LIMIT);
  const timeBounds = getClusterTimeBounds(ordered);
  const score = scoreCollectionCluster(ordered, spanDays, distinctDays, allCues);
  const supportingTags = getDominantTags(ordered);
  const qualitySummary = summarizeQuality(ordered);
  const faceSummary = summarizeFaces(ordered);

  return {
    id: `cluster:collection:${projectId}:${key}`,
    projectId,
    type: "collection",
    photoIds: ordered.map((photo) => photo.id),
    bestPhotoIds: best.map((photo) => photo.id),
    ...timeBounds,
    locationSummary,
    photoCount: ordered.length,
    qualitySummary,
    faceSummary,
    cues: allCues,
    supportingTags,
    score,
    recurrence: {
      key,
      distinctDays,
      spanDays
    },
    explanation: `Recurring collection-like cluster: ${ordered.length} photos share "${key}" across ${distinctDays} days over ${spanDays} days.`
  };
}

function getClusterOverlapRatio(a: ProjectPhotoCluster, b: ProjectPhotoCluster): number {
  const aIds = new Set(a.photoIds);
  const bIds = new Set(b.photoIds);
  const smallerSize = Math.min(aIds.size, bIds.size);
  if (smallerSize === 0) {
    return 0;
  }

  let shared = 0;
  aIds.forEach((id) => {
    if (bIds.has(id)) {
      shared += 1;
    }
  });
  return shared / smallerSize;
}

function dedupeCollectionClusters(clusters: ProjectPhotoCluster[]): ProjectPhotoCluster[] {
  const kept: ProjectPhotoCluster[] = [];
  const sorted = [...clusters].sort((a, b) => b.score - a.score || b.photoCount - a.photoCount);

  for (const cluster of sorted) {
    if (
      kept.some(
        (existing) =>
          existing.type === "collection" &&
          cluster.type === "collection" &&
          getClusterOverlapRatio(existing, cluster) >= COLLECTION_OVERLAP_DEDUPE_THRESHOLD
      )
    ) {
      continue;
    }
    kept.push(cluster);
  }

  return kept;
}

export function generateProjectPhotoClusters(projectId: string, photos: PhotoItem[]): ProjectPhotoCluster[] {
  const projectPhotos = photos.filter((photo) => photo.projectId === projectId);
  const eventClusters = buildEventGroups(projectId, projectPhotos).map((group, index) =>
    buildEventCluster(projectId, group, index)
  );
  const collectionClusters = Array.from(getCollectionBuckets(projectPhotos).entries())
    .map(([key, bucketPhotos]) => buildCollectionCluster(projectId, key, bucketPhotos))
    .filter((cluster): cluster is ProjectPhotoCluster => Boolean(cluster));

  return [...eventClusters, ...dedupeCollectionClusters(collectionClusters)]
    .filter((cluster) => cluster.score >= 35)
    .sort((a, b) => b.score - a.score || b.photoCount - a.photoCount);
}
