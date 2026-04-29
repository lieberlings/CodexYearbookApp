import { PhotoAnalysisPatch, PhotoAnalysisServiceInput } from "./photoAnalysisTypes";

const PARTY_WINDOW_MS = 4 * 60 * 60 * 1000;
const PARTY_CLUSTER_MIN_COUNT = 5;

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

export function analyzePhotoScene(input: PhotoAnalysisServiceInput): PhotoAnalysisPatch | undefined {
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

  if (sceneTags.size === 0 && themeTags.size === 0 && Object.keys(subjectCues).length === 0) {
    return undefined;
  }

  return {
    sceneTags: Array.from(sceneTags).sort(),
    themeTags: Array.from(themeTags).sort(),
    subjectCues: Object.keys(subjectCues).length > 0 ? subjectCues : undefined
  };
}
