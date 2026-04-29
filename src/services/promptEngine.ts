import { FinalizationSuggestion, Memory, PhotoItem, PromptItem, Suggestion } from "../types";
import { makeId } from "../lib/id";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_BURST_WINDOW_MS = 3 * DAY_MS;
const RECENT_BURST_MIN_COUNT = 8;
const TIME_CLUSTER_WINDOW_MS = 12 * 60 * 60 * 1000;
const TIME_CLUSTER_MIN_COUNT = 4;
const LOCATION_PATTERN_MIN_COUNT = 5;
const PROJECT_POOL_GROUP_GAP_MS = RECENT_BURST_WINDOW_MS;
const COLLECTION_SPAN_MIN_DAYS = 14;
const COLLECTION_MIN_DISTINCT_DAYS = 3;
const COLLECTION_MIN_PHOTO_COUNT = 6;
const COLLECTION_CANDIDATE_LIMIT = 12;
const FINALIZATION_MISSING_MOMENT_LIMIT = 2;
const FINALIZATION_UNUSED_LIMIT = 10;
const FINALIZATION_HIGHLIGHT_LIMIT = 3;
const FINALIZATION_HIGHLIGHT_MIN_COUNT = 4;
const FINALIZATION_HIGHLIGHT_MIN_DISTINCT_DAYS = 2;

type EventSignalKind = "time-cluster" | "photo-spike" | "location-pattern";

type EventSignal = {
  kind: EventSignalKind;
  message: string;
  candidatePhotoIds: string[];
};

type EventSignalSource = {
  id: string;
  kind: "memory" | "project-pool";
  title: string;
  createdAt: string;
};

function getPhotoTimestamp(photo: PhotoItem): number {
  const capturedAt = Number.isFinite(Date.parse(photo.capturedAt)) ? Date.parse(photo.capturedAt) : NaN;
  if (!Number.isNaN(capturedAt)) {
    return capturedAt;
  }
  const addedAt = Number.isFinite(Date.parse(photo.addedAt)) ? Date.parse(photo.addedAt) : NaN;
  if (!Number.isNaN(addedAt)) {
    return addedAt;
  }
  return 0;
}

function sortByTimeline(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => getPhotoTimestamp(a) - getPhotoTimestamp(b));
}

function getQualityScore(photo: PhotoItem): number {
  return photo.analysis?.quality?.qualityScore ?? 0.5;
}

function getHeroCandidateScore(photo: PhotoItem): number {
  return photo.analysis?.quality?.heroCandidateScore ?? getQualityScore(photo);
}

function isWeakPhoto(photo: PhotoItem): boolean {
  return photo.analysis?.quality?.isBlurry === true || getQualityScore(photo) < 0.28;
}

function getPhotoAnalysisTags(photo: PhotoItem): string[] {
  const tags = new Set<string>([
    ...(photo.analysis?.sceneTags ?? []),
    ...(photo.analysis?.themeTags ?? [])
  ]);

  if (photo.analysis?.subjectCues?.portraitLike) {
    tags.add("portrait");
  }
  if (photo.analysis?.subjectCues?.groupPhotoLike) {
    tags.add("group");
  }

  return Array.from(tags);
}

function getEventPhotoStrengthScore(photo: PhotoItem): number {
  let score = getQualityScore(photo) * 2.5 + getHeroCandidateScore(photo) * 1.8;
  const tags = getPhotoAnalysisTags(photo);

  if (tags.includes("scenic")) {
    score += 0.5;
  }
  if (tags.includes("group")) {
    score += 0.4;
  }
  if (tags.includes("portrait")) {
    score += 0.25;
  }
  if (isWeakPhoto(photo)) {
    score -= 1.5;
  }

  return score;
}

function rankEventCandidatePhotos(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => {
    const scoreDiff = getEventPhotoStrengthScore(b) - getEventPhotoStrengthScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return getPhotoTimestamp(a) - getPhotoTimestamp(b);
  });
}

function getFinalizationPhotoStrengthScore(photo: PhotoItem): number {
  let score = getQualityScore(photo) * 2.5 + getHeroCandidateScore(photo) * 2.1;
  const tags = getPhotoAnalysisTags(photo);

  if (tags.includes("scenic")) {
    score += 0.7;
  }
  if (tags.includes("group")) {
    score += 0.5;
  }
  if (photo.location) {
    score += 0.25;
  }
  if (isWeakPhoto(photo)) {
    score -= 2;
  }

  return score;
}

function getRecentPhotoBurstSignal(source: EventSignalSource, sourcePhotos: PhotoItem[], now: Date): EventSignal | undefined {
  const recentPhotos = sourcePhotos.filter((photo) => now.getTime() - getPhotoTimestamp(photo) <= RECENT_BURST_WINDOW_MS);
  if (recentPhotos.length < RECENT_BURST_MIN_COUNT) {
    return undefined;
  }
  return {
    kind: "photo-spike",
    message:
      source.kind === "memory"
        ? `Suggested because ${recentPhotos.length} photos in "${source.title}" were captured within about 3 days.`
        : `Suggested because ${recentPhotos.length} project photos were captured within about 3 days and may belong in one event memory.`,
    candidatePhotoIds: rankEventCandidatePhotos(recentPhotos).map((photo) => photo.id)
  };
}

function getLargestTimeCluster(memoryPhotos: PhotoItem[]): PhotoItem[] {
  const ordered = sortByTimeline(memoryPhotos);
  let bestStart = 0;
  let bestEnd = 0;
  let bestScore = -Infinity;
  let start = 0;

  for (let end = 0; end < ordered.length; end += 1) {
    while (start <= end && getPhotoTimestamp(ordered[end]) - getPhotoTimestamp(ordered[start]) > TIME_CLUSTER_WINDOW_MS) {
      start += 1;
    }
    const candidate = ordered.slice(start, end + 1);
    const candidateScore =
      candidate.reduce((sum, photo) => sum + getEventPhotoStrengthScore(photo), 0) / Math.max(candidate.length, 1);
    if (end - start > bestEnd - bestStart || (end - start === bestEnd - bestStart && candidateScore > bestScore)) {
      bestStart = start;
      bestEnd = end;
      bestScore = candidateScore;
    }
  }

  return ordered.slice(bestStart, bestEnd + 1);
}

function getTimeClusterSignal(source: EventSignalSource, sourcePhotos: PhotoItem[]): EventSignal | undefined {
  const cluster = getLargestTimeCluster(sourcePhotos);
  if (cluster.length < TIME_CLUSTER_MIN_COUNT) {
    return undefined;
  }
  return {
    kind: "time-cluster",
    message:
      source.kind === "memory"
        ? `Suggested because ${cluster.length} photos in "${source.title}" were taken close together in time.`
        : `Suggested because ${cluster.length} project photos were taken close together in time and look like one event.`,
    candidatePhotoIds: rankEventCandidatePhotos(cluster).map((photo) => photo.id)
  };
}

function getLocationBucketKey(photo: PhotoItem): string | undefined {
  if (!photo.location) {
    return undefined;
  }
  return `${photo.location.latitude.toFixed(2)}:${photo.location.longitude.toFixed(2)}`;
}

function getLocationPatternSignal(source: EventSignalSource, sourcePhotos: PhotoItem[]): EventSignal | undefined {
  const locatedPhotos = sourcePhotos.filter((photo) => photo.location);
  if (locatedPhotos.length < LOCATION_PATTERN_MIN_COUNT) {
    return undefined;
  }

  const distinctBuckets = new Set(
    locatedPhotos
      .map(getLocationBucketKey)
      .filter((bucket): bucket is string => typeof bucket === "string")
  );

  if (distinctBuckets.size < 2) {
    return undefined;
  }

  return {
    kind: "location-pattern",
    message:
      source.kind === "memory"
        ? `Suggested because "${source.title}" includes geotagged photos across ${distinctBuckets.size} nearby places.`
        : `Suggested because these project photos include geotagged movement across ${distinctBuckets.size} nearby places.`,
    candidatePhotoIds: rankEventCandidatePhotos(locatedPhotos).map((photo) => photo.id)
  };
}

function getEventSignalsForSource(source: EventSignalSource, sourcePhotos: PhotoItem[], now: Date): EventSignal[] {
  const signals: EventSignal[] = [];

  const timeClusterSignal = getTimeClusterSignal(source, sourcePhotos);
  if (timeClusterSignal) {
    signals.push(timeClusterSignal);
  }

  const burstSignal = getRecentPhotoBurstSignal(source, sourcePhotos, now);
  if (burstSignal) {
    signals.push(burstSignal);
  }

  const locationSignal = getLocationPatternSignal(source, sourcePhotos);
  if (locationSignal) {
    signals.push(locationSignal);
  }

  return signals;
}

function buildSuggestionId(projectId: string, sourceId: string, kind: EventSignalKind): string {
  return `suggestion:event:${projectId}:${sourceId}:${kind}`;
}

function getProjectMemories(projectId: string, memories: Memory[]): Memory[] {
  return memories.filter((memory) => memory.projectId === projectId);
}

function getSuggestionCreatedAt(
  source: EventSignalSource,
  candidatePhotoIds: string[],
  sourcePhotos: PhotoItem[],
  now: Date
): string {
  const photosById = new Map(sourcePhotos.map((photo) => [photo.id, photo] as const));
  const candidateTimestamps = candidatePhotoIds
    .map((photoId) => photosById.get(photoId))
    .filter((photo): photo is PhotoItem => Boolean(photo))
    .map(getPhotoTimestamp)
    .filter((timestamp) => timestamp > 0);

  if (candidateTimestamps.length > 0) {
    return new Date(Math.min(...candidateTimestamps)).toISOString();
  }

  if (Number.isFinite(Date.parse(source.createdAt))) {
    return source.createdAt;
  }

  return now.toISOString();
}

function formatProjectPoolTitle(groupPhotos: PhotoItem[]): string {
  const ordered = sortByTimeline(groupPhotos);
  const firstTimestamp = getPhotoTimestamp(ordered[0] as PhotoItem);
  const lastTimestamp = getPhotoTimestamp(ordered[ordered.length - 1] as PhotoItem);

  if (firstTimestamp <= 0 || lastTimestamp <= 0) {
    return "Suggested event from project photos";
  }

  const first = new Date(firstTimestamp);
  const last = new Date(lastTimestamp);
  const formatOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const firstLabel = first.toLocaleDateString("en-US", formatOptions);
  const lastLabel = last.toLocaleDateString("en-US", formatOptions);

  if (firstLabel === lastLabel) {
    return `Suggested event from ${firstLabel}`;
  }

  return `Suggested event from ${firstLabel} to ${lastLabel}`;
}

function buildProjectPoolSourceId(groupPhotos: PhotoItem[]): string {
  const ordered = sortByTimeline(groupPhotos);
  const firstId = ordered[0]?.id ?? "start";
  const lastId = ordered[ordered.length - 1]?.id ?? "end";
  return `pool:${firstId}:${lastId}:${ordered.length}`;
}

function getProjectPoolSources(
  projectId: string,
  photos: PhotoItem[],
  now: Date
): { source: EventSignalSource; photos: PhotoItem[] }[] {
  const unassigned = sortByTimeline(photos.filter((photo) => photo.projectId === projectId && !photo.memoryId));
  if (unassigned.length === 0) {
    return [];
  }

  const groups: PhotoItem[][] = [];
  let currentGroup: PhotoItem[] = [];

  for (const photo of unassigned) {
    if (currentGroup.length === 0) {
      currentGroup = [photo];
      continue;
    }

    const previous = currentGroup[currentGroup.length - 1];
    const previousTimestamp = previous ? getPhotoTimestamp(previous) : 0;
    const currentTimestamp = getPhotoTimestamp(photo);

    if (previousTimestamp > 0 && currentTimestamp > 0 && currentTimestamp - previousTimestamp <= PROJECT_POOL_GROUP_GAP_MS) {
      currentGroup.push(photo);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [photo];
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups
    .filter((group) => group.length >= TIME_CLUSTER_MIN_COUNT)
    .map((group) => {
      const createdAtTimestamp = Math.min(...group.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0));
      return {
        source: {
          id: buildProjectPoolSourceId(group),
          kind: "project-pool" as const,
          title: formatProjectPoolTitle(group),
          createdAt:
            Number.isFinite(createdAtTimestamp) && createdAtTimestamp > 0
              ? new Date(createdAtTimestamp).toISOString()
              : now.toISOString()
        },
        photos: group
      };
    });
}

function getDistinctDayCount(photos: PhotoItem[]): number {
  return new Set(
    photos
      .map((photo) => {
        const timestamp = getPhotoTimestamp(photo);
        return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
      })
      .filter((value): value is string => Boolean(value))
  ).size;
}

function buildCollectionSuggestion(projectId: string, photos: PhotoItem[], now: Date): Suggestion | undefined {
  const unassigned = sortByTimeline(photos.filter((photo) => photo.projectId === projectId && !photo.memoryId));
  if (unassigned.length < COLLECTION_MIN_PHOTO_COUNT) {
    return undefined;
  }

  const timestamps = unassigned.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0);
  if (timestamps.length < COLLECTION_MIN_PHOTO_COUNT) {
    return undefined;
  }

  const distinctDays = new Set(
    unassigned
      .map((photo) => {
        const timestamp = getPhotoTimestamp(photo);
        return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
      })
      .filter((value): value is string => Boolean(value))
  );
  const timeSpanDays = Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / DAY_MS);

  if (distinctDays.size < COLLECTION_MIN_DISTINCT_DAYS || timeSpanDays < COLLECTION_SPAN_MIN_DAYS) {
    return undefined;
  }

  return {
    id: `suggestion:collection:${projectId}:project-pool:timespan`,
    projectId,
    type: "collection",
    status: "new",
    title: "Project highlights across time",
    message: `Suggested because ${unassigned.length} project photos span ${timeSpanDays} days and may work better as an evolving collection than a single event.`,
    candidatePhotoIds: suggestCollectionCandidatePhotos(unassigned, []).map((photo) => photo.id),
    createdAt: new Date(Math.min(...timestamps)).toISOString()
  };
}

function getUnassignedProjectPhotos(projectId: string, photos: PhotoItem[]): PhotoItem[] {
  return photos.filter((photo) => photo.projectId === projectId && !photo.memoryId);
}

function buildMissingMomentSuggestions(
  projectId: string,
  memories: Memory[],
  photos: PhotoItem[],
  now: Date
): FinalizationSuggestion[] {
  const coveredDays = new Set(
    photos
      .filter((photo) => photo.projectId === projectId && photo.memoryId && memories.some((memory) => memory.id === photo.memoryId))
      .map((photo) => {
        const timestamp = getPhotoTimestamp(photo);
        return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
      })
      .filter((value): value is string => Boolean(value))
  );

  return getProjectPoolSources(projectId, photos, now)
    .filter(({ photos: sourcePhotos }) => {
      const sourceDays = new Set(
        sourcePhotos
          .map((photo) => {
            const timestamp = getPhotoTimestamp(photo);
            return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
          })
          .filter((value): value is string => Boolean(value))
      );
      return Array.from(sourceDays).some((day) => !coveredDays.has(day));
    })
    .map(({ source, photos: sourcePhotos }) => {
      const ranked = rankEventCandidatePhotos(sourcePhotos);
      const score =
        ranked.reduce((sum, photo) => sum + getFinalizationPhotoStrengthScore(photo), 0) / Math.max(ranked.length, 1);

      return {
        suggestion: {
          id: `finalization:missing:${projectId}:${source.id}`,
          projectId,
          type: "missing-moment" as const,
          title: source.title,
          message: `These photos look like a missing moment near the end of the project and are not strongly represented in existing memories yet.`,
          candidatePhotoIds: ranked.slice(0, 8).map((photo) => photo.id),
          createdAt: getSuggestionCreatedAt(source, ranked.map((photo) => photo.id), sourcePhotos, now)
        },
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, FINALIZATION_MISSING_MOMENT_LIMIT)
    .map((item) => item.suggestion);
}

function buildStrongestUnusedPhotosSuggestion(projectId: string, photos: PhotoItem[], now: Date): FinalizationSuggestion | undefined {
  const unassigned = getUnassignedProjectPhotos(projectId, photos);
  if (unassigned.length === 0) {
    return undefined;
  }

  const ranked = [...unassigned]
    .filter((photo) => !isWeakPhoto(photo) || getQualityScore(photo) >= 0.45)
    .sort((a, b) => {
      const scoreDiff = getFinalizationPhotoStrengthScore(b) - getFinalizationPhotoStrengthScore(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return getPhotoTimestamp(a) - getPhotoTimestamp(b);
    });

  if (ranked.length < 3) {
    return undefined;
  }

  return {
    id: `finalization:unused:${projectId}`,
    projectId,
    type: "strongest-unused-photos",
    title: "Strongest unused photos",
    message: `Suggested because ${ranked.length} strong project photos are still unused and may strengthen the end of the book.`,
    candidatePhotoIds: ranked.slice(0, FINALIZATION_UNUSED_LIMIT).map((photo) => photo.id),
    createdAt: new Date(Math.min(...ranked.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0))).toISOString()
  };
}

function buildRecurringHighlightSuggestions(projectId: string, photos: PhotoItem[]): FinalizationSuggestion[] {
  const projectPhotos = photos.filter((photo) => photo.projectId === projectId);
  const highlightDefinitions = [
    {
      tag: "scenic",
      title: "Scenic highlights",
      message: "Strong scenic moments repeat across the project and could support a final highlight collection.",
      matcher: (photo: PhotoItem) => getPhotoAnalysisTags(photo).includes("scenic")
    },
    {
      tag: "nature-like",
      title: "Nature highlights",
      message: "Nature-leaning photos recur across multiple dates and may be worth a final collection pass.",
      matcher: (photo: PhotoItem) => getPhotoAnalysisTags(photo).includes("nature-like")
    },
    {
      tag: "party-like",
      title: "Celebration highlights",
      message: "Celebration-like moments appear repeatedly and may deserve a recap collection.",
      matcher: (photo: PhotoItem) => getPhotoAnalysisTags(photo).includes("party-like")
    },
    {
      tag: "group",
      title: "Group highlights",
      message: "Group-photo moments appear across the project and could support a final social highlight collection.",
      matcher: (photo: PhotoItem) => getPhotoAnalysisTags(photo).includes("group")
    }
  ] as const;

  const candidates = highlightDefinitions.flatMap((definition) => {
      const matchingPhotos = projectPhotos.filter(definition.matcher);
      const distinctDays = getDistinctDayCount(matchingPhotos);
      if (matchingPhotos.length < FINALIZATION_HIGHLIGHT_MIN_COUNT || distinctDays < FINALIZATION_HIGHLIGHT_MIN_DISTINCT_DAYS) {
        return [];
      }

      const ranked = [...matchingPhotos].sort((a, b) => {
        const scoreDiff = getFinalizationPhotoStrengthScore(b) - getFinalizationPhotoStrengthScore(a);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return getPhotoTimestamp(a) - getPhotoTimestamp(b);
      });

      const score =
        ranked.reduce((sum, photo) => sum + getFinalizationPhotoStrengthScore(photo), 0) / Math.max(ranked.length, 1);

      const suggestion: FinalizationSuggestion = {
          id: `finalization:highlight:${projectId}:${definition.tag}`,
          projectId,
          type: "highlight-collection" as const,
          title: definition.title,
          message: definition.message,
          candidatePhotoIds: ranked.slice(0, 10).map((photo) => photo.id),
          createdAt: new Date(Math.min(...ranked.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0))).toISOString(),
          highlightTag: definition.tag
      };

      return [{
        suggestion,
        score
      }];
    });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, FINALIZATION_HIGHLIGHT_LIMIT)
    .map((item) => item.suggestion);
}

function tokenizeHookTerms(hooks: string[]): string[] {
  return hooks
    .flatMap((hook) => hook.toLowerCase().split(/[^a-z0-9]+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

function selectEvenlySpacedPhotos(photos: PhotoItem[], limit: number): PhotoItem[] {
  if (photos.length <= limit) {
    return photos;
  }
  const ordered = sortByTimeline(photos);
  const selected: PhotoItem[] = [];
  const lastIndex = ordered.length - 1;

  for (let index = 0; index < limit; index += 1) {
    const ratio = limit === 1 ? 0 : index / (limit - 1);
    const sourceIndex = Math.round(ratio * lastIndex);
    const photo = ordered[sourceIndex];
    if (photo && !selected.some((item) => item.id === photo.id)) {
      selected.push(photo);
    }
  }

  if (selected.length < limit) {
    for (const photo of ordered) {
      if (!selected.some((item) => item.id === photo.id)) {
        selected.push(photo);
      }
      if (selected.length >= limit) {
        break;
      }
    }
  }

  return selected;
}

function getHookTagMatches(photo: PhotoItem, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  const photoTags = new Set(getPhotoAnalysisTags(photo));
  return tokens.filter((token) => photoTags.has(token)).length;
}

function getCollectionCandidateScore(photo: PhotoItem, tokens: string[]): number {
  let score = getQualityScore(photo) * 2.5 + getHeroCandidateScore(photo) * 1.5;
  score += getHookTagMatches(photo, tokens) * 1.8;

  const photoTags = new Set(getPhotoAnalysisTags(photo));
  if (photoTags.has("scenic")) {
    score += 0.6;
  }
  if (photoTags.has("group")) {
    score += 0.35;
  }
  if (photo.location) {
    score += 0.3;
  }
  if (isWeakPhoto(photo)) {
    score -= 1.5;
  }

  return score;
}

export function suggestCollectionCandidatePhotos(
  projectPoolPhotos: PhotoItem[],
  hooks: string[],
  limit = COLLECTION_CANDIDATE_LIMIT
): PhotoItem[] {
  if (projectPoolPhotos.length === 0) {
    return [];
  }

  const tokens = tokenizeHookTerms(hooks);
  const wantsLocationBias = tokens.some((token) =>
    ["travel", "trip", "vacation", "beach", "hike", "hiking", "mountain", "roadtrip", "adventure"].includes(token)
  );

  const ordered = sortByTimeline(projectPoolPhotos);
  const preferred = wantsLocationBias ? ordered.filter((photo) => photo.location) : ordered;
  const source = preferred.length >= Math.min(4, limit) ? preferred : ordered;
  const ranked = [...source].sort((a, b) => {
    const scoreDiff = getCollectionCandidateScore(b, tokens) - getCollectionCandidateScore(a, tokens);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return getPhotoTimestamp(a) - getPhotoTimestamp(b);
  });
  const shortlist = sortByTimeline(ranked.slice(0, Math.max(limit, Math.min(ranked.length, limit * 2))));

  return selectEvenlySpacedPhotos(shortlist, limit);
}

export function suggestCandidatePhotosForMemory(
  memory: Memory,
  memoryPhotos: PhotoItem[],
  projectPoolPhotos: PhotoItem[],
  limit = 6
): PhotoItem[] {
  const unassigned = projectPoolPhotos.filter((photo) => photo.projectId === memory.projectId && !photo.memoryId);
  if (unassigned.length === 0) {
    return [];
  }

  if (memory.kind === "collection") {
    return suggestCollectionCandidatePhotos(unassigned, [memory.title, ...(memory.themeTags ?? [])], limit);
  }

  const memoryTimestamps = memoryPhotos.map(getPhotoTimestamp).filter((timestamp) => timestamp > 0);
  const referenceTimestamp =
    memoryTimestamps.length > 0
      ? memoryTimestamps.reduce((sum, timestamp) => sum + timestamp, 0) / memoryTimestamps.length
      : Date.parse(memory.createdAt);
  const memoryLocationBuckets = new Set(
    memoryPhotos
      .map(getLocationBucketKey)
      .filter((bucket): bucket is string => typeof bucket === "string")
  );
  const memoryTagCounts = new Map<string, number>();
  memoryPhotos.forEach((photo) => {
    getPhotoAnalysisTags(photo).forEach((tag) => {
      memoryTagCounts.set(tag, (memoryTagCounts.get(tag) ?? 0) + 1);
    });
  });
  const dominantMemoryTags = new Set(
    Array.from(memoryTagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)
  );

  return unassigned
    .map((photo) => {
      const timestamp = getPhotoTimestamp(photo);
      const diffDays =
        Number.isFinite(referenceTimestamp) && referenceTimestamp > 0 && timestamp > 0
          ? Math.abs(timestamp - referenceTimestamp) / DAY_MS
          : Number.POSITIVE_INFINITY;
      let score = 0;

      if (diffDays <= 1) {
        score += 6;
      } else if (diffDays <= 3) {
        score += 4;
      } else if (diffDays <= 7) {
        score += 2.5;
      } else if (diffDays <= 14) {
        score += 1;
      }

      const bucket = getLocationBucketKey(photo);
      if (bucket && memoryLocationBuckets.has(bucket)) {
        score += 4;
      }

      if (dominantMemoryTags.size > 0) {
        const sharedTags = getPhotoAnalysisTags(photo).filter((tag) => dominantMemoryTags.has(tag)).length;
        score += sharedTags * 1.25;
      }

      score += getQualityScore(photo) * 2.5;
      score += getHeroCandidateScore(photo) * 1.5;

      if (isWeakPhoto(photo)) {
        score -= 2;
      }

      return {
        photo,
        score,
        diffDays
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.diffDays - b.diffDays;
    })
    .slice(0, limit)
    .map((item) => item.photo);
}

export function generateSuggestionsForProject(
  projectId: string,
  memories: Memory[],
  photos: PhotoItem[],
  now: Date = new Date()
): Suggestion[] {
  const projectMemories = getProjectMemories(projectId, memories);
  const memorySuggestions = projectMemories.flatMap((memory) => {
    const memoryPhotos = photos.filter((photo) => photo.memoryId === memory.id);
    const source: EventSignalSource = {
      id: memory.id,
      kind: "memory",
      title: memory.title,
      createdAt: memory.createdAt
    };
    const signals = getEventSignalsForSource(source, memoryPhotos, now);

    return signals.map((signal) => ({
      id: buildSuggestionId(projectId, source.id, signal.kind),
      projectId,
      type: "event" as const,
      status: "new" as const,
      title: signal.kind === "time-cluster" ? `Event around ${memory.title}` : memory.title,
      message: signal.message,
      candidatePhotoIds: signal.candidatePhotoIds,
      createdAt: getSuggestionCreatedAt(source, signal.candidatePhotoIds, memoryPhotos, now)
    }));
  });

  const projectPoolSuggestions = getProjectPoolSources(projectId, photos, now).flatMap(({ source, photos: sourcePhotos }) => {
    const signals = getEventSignalsForSource(source, sourcePhotos, now);

    return signals.map((signal) => ({
      id: buildSuggestionId(projectId, source.id, signal.kind),
      projectId,
      type: "event" as const,
      status: "new" as const,
      title: source.title,
      message: signal.message,
      candidatePhotoIds: signal.candidatePhotoIds,
      createdAt: getSuggestionCreatedAt(source, signal.candidatePhotoIds, sourcePhotos, now)
    }));
  });

  const collectionSuggestion = buildCollectionSuggestion(projectId, photos, now);

  return collectionSuggestion
    ? [...memorySuggestions, ...projectPoolSuggestions, collectionSuggestion]
    : [...memorySuggestions, ...projectPoolSuggestions];
}

export function generateFinalizationSuggestionsForProject(
  projectId: string,
  memories: Memory[],
  photos: PhotoItem[],
  now: Date = new Date()
): FinalizationSuggestion[] {
  const missingMomentSuggestions = buildMissingMomentSuggestions(projectId, memories, photos, now);
  const strongestUnusedPhotosSuggestion = buildStrongestUnusedPhotosSuggestion(projectId, photos, now);
  const recurringHighlightSuggestions = buildRecurringHighlightSuggestions(projectId, photos);

  return strongestUnusedPhotosSuggestion
    ? [...missingMomentSuggestions, strongestUnusedPhotosSuggestion, ...recurringHighlightSuggestions]
    : [...missingMomentSuggestions, ...recurringHighlightSuggestions];
}

export function generatePrompts(memories: Memory[], photos: PhotoItem[], now: Date = new Date()): PromptItem[] {
  const prompts: PromptItem[] = [];

  for (const memory of memories) {
    const memoryPhotos = photos.filter((photo) => photo.memoryId === memory.id);
    const source: EventSignalSource = {
      id: memory.id,
      kind: "memory",
      title: memory.title,
      createdAt: memory.createdAt
    };
    const lastUpdated = new Date(memory.updatedAt).getTime();
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated) / DAY_MS);

    if (daysSinceUpdate >= 7) {
      prompts.push({
        id: makeId("prompt"),
        type: "time-interval",
        title: "Revisit this memory",
        message: `"${memory.title}" has not been updated for ${daysSinceUpdate} days.`,
        memoryId: memory.id
      });
    }

    const burstSignal = getRecentPhotoBurstSignal(source, memoryPhotos, now);
    if (burstSignal) {
      prompts.push({
        id: makeId("prompt"),
        type: "photo-spike",
        title: "Photo burst detected",
        message: `"${memory.title}" has ${burstSignal.candidatePhotoIds.length} new photos in 3 days. Consider generating a page.`,
        memoryId: memory.id
      });
    }

    const locatedPhotos = memoryPhotos.filter((photo) => photo.location);
    if (locatedPhotos.length >= LOCATION_PATTERN_MIN_COUNT) {
      prompts.push({
        id: makeId("prompt"),
        type: "location-pattern",
        title: "Location pattern found",
        message: `"${memory.title}" includes at least 5 photos with location data. Add a map page for context.`,
        memoryId: memory.id
      });
    }
  }

  if (prompts.length === 0 && memories.length > 0) {
    prompts.push({
      id: makeId("prompt"),
      type: "time-interval",
      title: "No active prompts",
      message: "You are up to date. Add a few more photos to trigger smart reminders."
    });
  }

  if (prompts.length === 0 && memories.length === 0) {
    prompts.push({
      id: makeId("prompt"),
      type: "time-interval",
      title: "Create your first memory",
      message: "Start with one mini album and add photos from your library."
    });
  }

  return prompts;
}
