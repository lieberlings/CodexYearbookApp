import { PhotoAnalysisPatch, PhotoAnalysisServiceInput } from "./photoAnalysisTypes";
import { labelImageLocally } from "./nativeImageLabeling";
import type { NativeImageLabel } from "./nativeImageLabeling";

const PARTY_WINDOW_MS = 4 * 60 * 60 * 1000;
const PARTY_CLUSTER_MIN_COUNT = 5;
const PERSISTED_NATIVE_LABEL_THRESHOLD = 0.5;
const MAX_PERSISTED_NATIVE_LABELS = 8;

const NATIVE_LABEL_TAG_MAP: Record<string, string[]> = {
  beach: ["beach", "outdoor"],
  bird: ["animal"],
  building: ["city"],
  "christmas tree": ["holiday-like"],
  city: ["city"],
  cloud: ["outdoor"],
  dog: ["pet-like", "animal"],
  cat: ["pet-like", "animal"],
  dessert: ["food"],
  dish: ["food"],
  face: ["portrait"],
  fireworks: ["celebration-like"],
  flower: ["nature-like"],
  food: ["food"],
  furniture: ["indoor"],
  house: ["indoor"],
  lake: ["water", "outdoor", "nature-like"],
  landscape: ["landscape", "scenic", "outdoor"],
  meal: ["food"],
  mountain: ["mountain", "scenic", "outdoor", "nature-like"],
  ocean: ["water", "beach", "outdoor"],
  person: ["portrait"],
  plant: ["nature-like"],
  sky: ["outdoor"],
  snow: ["winter-like", "outdoor"],
  stadium: ["sports-like"],
  sunset: ["sunset-like", "scenic", "outdoor"],
  tree: ["nature-like", "outdoor"],
  vehicle: ["travel"],
  water: ["water", "outdoor"]
};

function normalizeLabelKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeTagsFromNativeImageLabels(labels: NativeImageLabel[]): string[] {
  const tags = new Set<string>();
  labels.forEach((label) => {
    if (label.confidence < PERSISTED_NATIVE_LABEL_THRESHOLD) {
      return;
    }
    const mapped = NATIVE_LABEL_TAG_MAP[normalizeLabelKey(label.text)];
    mapped?.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
}

function buildNativeLabelPatch(labels: NativeImageLabel[]): PhotoAnalysisPatch | undefined {
  const strongLabels = labels
    .filter((label) => label.confidence >= PERSISTED_NATIVE_LABEL_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_PERSISTED_NATIVE_LABELS);

  if (strongLabels.length === 0) {
    return undefined;
  }

  const normalizedTags = normalizeTagsFromNativeImageLabels(strongLabels);
  return {
    nativeLabels: strongLabels.map((label) => ({
      source: "android-mlkit-image-labeling",
      text: label.text,
      confidence: Number(label.confidence.toFixed(4)),
      index: label.index,
      normalizedTag: NATIVE_LABEL_TAG_MAP[normalizeLabelKey(label.text)]?.[0]
    })),
    safeExternalTags: normalizedTags.length > 0 ? normalizedTags : undefined
  };
}

function getPhotoTimestamp(input: PhotoAnalysisServiceInput): number {
  const capturedAt = Date.parse(input.photo.capturedAt);
  if (Number.isFinite(capturedAt)) {
    return capturedAt;
  }
  const addedAt = Date.parse(input.photo.addedAt);
  if (Number.isFinite(addedAt)) {
    return addedAt;
  }
  return 0;
}

function getCaptureHour(input: PhotoAnalysisServiceInput): number | undefined {
  const timestamp = getPhotoTimestamp(input);
  return timestamp > 0 ? new Date(timestamp).getUTCHours() : undefined;
}

function getNearbyProjectClusterCount(input: PhotoAnalysisServiceInput): number {
  const anchor = getPhotoTimestamp(input);
  if (anchor <= 0) {
    return 0;
  }

  return input.projectPhotos.filter((photo) => {
    const timestamp = Number.isFinite(Date.parse(photo.capturedAt))
      ? Date.parse(photo.capturedAt)
      : Date.parse(photo.addedAt);
    return Number.isFinite(timestamp) && Math.abs(timestamp - anchor) <= PARTY_WINDOW_MS;
  }).length;
}

export async function analyzePhotoScene(input: PhotoAnalysisServiceInput): Promise<PhotoAnalysisPatch | undefined> {
  const width = input.photo.width ?? 0;
  const height = input.photo.height ?? 0;
  const hasDimensions = width > 0 && height > 0;
  const aspectRatio = hasDimensions ? width / height : 1;
  const captureHour = getCaptureHour(input);
  const clusterCount = getNearbyProjectClusterCount(input);
  const sceneTags = new Set<string>();
  const themeTags = new Set<string>();
  const subjectCues: NonNullable<PhotoAnalysisPatch["subjectCues"]> = {};

  if (aspectRatio >= 1.25) {
    sceneTags.add("landscape");
  }
  if (aspectRatio >= 1.55) {
    sceneTags.add("scenic");
  }
  if (aspectRatio <= 0.82) {
    sceneTags.add("portrait");
    subjectCues.portraitLike = true;
  }

  if (input.photo.location || sceneTags.has("scenic")) {
    sceneTags.add("outdoor");
  }

  if (!sceneTags.has("outdoor") && !sceneTags.has("landscape") && input.photo.analysis?.quality?.isLowLight) {
    sceneTags.add("indoor");
  }

  if (captureHour !== undefined) {
    if (captureHour >= 17 && captureHour <= 20) {
      themeTags.add("sunset-like");
    } else if (captureHour >= 21 || captureHour <= 5) {
      themeTags.add("night-like");
    } else {
      themeTags.add("daytime");
    }
  }

  if (clusterCount >= PARTY_CLUSTER_MIN_COUNT && captureHour !== undefined && captureHour >= 18) {
    themeTags.add("party-like");
  }

  if (input.project?.projectType === "vacation" && sceneTags.has("outdoor")) {
    themeTags.add("nature-like");
  }

  if (!input.photo.analysis?.faces?.hasMultipleFaces && clusterCount >= PARTY_CLUSTER_MIN_COUNT && aspectRatio >= 1 && aspectRatio <= 2) {
    subjectCues.groupPhotoLike = true;
  }

  if (input.photo.analysis?.faces?.hasMultipleFaces) {
    sceneTags.add("group");
    subjectCues.groupPhotoLike = true;
  }

  const heuristicPatch: PhotoAnalysisPatch | undefined =
    sceneTags.size === 0 && themeTags.size === 0 && Object.keys(subjectCues).length === 0
      ? undefined
      : {
          sceneTags: Array.from(sceneTags).sort(),
          themeTags: Array.from(themeTags).sort(),
          subjectCues: Object.keys(subjectCues).length > 0 ? subjectCues : undefined
        };

  const nativeResult = await labelImageLocally(input.photo.uri);
  const nativePatch = nativeResult.available ? buildNativeLabelPatch(nativeResult.labels) : undefined;

  if (!heuristicPatch && !nativePatch) {
    return undefined;
  }

  return {
    ...heuristicPatch,
    ...nativePatch
  };
}
