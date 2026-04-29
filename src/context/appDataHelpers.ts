import { normalizePhotoLocation } from "../lib/photoLocation";
import {
  Memory,
  PhotoAnalysisMetadata,
  PhotoImportMetadata,
  PhotoItem,
  Project,
  ProjectTimelineMode,
  Suggestion
} from "../types";

export type ProjectPhotoScopeOverrides = {
  timelineMode?: ProjectTimelineMode;
  includeFutureProjectPhotos?: boolean;
  startDate?: string;
  endDate?: string;
};

export function normalizeProjectRecord(project: Project): Project {
  const timelineMode = project.timelineMode ?? "ongoing";
  return {
    ...project,
    projectType: project.projectType ?? "general",
    timelineMode,
    includeFutureProjectPhotos: project.includeFutureProjectPhotos ?? timelineMode !== "past",
    startDate: project.startDate ?? undefined,
    endDate: project.endDate ?? undefined,
    assistLevel: project.assistLevel ?? "balanced",
    styleIntensity: project.styleIntensity ?? "warm",
    finalizationStatus: project.finalizationStatus ?? "idle",
    finalizationStartedAt: project.finalizationStartedAt ?? undefined,
    finalizationUpdatedAt: project.finalizationUpdatedAt ?? undefined
  };
}

export function normalizeMemoryRecord(memory: Memory): Memory {
  return {
    ...memory,
    kind: memory.kind ?? "event",
    status: memory.status ?? "active",
    themeTags: Array.isArray(memory.themeTags) ? memory.themeTags.map((tag) => tag.trim()).filter(Boolean) : undefined
  };
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeTagList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePhotoImportMetadata(
  metadata: PhotoImportMetadata | undefined
): PhotoImportMetadata | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const assetId = normalizeOptionalString(metadata.assetId);
  const capturedAtSource =
    metadata.capturedAtSource === "picker" || metadata.capturedAtSource === "media-library"
      ? metadata.capturedAtSource
      : undefined;
  const resolutionKind =
    metadata.resolutionKind === "canonical-direct" ||
    metadata.resolutionKind === "canonical-recovered" ||
    metadata.resolutionKind === "picker-fallback"
      ? metadata.resolutionKind
      : undefined;
  const locationSource =
    metadata.locationSource === "picker" || metadata.locationSource === "media-library"
      ? metadata.locationSource
      : undefined;
  const pickerAssetIdPresent = normalizeOptionalBoolean(metadata.pickerAssetIdPresent);
  const pickerExifPresent = normalizeOptionalBoolean(metadata.pickerExifPresent);
  const pickerKeySample = normalizeTagList(metadata.pickerKeySample);

  return assetId ||
    resolutionKind ||
    capturedAtSource ||
    locationSource ||
    pickerAssetIdPresent !== undefined ||
    pickerExifPresent !== undefined ||
    pickerKeySample
    ? {
        assetId,
        resolutionKind,
        capturedAtSource,
        locationSource,
        pickerAssetIdPresent,
        pickerExifPresent,
        pickerKeySample
      }
    : undefined;
}

export function normalizePhotoAnalysisRecord(analysis: PhotoAnalysisMetadata | undefined): PhotoAnalysisMetadata | undefined {
  if (!analysis || typeof analysis !== "object") {
    return undefined;
  }

  const quality = {
    qualityScore: normalizeOptionalNumber(analysis.quality?.qualityScore),
    heroCandidateScore: normalizeOptionalNumber(analysis.quality?.heroCandidateScore),
    isBlurry: normalizeOptionalBoolean(analysis.quality?.isBlurry),
    isLowLight: normalizeOptionalBoolean(analysis.quality?.isLowLight)
  };
  const subjectCues = {
    portraitLike: normalizeOptionalBoolean(analysis.subjectCues?.portraitLike),
    groupPhotoLike: normalizeOptionalBoolean(analysis.subjectCues?.groupPhotoLike)
  };
  const faces = {
    faceCount: normalizeOptionalNumber(analysis.faces?.faceCount),
    hasFace: normalizeOptionalBoolean(analysis.faces?.hasFace),
    hasMultipleFaces: normalizeOptionalBoolean(analysis.faces?.hasMultipleFaces)
  };
  const similarity = {
    duplicateClusterId: normalizeOptionalString(analysis.similarity?.duplicateClusterId),
    similarityClusterId: normalizeOptionalString(analysis.similarity?.similarityClusterId),
    representativeScore: normalizeOptionalNumber(analysis.similarity?.representativeScore)
  };
  const localOnly = {
    privateFaceDataRef: normalizeOptionalString(analysis.localOnly?.privateFaceDataRef),
    localEmbeddingRef: normalizeOptionalString(analysis.localOnly?.localEmbeddingRef)
  };

  const normalized: PhotoAnalysisMetadata = {
    analysisVersion: normalizeOptionalNumber(analysis.analysisVersion),
    analyzedAt: normalizeOptionalString(analysis.analyzedAt),
    quality: Object.values(quality).some((value) => value !== undefined) ? quality : undefined,
    sceneTags: normalizeTagList(analysis.sceneTags),
    themeTags: normalizeTagList(analysis.themeTags),
    subjectCues: Object.values(subjectCues).some((value) => value !== undefined) ? subjectCues : undefined,
    faces: Object.values(faces).some((value) => value !== undefined) ? faces : undefined,
    similarity: Object.values(similarity).some((value) => value !== undefined) ? similarity : undefined,
    safeExternalTags: normalizeTagList(analysis.safeExternalTags),
    localOnly: Object.values(localOnly).some((value) => value !== undefined) ? localOnly : undefined
  };

  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

export function isPhotoAnalysisCurrent(photo: PhotoItem, analysisVersion: number): boolean {
  return (photo.analysis?.analysisVersion ?? 0) >= analysisVersion;
}

export function mergePhotoAnalysisMetadata(
  existing: PhotoAnalysisMetadata | undefined,
  patch: Partial<PhotoAnalysisMetadata> | undefined,
  options: { analysisVersion: number; analyzedAt: string }
): PhotoAnalysisMetadata {
  const merged = normalizePhotoAnalysisRecord({
    ...existing,
    ...patch,
    analysisVersion: options.analysisVersion,
    analyzedAt: options.analyzedAt,
    quality: {
      ...existing?.quality,
      ...patch?.quality
    },
    sceneTags: patch?.sceneTags ?? existing?.sceneTags,
    themeTags: patch?.themeTags ?? existing?.themeTags,
    subjectCues: {
      ...existing?.subjectCues,
      ...patch?.subjectCues
    },
    faces: {
      ...existing?.faces,
      ...patch?.faces
    },
    similarity: {
      ...existing?.similarity,
      ...patch?.similarity
    },
    safeExternalTags: patch?.safeExternalTags ?? existing?.safeExternalTags,
    localOnly: {
      ...existing?.localOnly,
      ...patch?.localOnly
    }
  });

  return (
    merged ?? {
      analysisVersion: options.analysisVersion,
      analyzedAt: options.analyzedAt
    }
  );
}

export function normalizePhotoRecord(photo: PhotoItem, memoryProjectIds: Map<string, string>): PhotoItem | undefined {
  const projectId =
    typeof photo.projectId === "string" && photo.projectId.trim().length > 0
      ? photo.projectId
      : typeof photo.memoryId === "string"
        ? memoryProjectIds.get(photo.memoryId)
        : undefined;

  if (!projectId) {
    return undefined;
  }

  const memoryId =
    typeof photo.memoryId === "string" && photo.memoryId.trim().length > 0
      ? photo.memoryId
      : undefined;

  return {
    ...photo,
    projectId,
    memoryId,
    location: normalizePhotoLocation(photo.location),
    importMetadata: normalizePhotoImportMetadata(photo.importMetadata),
    analysis: normalizePhotoAnalysisRecord(photo.analysis)
  };
}

export function normalizeSuggestionRecord(suggestion: Suggestion): Suggestion {
  return {
    ...suggestion,
    type: suggestion.type ?? "event",
    status: suggestion.status ?? "new",
    title: suggestion.title ?? "Untitled suggestion",
    message: suggestion.message ?? "",
    candidatePhotoIds: Array.isArray(suggestion.candidatePhotoIds) ? suggestion.candidatePhotoIds : [],
    acceptedMemoryId:
      typeof suggestion.acceptedMemoryId === "string" && suggestion.acceptedMemoryId.trim().length > 0
        ? suggestion.acceptedMemoryId
        : undefined,
    createdAt: suggestion.createdAt ?? new Date().toISOString()
  };
}

export function getPhotoScopeTimestamp(photo: PhotoItem): number {
  const capturedAt = Date.parse(photo.capturedAt);
  if (Number.isFinite(capturedAt)) {
    return capturedAt;
  }
  const addedAt = Date.parse(photo.addedAt);
  if (Number.isFinite(addedAt)) {
    return addedAt;
  }
  return 0;
}

export function getDateBoundary(dateValue?: string, endOfDay = false): number | undefined {
  if (!dateValue) {
    return undefined;
  }
  const timestamp = Date.parse(`${dateValue}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function getScopedProjectPhotos(
  project: Project,
  photos: PhotoItem[],
  scopeOverrides?: ProjectPhotoScopeOverrides
): PhotoItem[] {
  const scopedTimelineMode = scopeOverrides?.timelineMode ?? project.timelineMode;
  const includeFutureProjectPhotos =
    scopeOverrides?.includeFutureProjectPhotos ?? project.includeFutureProjectPhotos;
  const scopedStartDate = scopeOverrides?.startDate ?? project.startDate;
  const scopedEndDate = scopeOverrides?.endDate ?? project.endDate;
  const projectPhotos = photos.filter((photo) => photo.projectId === project.id);

  if (scopedTimelineMode === "ongoing" && includeFutureProjectPhotos && !scopedStartDate && !scopedEndDate) {
    return projectPhotos;
  }

  const startBoundary = getDateBoundary(scopedStartDate);
  const explicitEndBoundary = getDateBoundary(scopedEndDate, true);
  const createdAtBoundary = Date.parse(project.createdAt);
  const endBoundary =
    scopedTimelineMode === "past"
      ? explicitEndBoundary
      : includeFutureProjectPhotos
        ? undefined
        : explicitEndBoundary ?? (Number.isFinite(createdAtBoundary) ? createdAtBoundary : undefined);

  if (startBoundary === undefined && endBoundary === undefined) {
    return projectPhotos;
  }

  return projectPhotos.filter((photo) => {
    const timestamp = getPhotoScopeTimestamp(photo);
    if (startBoundary !== undefined && timestamp < startBoundary) {
      return false;
    }
    if (endBoundary !== undefined && timestamp > endBoundary) {
      return false;
    }
    return true;
  });
}

export function getProjectScanReferenceDate(
  project: Project,
  scopedPhotos: PhotoItem[],
  scopeOverrides?: ProjectPhotoScopeOverrides
): Date {
  const scopedTimelineMode = scopeOverrides?.timelineMode ?? project.timelineMode;
  const includeFutureProjectPhotos =
    scopeOverrides?.includeFutureProjectPhotos ?? project.includeFutureProjectPhotos;
  const scopedEndDate = scopeOverrides?.endDate ?? project.endDate;
  const explicitEndBoundary = getDateBoundary(scopedEndDate, true);
  const createdAtBoundary = Date.parse(project.createdAt);
  const endBoundary =
    scopedTimelineMode === "past"
      ? explicitEndBoundary
      : includeFutureProjectPhotos
        ? undefined
        : explicitEndBoundary ?? (Number.isFinite(createdAtBoundary) ? createdAtBoundary : undefined);
  if (endBoundary !== undefined) {
    return new Date(endBoundary);
  }

  const latestPhotoTimestamp = scopedPhotos.reduce((latest, photo) => Math.max(latest, getPhotoScopeTimestamp(photo)), 0);
  if (latestPhotoTimestamp > 0) {
    return new Date(latestPhotoTimestamp);
  }

  return new Date();
}

export function upsertSuggestionRecords(previous: Suggestion[], nextSuggestions: Suggestion[]): Suggestion[] {
  if (nextSuggestions.length === 0) {
    return previous;
  }
  const byId = new Map(previous.map((suggestion) => [suggestion.id, suggestion] as const));
  nextSuggestions.forEach((suggestion) => {
    const normalized = normalizeSuggestionRecord(suggestion);
    const existing = byId.get(normalized.id);
    byId.set(
      normalized.id,
      existing
        ? {
            ...existing,
            ...normalized,
            status: normalized.status === "new" ? existing.status : normalized.status,
            acceptedMemoryId: existing.acceptedMemoryId ?? normalized.acceptedMemoryId
          }
        : normalized
    );
  });
  return Array.from(byId.values());
}

export function updateSuggestionStatusRecords(
  suggestions: Suggestion[],
  suggestionId: string,
  status: Suggestion["status"]
): Suggestion[] {
  return suggestions.map((suggestion) => {
    if (suggestion.id !== suggestionId || suggestion.status === "accepted" || suggestion.status === status) {
      return suggestion;
    }
    return {
      ...suggestion,
      status
    };
  });
}

export function markSuggestionAccepted(
  suggestions: Suggestion[],
  suggestionId: string,
  memoryId: string
): Suggestion[] {
  return suggestions.map((suggestion) =>
    suggestion.id === suggestionId
      ? {
          ...suggestion,
          status: "accepted",
          acceptedMemoryId: memoryId
        }
      : suggestion
  );
}

export function buildMemorySeedFromSuggestion(suggestion: Suggestion): {
  title: string;
  kind: Memory["kind"];
  status: Memory["status"];
} {
  return {
    title: suggestion.title.trim() || "Suggested Memory",
    kind: suggestion.type === "collection" ? "collection" : "event",
    status: suggestion.type === "collection" ? "watching" : "suggested"
  };
}

export function applyPhotoAssignmentToMemory(params: {
  memories: Memory[];
  photos: PhotoItem[];
  projects: Project[];
  memoryId: string;
  photoIds: string[];
  now?: string;
}): {
  memories: Memory[];
  photos: PhotoItem[];
  projects: Project[];
  touchedProjectId?: string;
} {
  const { memories, photos, projects, memoryId, photoIds, now = new Date().toISOString() } = params;
  if (photoIds.length === 0) {
    return { memories, photos, projects };
  }

  const selected = new Set(photoIds);
  let touchedProjectId = "";

  const nextMemories = memories.map((memory) => {
    if (memory.id !== memoryId) {
      return memory;
    }
    touchedProjectId = memory.projectId;
    return {
      ...memory,
      primaryPhotoId: memory.primaryPhotoId ?? photoIds[0],
      updatedAt: now
    };
  });

  if (!touchedProjectId) {
    return {
      memories: nextMemories,
      photos,
      projects
    };
  }

  const nextPhotos = photos.map((photo) =>
    selected.has(photo.id) && photo.projectId === touchedProjectId && !photo.memoryId
      ? {
          ...photo,
          memoryId
        }
      : photo
  );

  const nextProjects = projects.map((project) =>
    project.id === touchedProjectId ? { ...project, updatedAt: now } : project
  );

  return {
    memories: nextMemories,
    photos: nextPhotos,
    projects: nextProjects,
    touchedProjectId
  };
}
