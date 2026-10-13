import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppData } from "./types";
import { AppDataStore, createAppDataStore } from "./data/appDataStore";
import { openExpoSqliteDriver } from "./data/expoSqliteDriver";

export { AppDataLoadError } from "./data/errors";

// The pre-SQLite storage location. It is only ever read (once, to migrate) and
// is kept on the device as a backup.
export const LEGACY_STORAGE_KEY = "yearbook-app-data-v1";

let store: AppDataStore | null = null;

function getStore(): AppDataStore {
  if (!store) {
    store = createAppDataStore({
      openDriver: () => openExpoSqliteDriver(),
      legacyBlob: { read: () => AsyncStorage.getItem(LEGACY_STORAGE_KEY) }
    });
  }
  return store;
}

// Loads saved data from the on-device SQLite database, migrating the legacy
// AsyncStorage blob on first run. Throws AppDataLoadError when saved data exists
// but cannot be read; nothing is deleted in that case.
export function loadAppData(): Promise<AppData> {
  return getStore().load();
}

// Writes only the records that changed since the last load/save. Calls are
// serialized and coalesced; saving is refused until a load has succeeded.
export function saveAppData(data: AppData): Promise<void> {
  return getStore().save(data);
}
