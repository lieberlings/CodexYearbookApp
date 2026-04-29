import { PhotoAnalysisPatch, PhotoAnalysisServiceInput } from "./photoAnalysisTypes";

// This remains privacy-safe groundwork only. We infer coarse face-related cues from
// already-local structural metadata instead of attempting recognition or cloud calls.
export function detectPhotoFaces(input: PhotoAnalysisServiceInput): PhotoAnalysisPatch | undefined {
  const portraitLike = input.photo.analysis?.subjectCues?.portraitLike === true;
  const groupPhotoLike = input.photo.analysis?.subjectCues?.groupPhotoLike === true;

  if (!portraitLike && !groupPhotoLike) {
    return undefined;
  }

  return {
    faces: {
      faceCount: groupPhotoLike ? 2 : 1,
      hasFace: true,
      hasMultipleFaces: groupPhotoLike
    }
  };
}
