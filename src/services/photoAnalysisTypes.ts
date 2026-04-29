import { PhotoAnalysisMetadata, PhotoItem, Project } from "../types";

export const PHOTO_ANALYSIS_VERSION = 3;

export type PhotoAnalysisPatch = Partial<PhotoAnalysisMetadata>;

export type PhotoAnalysisServiceInput = {
  photo: PhotoItem;
  project?: Project;
  projectPhotos: PhotoItem[];
  now: string;
};

export type PhotoAnalysisService = (
  input: PhotoAnalysisServiceInput
) => Promise<PhotoAnalysisPatch | undefined> | PhotoAnalysisPatch | undefined;

export type PhotoAnalysisRunParams = {
  project?: Project;
  photos: PhotoItem[];
  photoIds?: string[];
  force?: boolean;
  analysisVersion?: number;
  now?: string;
  services?: PhotoAnalysisService[];
};

export type PhotoAnalysisRunResult = {
  photos: PhotoItem[];
  analyzedPhotoIds: string[];
  skippedPhotoIds: string[];
};
