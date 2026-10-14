import type { AppData, Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import type {
  CloudCollection,
  CloudMemoryRow,
  CloudPageSectionRow,
  CloudPhotoRow,
  CloudProjectRow,
  CloudRole,
  CloudRowByCollection,
  LocalRecordByCollection
} from "./records";

export type Membership = { projectId: string; role: CloudRole; ownerId: string; deleted: boolean };

export type PulledRows = {
  projects: CloudProjectRow[];
  memories: CloudMemoryRow[];
  pageSections: CloudPageSectionRow[];
  photos: CloudPhotoRow[];
};

// The database, as the sync engine needs it. The app uses the Supabase
// implementation in remoteApi.ts; tests use an in-memory fake.
export interface RemoteApi {
  readonly userId: string;
  listMemberships(): Promise<Membership[]>;
  // Rows of one project changed since `since` (all rows when null),
  // deleted ones included.
  pull(projectId: string, since: string | null): Promise<PulledRows>;
  fetchByIds<C extends CloudCollection>(collection: C, projectId: string, ids: string[]): Promise<CloudRowByCollection[C][]>;
  upsert<C extends CloudCollection>(collection: C, rows: Record<string, unknown>[]): Promise<CloudRowByCollection[C][]>;
  softDelete(collection: CloudCollection, projectId: string, ids: string[]): Promise<void>;
  leaveProject(projectId: string): Promise<void>;
}

export interface PhotoFiles {
  // Uploads a print-quality copy of the photo to `path`.
  upload(photo: PhotoItem, path: string): Promise<void>;
  // Downloads the shared copy and returns a local file uri.
  download(path: string, projectId: string, photoId: string): Promise<string>;
}

// What this device last synced for each record (by hash), and how far it has
// pulled each project.
export type ProjectSyncState = { hashes: Map<string, string>; cursor: string | null };
export interface SyncStateStore {
  listProjects(): Promise<string[]>;
  load(projectId: string): Promise<ProjectSyncState>;
  save(projectId: string, changes: { set: [string, string][]; remove: string[]; cursor: string | null }): Promise<void>;
  forget(projectId: string): Promise<void>;
}

export function stateKey(collection: CloudCollection, id: string): string {
  return `${collection}:${id}`;
}

// Changes to apply to the app's data. `base` is the record the sync saw; a
// change is skipped when the person edited that record meanwhile, and the
// next sync picks the edit up.
export type PatchUpsert<T> = { record: T; base: T | undefined };
export type PatchDelete<T> = { id: string; base: T | undefined };
export type CloudPatch = {
  [C in CloudCollection]: { upserts: PatchUpsert<LocalRecordByCollection[C]>[]; deletes: PatchDelete<LocalRecordByCollection[C]>[] };
};

export function emptyCloudPatch(): CloudPatch {
  return {
    projects: { upserts: [], deletes: [] },
    memories: { upserts: [], deletes: [] },
    pageSections: { upserts: [], deletes: [] },
    photos: { upserts: [], deletes: [] }
  };
}

export function isEmptyCloudPatch(patch: CloudPatch): boolean {
  return Object.values(patch).every((part) => part.upserts.length === 0 && part.deletes.length === 0);
}

type Identified = { id: string };

export function applyPatchPart<T extends Identified>(current: T[], part: { upserts: PatchUpsert<T>[]; deletes: PatchDelete<T>[] }): T[] {
  if (part.upserts.length === 0 && part.deletes.length === 0) {
    return current;
  }
  const byId = new Map(current.map((record, index) => [record.id, index] as const));
  const next = [...current];
  const removed = new Set<number>();
  for (const { record, base } of part.upserts) {
    const index = byId.get(record.id);
    if (index === undefined) {
      if (base === undefined) {
        byId.set(record.id, next.length);
        next.push(record);
      }
      continue;
    }
    if (next[index] === base) {
      next[index] = record;
    }
  }
  for (const { id, base } of part.deletes) {
    const index = byId.get(id);
    if (index !== undefined && next[index] === base) {
      removed.add(index);
    }
  }
  return removed.size ? next.filter((_, index) => !removed.has(index)) : next;
}

export function applyCloudPatchToData(data: Pick<AppData, CloudCollection>, patch: CloudPatch) {
  return {
    projects: applyPatchPart<Project>(data.projects, patch.projects),
    memories: applyPatchPart<Memory>(data.memories, patch.memories),
    pageSections: applyPatchPart<MemoryPageSection>(data.pageSections, patch.pageSections),
    photos: applyPatchPart<PhotoItem>(data.photos, patch.photos)
  };
}
