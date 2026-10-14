import type { PhotoItem } from "../../types";
import {
  applyPulledRows,
  CLOUD_TABLES,
  confirmPush,
  emptyPatch,
  photoStoragePath,
  photosNeedingDownload,
  photosNeedingUpload,
  planPush,
  type CloudRecords,
  type CloudRow,
  type CloudTable,
  type LocalPatch,
  type SyncState
} from "./model";

// Everything sync needs from the outside world. The real one talks to Supabase
// (supabaseApi.ts); tests use an in-memory fake.
export interface CloudApi {
  upsert(table: CloudTable, rows: CloudRow[]): Promise<void>;
  markDeleted(table: CloudTable, ids: string[]): Promise<void>;
  // Rows changed after `cursor` (server time), oldest first.
  pullSince(table: CloudTable, cursor: string | undefined): Promise<CloudRow[]>;
  uploadPhotoFile(path: string, localUri: string): Promise<void>;
  setPhotoStoragePath(photoId: string, path: string): Promise<void>;
  // Downloads a photo file to app storage and returns its local uri.
  downloadPhotoFile(path: string, photoId: string): Promise<string>;
}

const PULL_OVERLAP_MS = 2 * 60 * 1000;

export type SyncReport = {
  pushed: number;
  pulled: number;
  uploaded: number;
  downloaded: number;
  // Per-photo failures are reported, not thrown, so one bad file doesn't stop sync.
  fileErrors: string[];
};

export type SyncResult = { state: SyncState; patch: LocalPatch; report: SyncReport };

// One sync round: push local changes, pull remote ones, then move photo files.
// Returns the changes for the app to apply; it never edits app data itself, so
// edits made while sync runs are not overwritten.
export async function runSync(api: CloudApi, records: CloudRecords, initialState: SyncState): Promise<SyncResult> {
  let state = initialState;
  const report: SyncReport = { pushed: 0, pulled: 0, uploaded: 0, downloaded: 0, fileErrors: [] };

  // 1. Push. Parents first so foreign keys hold; deletions are tombstones.
  const plan = planPush(records, state);
  for (const table of CLOUD_TABLES) {
    if (plan.upserts[table].length > 0) {
      await api.upsert(table, plan.upserts[table]);
      report.pushed += plan.upserts[table].length;
    }
  }
  for (const table of [...CLOUD_TABLES].reverse()) {
    if (plan.deletions[table].length > 0) {
      await api.markDeleted(table, plan.deletions[table]);
      report.pushed += plan.deletions[table].length;
    }
  }
  state = confirmPush(state, plan);

  // 2. Pull everything changed since the last pull, this round's push included,
  // so the cursor moves past it.
  // The cursor is wound back a little: a write that committed late can carry an
  // earlier timestamp than rows already seen. Re-reading is harmless because
  // unchanged rows are skipped.
  const pullFrom = state.pullCursor
    ? new Date(Date.parse(state.pullCursor) - PULL_OVERLAP_MS).toISOString()
    : undefined;
  const pulled: Record<CloudTable, CloudRow[]> = { projects: [], memories: [], page_sections: [], photos: [] };
  for (const table of CLOUD_TABLES) {
    pulled[table] = await api.pullSince(table, pullFrom);
    report.pulled += pulled[table].length;
  }
  const applied = applyPulledRows(records, state, pulled);
  state = applied.state;
  const patch = applied.patch;

  // 3. Upload files of photos the cloud doesn't have yet.
  const recordsAfterPull = mergeForFiles(records, patch);
  for (const photo of photosNeedingUpload(recordsAfterPull, state)) {
    const path = photoStoragePath(photo);
    try {
      await api.uploadPhotoFile(path, photo.uri);
      await api.setPhotoStoragePath(photo.id, path);
      state = { ...state, uploadedFiles: { ...state.uploadedFiles, [photo.id]: path } };
      report.uploaded += 1;
    } catch (error) {
      report.fileErrors.push(`Upload ${photo.id}: ${(error as Error).message}`);
    }
  }

  // 4. Download files for photos that arrived without one.
  for (const { photo, path } of photosNeedingDownload(recordsAfterPull, state)) {
    try {
      const uri = await api.downloadPhotoFile(path, photo.id);
      upsertPhoto(patch, { ...photo, uri });
      report.downloaded += 1;
    } catch (error) {
      report.fileErrors.push(`Download ${photo.id}: ${(error as Error).message}`);
    }
  }

  return { state, patch, report };
}

// The records as they will be once `patch` is applied, enough to pick files to move.
function mergeForFiles(records: CloudRecords, patch: LocalPatch): CloudRecords {
  const removed = new Set(patch.remove.photos);
  const photos = new Map(records.photos.filter((photo) => !removed.has(photo.id)).map((photo) => [photo.id, photo]));
  for (const photo of patch.upsert.photos) {
    photos.set(photo.id, photo);
  }
  return { ...records, photos: [...photos.values()] };
}

function upsertPhoto(patch: LocalPatch, photo: PhotoItem) {
  const index = patch.upsert.photos.findIndex((item) => item.id === photo.id);
  if (index >= 0) {
    patch.upsert.photos[index] = photo;
  } else {
    patch.upsert.photos.push(photo);
  }
}

export { emptyPatch };
