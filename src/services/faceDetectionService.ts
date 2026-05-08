import { PhotoAnalysisPatch, PhotoAnalysisServiceInput } from "./photoAnalysisTypes";
import { detectFacesLocally } from "./nativeFaceDetection";
import type { NativeFaceDetectionFace } from "./nativeFaceDetection";

// This remains privacy-safe groundwork only. We infer coarse face-related cues from
// already-local structural metadata instead of attempting recognition or cloud calls.
export function detectPhotoFacesHeuristic(input: PhotoAnalysisServiceInput): PhotoAnalysisPatch | undefined {
  const portraitLike = input.photo.analysis?.subjectCues?.portraitLike === true;
  const groupPhotoLike = input.photo.analysis?.subjectCues?.groupPhotoLike === true;

  if (!portraitLike && !groupPhotoLike) {
    return undefined;
  }

  return {
    sources: {
      faces: "heuristic-fallback"
    },
    faces: {
      faceCount: groupPhotoLike ? 2 : 1,
      hasFace: true,
      hasMultipleFaces: groupPhotoLike
    }
  };
}

function getLargestFaceCoverage(faces: NativeFaceDetectionFace[], input: PhotoAnalysisServiceInput): number {
  const width = input.photo.width ?? 0;
  const height = input.photo.height ?? 0;
  const imageArea = width > 0 && height > 0 ? width * height : 0;
  if (imageArea <= 0) {
    return 0;
  }
  return faces.reduce((largest, face) => {
    const area = Math.max(0, face.bounds.width) * Math.max(0, face.bounds.height);
    return Math.max(largest, area / imageArea);
  }, 0);
}

export function buildNativeFacePatch(
  faces: NativeFaceDetectionFace[],
  input: PhotoAnalysisServiceInput
): PhotoAnalysisPatch {
  const faceCount = faces.length;
  const largestCoverage = getLargestFaceCoverage(faces, input);
  return {
    sources: {
      faces: "android-mlkit-face-detection"
    },
    faces: {
      faceCount,
      hasFace: faceCount > 0,
      hasMultipleFaces: faceCount > 1
    },
    subjectCues:
      faceCount > 0
        ? {
            portraitLike: faceCount === 1 && largestCoverage >= 0.05 ? true : undefined,
            groupPhotoLike: faceCount > 1 ? true : undefined
          }
        : undefined,
    nativeFaces: faces.map((face) => ({
      source: "android-mlkit-face-detection",
      ...face
    }))
  };
}

export async function detectPhotoFaces(input: PhotoAnalysisServiceInput): Promise<PhotoAnalysisPatch | undefined> {
  const nativeResult = await detectFacesLocally(input.photo.uri);
  if (nativeResult.available) {
    return buildNativeFacePatch(nativeResult.faces, input);
  }

  return detectPhotoFacesHeuristic(input);
}
