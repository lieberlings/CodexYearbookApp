import { AppData, PhotoItem } from "../types";
import {
  normalizeMemoryRecord,
  normalizePhotoRecord,
  normalizeProjectRecord,
  normalizeSuggestionRecord
} from "../context/appDataHelpers";

export function emptyAppData(): AppData {
  return { projects: [], memories: [], pageSections: [], photos: [], suggestions: [] };
}

// exportDataUri is a large, regenerable cache and is never persisted.
export function stripPhotoExportData(photo: PhotoItem): PhotoItem {
  const { exportDataUri, ...rest } = photo;
  return rest;
}

// The normalization saved data has always gone through on load (formerly inline
// in storage.ts loadAppData). Used for the AsyncStorage blob and for SQLite rows.
export function normalizeAppData(parsed: Partial<AppData>): AppData {
  const normalizedMemories = (parsed.memories ?? []).map(normalizeMemoryRecord);
  const memoryProjectIds = new Map(normalizedMemories.map((memory) => [memory.id, memory.projectId] as const));
  return {
    projects: (parsed.projects ?? []).map(normalizeProjectRecord),
    memories: normalizedMemories,
    pageSections: parsed.pageSections ?? [],
    photos: (parsed.photos ?? [])
      .map(stripPhotoExportData)
      .map((photo) => normalizePhotoRecord(photo, memoryProjectIds))
      .filter((photo): photo is PhotoItem => Boolean(photo)),
    suggestions: (parsed.suggestions ?? []).map(normalizeSuggestionRecord)
  };
}

// Parses the legacy AsyncStorage JSON blob exactly like loadAppData always has.
export function parseLegacyAppData(raw: string): AppData {
  return normalizeAppData(JSON.parse(raw) as AppData);
}
