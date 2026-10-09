import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppData, PhotoItem } from "./types";
import {
  normalizeMemoryRecord,
  normalizePhotoRecord,
  normalizeProjectRecord,
  normalizeSuggestionRecord
} from "./context/appDataHelpers";

const STORAGE_KEY = "yearbook-app-data-v1";

const defaultData: AppData = {
  projects: [],
  memories: [],
  pageSections: [],
  photos: [],
  suggestions: []
};

// Thrown when saved data exists but cannot be read or parsed. The stored value is
// left untouched so the user's projects can still be recovered.
export class AppDataLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AppDataLoadError";
  }
}

export async function loadAppData(): Promise<AppData> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Android CursorWindow overflow can make an oversized row unreadable.
    // Never delete it: that would erase every project.
    throw new AppDataLoadError("Saved data could not be read.", error);
  }

  if (!raw) {
    return defaultData;
  }

  try {
    const parsed = JSON.parse(raw) as AppData;
    const normalizedMemories = (parsed.memories ?? []).map(normalizeMemoryRecord);
    const memoryProjectIds = new Map(normalizedMemories.map((memory) => [memory.id, memory.projectId] as const));
    const sanitizedPhotos = (parsed.photos ?? []).map((photo) => {
      const { exportDataUri, ...rest } = photo;
      return rest;
    });
    return {
      projects: (parsed.projects ?? []).map(normalizeProjectRecord),
      memories: normalizedMemories,
      pageSections: parsed.pageSections ?? [],
      photos: sanitizedPhotos
        .map((photo) => normalizePhotoRecord(photo, memoryProjectIds))
        .filter((photo): photo is PhotoItem => Boolean(photo)),
      suggestions: (parsed.suggestions ?? []).map(normalizeSuggestionRecord)
    };
  } catch (error) {
    throw new AppDataLoadError("Saved data could not be parsed.", error);
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  const persistable: AppData = {
    ...data,
    photos: data.photos.map((photo) => {
      const { exportDataUri, ...rest } = photo;
      return rest;
    })
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}
