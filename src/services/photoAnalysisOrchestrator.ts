import { isPhotoAnalysisCurrent, mergePhotoAnalysisMetadata } from "../context/appDataHelpers";
import { PhotoItem } from "../types";
import { detectPhotoFaces } from "./faceDetectionService";
import { analyzePhotoQuality } from "./photoQualityService";
import { analyzePhotoScene } from "./sceneAnalysisService";
import { analyzePhotoSimilarity } from "./photoSimilarityService";
import {
  PHOTO_ANALYSIS_VERSION,
  PhotoAnalysisRunParams,
  PhotoAnalysisRunResult,
  PhotoAnalysisService
} from "./photoAnalysisTypes";

export const defaultPhotoAnalysisServices: PhotoAnalysisService[] = [
  analyzePhotoQuality,
  analyzePhotoScene,
  detectPhotoFaces,
  analyzePhotoSimilarity
];

function getTargetPhotos(params: PhotoAnalysisRunParams): PhotoItem[] {
  const scoped = params.project
    ? params.photos.filter((photo) => photo.projectId === params.project?.id)
    : params.photos;

  if (!params.photoIds || params.photoIds.length === 0) {
    return scoped;
  }

  const targetIds = new Set(params.photoIds);
  return scoped.filter((photo) => targetIds.has(photo.id));
}

export async function runPhotoAnalysisOrchestrator(params: PhotoAnalysisRunParams): Promise<PhotoAnalysisRunResult> {
  const now = params.now ?? new Date().toISOString();
  const analysisVersion = params.analysisVersion ?? PHOTO_ANALYSIS_VERSION;
  const services = params.services ?? defaultPhotoAnalysisServices;
  const projectPhotos = params.project
    ? params.photos.filter((photo) => photo.projectId === params.project?.id)
    : params.photos;
  const targetPhotos = getTargetPhotos(params);

  if (targetPhotos.length === 0) {
    return {
      photos: params.photos,
      analyzedPhotoIds: [],
      skippedPhotoIds: []
    };
  }

  const updatedById = new Map<string, PhotoItem>();
  const analyzedPhotoIds: string[] = [];
  const skippedPhotoIds: string[] = [];

  for (const photo of targetPhotos) {
    if (!params.force && isPhotoAnalysisCurrent(photo, analysisVersion)) {
      skippedPhotoIds.push(photo.id);
      continue;
    }

    let nextPhoto = photo;
    for (const service of services) {
      const patch = await service({
        photo: nextPhoto,
        project: params.project,
        projectPhotos,
        now
      });
      nextPhoto = {
        ...nextPhoto,
        analysis: mergePhotoAnalysisMetadata(nextPhoto.analysis, patch, {
          analysisVersion,
          analyzedAt: now
        })
      };
    }

    // Even if a service returns no patch, we still record that this version ran.
    if (!nextPhoto.analysis) {
      nextPhoto = {
        ...nextPhoto,
        analysis: mergePhotoAnalysisMetadata(undefined, undefined, {
          analysisVersion,
          analyzedAt: now
        })
      };
    }

    updatedById.set(nextPhoto.id, nextPhoto);
    analyzedPhotoIds.push(nextPhoto.id);
  }

  const photos = params.photos.map((photo) => updatedById.get(photo.id) ?? photo);

  return {
    photos,
    analyzedPhotoIds,
    skippedPhotoIds
  };
}
