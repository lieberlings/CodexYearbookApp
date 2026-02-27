import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppData } from "./types";

const STORAGE_KEY = "yearbook-app-data-v1";

const defaultData: AppData = {
  projects: [],
  memories: [],
  pageSections: [],
  photos: []
};

export async function loadAppData(): Promise<AppData> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Android CursorWindow overflow can make this key unreadable.
    // Reset the oversized row so the app can recover.
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
    return defaultData;
  }

  if (!raw) {
    return defaultData;
  }

  try {
    const parsed = JSON.parse(raw) as AppData;
    const sanitizedPhotos = (parsed.photos ?? []).map((photo) => {
      const { exportDataUri, ...rest } = photo;
      return rest;
    });
    return {
      projects: parsed.projects ?? [],
      memories: parsed.memories ?? [],
      pageSections: parsed.pageSections ?? [],
      photos: sanitizedPhotos
    };
  } catch {
    return defaultData;
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
