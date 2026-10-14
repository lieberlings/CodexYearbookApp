import type { AppData, MemoryPageSection, PhotoItem, Project } from "../types";
import { cloudPhotoPath } from "./config";
import {
  AccessContext,
  canDeleteRecord,
  canWriteRecord,
  CLOUD_COLLECTIONS,
  cloudData,
  CloudCollection,
  CloudMemoryRow,
  CloudPageSectionRow,
  CloudPhotoRow,
  CloudProjectRow,
  CloudRole,
  CloudRowByCollection,
  LocalRecordByCollection,
  memoryArea,
  memoryFromCloud,
  pageSectionFromCloud,
  photoFromCloud,
  projectFromCloud,
  recordHash,
  stableStringify
} from "./records";
import { CloudPatch, emptyCloudPatch, Membership, PhotoFiles, RemoteApi, stateKey, SyncStateStore } from "./syncTypes";

export type SyncDeps = {
  remote: RemoteApi;
  state: SyncStateStore;
  files: PhotoFiles;
  warn?: (message: string, details?: unknown) => void;
  onProgress?: (progress: SyncProgress) => void;
};

export type SyncProgress = { phase: "pulling" | "downloading" | "uploading" | "saving"; projectId: string; done: number; total: number };

export type SyncResult = {
  patch: CloudPatch;
  // Projects this account can no longer open; their local copy is kept.
  lostAccess: string[];
  // Problems that didn't stop the rest of the sync.
  errors: string[];
};

type RecordMaps = { [C in CloudCollection]: Map<string, LocalRecordByCollection[C]> };

const UPSERT_CHUNK = 200;

function fromCloud<C extends CloudCollection>(
  collection: C,
  row: CloudRowByCollection[C],
  role: CloudRole,
  existing: LocalRecordByCollection[C] | undefined
): LocalRecordByCollection[C] {
  switch (collection) {
    case "projects":
      return projectFromCloud(row as CloudProjectRow, role, existing as Project | undefined) as LocalRecordByCollection[C];
    case "memories":
      return memoryFromCloud(row as CloudMemoryRow) as LocalRecordByCollection[C];
    case "pageSections":
      return pageSectionFromCloud(row as CloudPageSectionRow, existing as MemoryPageSection | undefined) as LocalRecordByCollection[C];
    default:
      return photoFromCloud(row as CloudPhotoRow, existing as PhotoItem | undefined) as LocalRecordByCollection[C];
  }
}

function sameRecord(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function projectRecords(data: AppData, projectId: string): RecordMaps {
  const memories = data.memories.filter((memory) => memory.projectId === projectId);
  const memoryIds = new Set(memories.map((memory) => memory.id));
  return {
    projects: new Map(data.projects.filter((project) => project.id === projectId).map((project) => [project.id, project])),
    memories: new Map(memories.map((memory) => [memory.id, memory])),
    pageSections: new Map(data.pageSections.filter((section) => memoryIds.has(section.memoryId)).map((section) => [section.id, section])),
    photos: new Map(data.photos.filter((photo) => photo.projectId === projectId).map((photo) => [photo.id, photo]))
  };
}

function toRow<C extends CloudCollection>(
  collection: C,
  record: LocalRecordByCollection[C],
  projectId: string,
  photos: Map<string, PhotoItem>
): Record<string, unknown> {
  const data = cloudData(collection, record);
  switch (collection) {
    case "projects":
      return { id: record.id, data, deleted_at: null };
    case "memories": {
      const area = memoryArea(record.id, [...photos.values()]);
      return {
        project_id: projectId,
        id: record.id,
        data,
        deleted_at: null,
        // Devices without location data for the photos keep what's there.
        ...(area.date_from ? { date_from: area.date_from, date_to: area.date_to } : {}),
        ...(area.area_lat !== null ? { area_lat: area.area_lat, area_lng: area.area_lng } : {})
      };
    }
    case "pageSections":
      return { project_id: projectId, id: record.id, memory_id: (record as MemoryPageSection).memoryId, data, deleted_at: null };
    default: {
      const photo = record as PhotoItem;
      return { project_id: projectId, id: photo.id, memory_id: photo.memoryId ?? null, storage_path: photo.cloud?.path ?? null, data, deleted_at: null };
    }
  }
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export async function runCloudSync(local: AppData, deps: SyncDeps): Promise<SyncResult> {
  const { remote, state } = deps;
  const warn = deps.warn ?? (() => undefined);
  const patch = emptyCloudPatch();
  const errors: string[] = [];
  const lostAccess: string[] = [];
  // Final version of every changed record, with the version the sync started from.
  const changes: { [C in CloudCollection]: Map<string, { record?: LocalRecordByCollection[C]; base: LocalRecordByCollection[C] | undefined }> } = {
    projects: new Map(),
    memories: new Map(),
    pageSections: new Map(),
    photos: new Map()
  };

  const memberships = await remote.listMemberships();
  const membershipById = new Map(memberships.map((membership) => [membership.projectId, membership] as const));
  const knownProjects = new Set(await state.listProjects());
  const localProjects = new Map(local.projects.map((project) => [project.id, project] as const));

  const work: { projectId: string; membership: Membership | undefined; firstUpload: boolean }[] = [];

  for (const project of local.projects) {
    if (!project.cloud || project.cloud.accessRemovedAt) continue;
    const membership = membershipById.get(project.id);
    if (membership) {
      // A deleted project is pulled once more so its removal reaches this phone.
      work.push({ projectId: project.id, membership, firstUpload: false });
    } else if (!membership && project.cloud.role === "owner" && !knownProjects.has(project.id)) {
      // Backup was just turned on; the first sync uploads it.
      work.push({ projectId: project.id, membership: undefined, firstUpload: true });
    } else {
      lostAccess.push(project.id);
      changes.projects.set(project.id, {
        record: { ...project, cloud: { ...project.cloud, accessRemovedAt: new Date().toISOString() } },
        base: project
      });
      await state.forget(project.id);
    }
  }
  for (const membership of memberships) {
    if (!membership.deleted && !localProjects.has(membership.projectId)) {
      // Shared with this account, or deleted here: tell them apart by whether
      // this device has synced it before.
      if (knownProjects.has(membership.projectId)) {
        try {
          if (membership.role === "owner") {
            await remote.softDelete("projects", membership.projectId, [membership.projectId]);
          } else {
            await remote.leaveProject(membership.projectId);
          }
          await state.forget(membership.projectId);
        } catch (error) {
          errors.push(`Couldn't remove a deleted project from the cloud: ${String(error)}`);
          warn("Cloud delete failed", error);
        }
      } else {
        work.push({ projectId: membership.projectId, membership, firstUpload: false });
      }
    }
  }

  for (const item of work) {
    try {
      await syncProject(item.projectId, item.membership?.role ?? "owner", local, deps, changes, item.firstUpload);
    } catch (error) {
      errors.push(`Sync failed for a project: ${error instanceof Error ? error.message : String(error)}`);
      warn("Project sync failed", error);
    }
  }

  for (const collection of CLOUD_COLLECTIONS) {
    changes[collection].forEach((change, id) => {
      const part = patch[collection] as CloudPatch[CloudCollection];
      if (change.record) {
        (part.upserts as { record: unknown; base: unknown }[]).push({ record: change.record, base: change.base });
      } else {
        (part.deletes as { id: string; base: unknown }[]).push({ id, base: change.base });
      }
    });
  }
  return { patch, lostAccess, errors };
}

async function syncProject(
  projectId: string,
  role: CloudRole,
  local: AppData,
  deps: SyncDeps,
  changes: { [C in CloudCollection]: Map<string, { record?: LocalRecordByCollection[C]; base: LocalRecordByCollection[C] | undefined }> },
  firstUpload: boolean
): Promise<void> {
  const { remote, state, files } = deps;
  const userId = remote.userId;
  const progress = deps.onProgress ?? (() => undefined);
  const original = projectRecords(local, projectId);
  const merged: RecordMaps = {
    projects: new Map(original.projects),
    memories: new Map(original.memories),
    pageSections: new Map(original.pageSections),
    photos: new Map(original.photos)
  };
  const { hashes, cursor } = await state.load(projectId);
  const setHashes = new Map<string, string>();
  const removeHashes = new Set<string>();
  const syncedHash = (key: string) => (removeHashes.has(key) ? undefined : setHashes.get(key) ?? hashes.get(key));
  const remember = (key: string, hash: string) => {
    removeHashes.delete(key);
    setHashes.set(key, hash);
  };
  const forgetKey = (key: string) => {
    setHashes.delete(key);
    removeHashes.add(key);
  };

  function record<C extends CloudCollection>(collection: C, id: string, next: LocalRecordByCollection[C] | undefined) {
    const map = changes[collection] as Map<string, { record?: LocalRecordByCollection[C]; base: LocalRecordByCollection[C] | undefined }>;
    const base = map.has(id) ? map.get(id)!.base : (original[collection] as Map<string, LocalRecordByCollection[C]>).get(id);
    if (next === undefined) {
      (merged[collection] as Map<string, LocalRecordByCollection[C]>).delete(id);
      if (base === undefined) map.delete(id);
      else map.set(id, { base });
    } else {
      (merged[collection] as Map<string, LocalRecordByCollection[C]>).set(id, next);
      map.set(id, { record: next, base });
    }
  }

  const access = (): AccessContext => ({ role, userId, memoriesById: merged.memories });

  // ---- Pull ----------------------------------------------------------------
  let nextCursor = cursor;
  if (!firstUpload) {
    progress({ phase: "pulling", projectId, done: 0, total: 1 });
    const pulled = await remote.pull(projectId, cursor);
    const projectRow = pulled.projects.find((row) => row.id === projectId);
    if (projectRow?.deleted_at) {
      // The owner deleted the project: remove it here too.
      for (const collection of CLOUD_COLLECTIONS) {
        for (const id of [...merged[collection].keys()]) {
          record(collection, id, undefined);
        }
      }
      await state.forget(projectId);
      return;
    }
    for (const collection of CLOUD_COLLECTIONS) {
      for (const row of pulled[collection] as CloudRowByCollection[typeof collection][]) {
        nextCursor = latest(nextCursor, row.updated_at);
        applyPulledRow(collection, row);
      }
    }
  }

  function applyPulledRow<C extends CloudCollection>(collection: C, row: CloudRowByCollection[C]) {
    const map = merged[collection] as Map<string, LocalRecordByCollection[C]>;
    const id = row.id;
    const key = stateKey(collection, id);
    const current = map.get(id);
    const synced = syncedHash(key);
    const localChanged = current !== undefined && recordHash(collection, current) !== synced;
    if (row.deleted_at) {
      if (current && localChanged && canWriteRecord(access(), collection, current, false)) {
        return; // Edited here after it was deleted elsewhere: the edit brings it back.
      }
      if (current) record(collection, id, undefined);
      forgetKey(key);
      return;
    }
    const incoming = fromCloud(collection, row, role, current);
    const incomingHash = recordHash(collection, incoming);
    if (!current) {
      if (synced !== undefined && canDeleteRecord(access(), collection, incoming)) {
        return; // Deleted here; the push below deletes it in the cloud.
      }
      record(collection, id, incoming);
      remember(key, incomingHash);
      return;
    }
    if (localChanged && incomingHash !== recordHash(collection, current) && canWriteRecord(access(), collection, current, false)) {
      return; // Both changed: this device's edit wins and is pushed below.
    }
    if (!sameRecord(current, incoming)) {
      record(collection, id, incoming);
    }
    remember(key, incomingHash);
  }

  // ---- Download shared photos this device doesn't have yet -----------------
  const missing = [...merged.photos.values()].filter((photo) => !photo.uri && photo.cloud?.path);
  let downloaded = 0;
  for (const photo of missing) {
    progress({ phase: "downloading", projectId, done: downloaded, total: missing.length });
    try {
      const uri = await files.download(photo.cloud!.path!, projectId, photo.id);
      record("photos", photo.id, { ...photo, uri });
    } catch (error) {
      deps.warn?.("Photo download failed", error);
    }
    downloaded += 1;
  }

  // ---- Push ----------------------------------------------------------------
  // Viewers push nothing, but still get local changes undone below.
  {
    const restore: { [C in CloudCollection]?: string[] } = {};
    const uploads = [...merged.photos.values()].filter(
      (photo) => photo.uri && !photo.cloud?.path && canWriteRecord(access(), "photos", photo, syncedHash(stateKey("photos", photo.id)) === undefined)
    );
    let uploaded = 0;
    for (const photo of uploads) {
      progress({ phase: "uploading", projectId, done: uploaded, total: uploads.length });
      const path = cloudPhotoPath(projectId, photo.id);
      try {
        await files.upload(photo, path);
        record("photos", photo.id, { ...photo, cloud: { ...photo.cloud, path, addedBy: photo.cloud?.addedBy ?? userId } });
      } catch (error) {
        deps.warn?.("Photo upload failed", error);
      }
      uploaded += 1;
    }

    progress({ phase: "saving", projectId, done: 0, total: 1 });
    for (const collection of CLOUD_COLLECTIONS) {
      const map = merged[collection] as Map<string, LocalRecordByCollection[typeof collection]>;
      const pending: { id: string; hash: string; row: Record<string, unknown> }[] = [];
      for (const [id, current] of map) {
        const key = stateKey(collection, id);
        const hash = recordHash(collection, current);
        const synced = syncedHash(key);
        if (hash === synced) continue;
        if (!canWriteRecord(access(), collection, current, synced === undefined)) {
          if (synced !== undefined) (restore[collection] ??= []).push(id);
          continue;
        }
        pending.push({ id, hash, row: toRow(collection, current, projectId, merged.photos) });
      }
      for (let index = 0; index < pending.length; index += UPSERT_CHUNK) {
        const chunk = pending.slice(index, index + UPSERT_CHUNK);
        const saved = await remote.upsert(collection, chunk.map((item) => item.row));
        chunk.forEach((item) => remember(stateKey(collection, item.id), item.hash));
        // Pick up server-set fields such as who created or controls a memory.
        for (const row of saved) {
          const current = map.get(row.id);
          if (!current) continue;
          const updated = fromCloud(collection, row as CloudRowByCollection[typeof collection], role, current);
          if (!sameRecord(current, updated)) record(collection, row.id, updated);
        }
      }
    }

    // Records deleted on this device.
    for (const collection of [...CLOUD_COLLECTIONS].reverse()) {
      const prefix = `${collection}:`;
      const gone = [...new Set([...hashes.keys(), ...setHashes.keys()])]
        .filter((key) => key.startsWith(prefix) && syncedHash(key) !== undefined)
        .map((key) => key.slice(prefix.length))
        .filter((id) => !merged[collection].has(id));
      if (gone.length === 0) continue;
      const rows = await remote.fetchByIds(collection, projectId, gone);
      const deletable: string[] = [];
      const found = new Set<string>();
      for (const row of rows) {
        found.add(row.id);
        if (row.deleted_at) {
          forgetKey(stateKey(collection, row.id));
          continue;
        }
        const asRecord = fromCloud(collection, row, role, undefined);
        if (canDeleteRecord(access(), collection, asRecord)) {
          deletable.push(row.id);
        } else {
          // Not ours to delete: put it back.
          record(collection, row.id, asRecord);
          remember(stateKey(collection, row.id), recordHash(collection, asRecord));
        }
      }
      if (deletable.length) {
        await remote.softDelete(collection, projectId, deletable);
        deletable.forEach((id) => forgetKey(stateKey(collection, id)));
      }
      gone.filter((id) => !found.has(id)).forEach((id) => forgetKey(stateKey(collection, id)));
    }

    // Local edits this account isn't allowed to make go back to the cloud version.
    for (const collection of CLOUD_COLLECTIONS) {
      const ids = restore[collection];
      if (!ids?.length) continue;
      const rows = await remote.fetchByIds(collection, projectId, ids);
      for (const row of rows) {
        const current = merged[collection].get(row.id) as LocalRecordByCollection[typeof collection] | undefined;
        if (row.deleted_at) {
          record(collection, row.id, undefined);
          forgetKey(stateKey(collection, row.id));
          continue;
        }
        const restored = fromCloud(collection, row, role, current);
        record(collection, row.id, restored);
        remember(stateKey(collection, row.id), recordHash(collection, restored));
      }
    }
  }

  await state.save(projectId, { set: [...setHashes], remove: [...removeHashes], cursor: nextCursor });
}
