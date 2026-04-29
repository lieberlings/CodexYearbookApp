import { PhotoAnalysisPatch, PhotoAnalysisServiceInput } from "./photoAnalysisTypes";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Number(clamp01(value).toFixed(3));
}

function getCaptureHour(input: PhotoAnalysisServiceInput): number | undefined {
  const timestamp = Date.parse(input.photo.capturedAt);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return new Date(timestamp).getUTCHours();
}

export function analyzePhotoQuality(input: PhotoAnalysisServiceInput): PhotoAnalysisPatch | undefined {
  const width = input.photo.width ?? 0;
  const height = input.photo.height ?? 0;
  const hasDimensions = width > 0 && height > 0;
  const minSide = hasDimensions ? Math.min(width, height) : 0;
  const aspectRatio = hasDimensions ? width / height : 1;
  const megaPixels = hasDimensions ? (width * height) / 1_000_000 : 0;
  const captureHour = getCaptureHour(input);
  const isLowLight = captureHour !== undefined ? captureHour <= 6 || captureHour >= 20 : false;
  const isBlurry = hasDimensions ? minSide < 900 || megaPixels < 1.5 : false;

  let qualityScore = 0.45;
  if (megaPixels >= 12) {
    qualityScore += 0.2;
  } else if (megaPixels >= 8) {
    qualityScore += 0.16;
  } else if (megaPixels >= 4) {
    qualityScore += 0.12;
  } else if (megaPixels >= 2) {
    qualityScore += 0.06;
  } else if (hasDimensions) {
    qualityScore -= 0.08;
  }

  if (minSide > 0 && minSide < 700) {
    qualityScore -= 0.14;
  } else if (minSide > 0 && minSide < 1100) {
    qualityScore -= 0.08;
  }

  if (aspectRatio > 2.4 || aspectRatio < 0.42) {
    qualityScore -= 0.06;
  }

  if (isLowLight) {
    qualityScore -= 0.08;
  }
  if (isBlurry) {
    qualityScore -= 0.1;
  }

  let heroCandidateScore = qualityScore;
  if (hasDimensions && width >= height) {
    heroCandidateScore += 0.08;
  }
  if (hasDimensions && minSide >= 1200) {
    heroCandidateScore += 0.06;
  }
  if (aspectRatio >= 1.25 && aspectRatio <= 1.9) {
    heroCandidateScore += 0.05;
  }
  if (input.photo.location) {
    heroCandidateScore += 0.04;
  }
  if (isLowLight) {
    heroCandidateScore -= 0.03;
  }

  return {
    quality: {
      qualityScore: roundScore(qualityScore),
      heroCandidateScore: roundScore(heroCandidateScore),
      isBlurry,
      isLowLight
    }
  };
}
