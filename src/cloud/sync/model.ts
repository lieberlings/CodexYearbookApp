import type { Memory, MemoryPageSection, PhotoItem, Project } from "../../types";

// How the app's records map onto the Supabase tables in supabase/migrations, and
// the bookkeeping that tells which records still need to go up or come down.
// Everything here is pure so the sync rules can be tested without a server.

export const CLOUD_TABLES = ["projects", "memories", "page_sections", "photos"] as const;
export type CloudTable = (typeof CLOUD_TABLES)[number];

export type CloudRow = {
  id: string;
  project_id?: string;
  owner_id?: string;
  memory_id?: string | null;
  added_by?: string;
  storage_path?: string | null;
  data: unknown;
  updated_at?: string;
  deleted_at?: string | null;
};

export type CloudRecords = {
  projects: Project[];
  memories: Memory[];
  pageSections: MemoryPageSection[];
  photos: PhotoItem[];
};

// What this device knows about the server, saved between launches.
export type SyncState = {
  version: 1;
  userId: string;
  // Projects this device keeps in the cloud: backed up from here, or restored.
  syncedProjectIds: string[];
  // Per table, the fingerprint of each record as last agreed with the server,
  // and which project it belongs to.
  confirmed: Record<CloudTable, Record<string, ConfirmedEntry>>;
  // This account's role in each synced project. Missing means owner (a project
  // backed up from this device).
  roles?: Record<string, ProjectRole>;
  // Newest server `updated_at` already pulled.
  pullCursor?: string;
  // Photo id -> storage path, once the photo's file is in the cloud.
  uploadedFiles: Record<string, string>;
};

export type ProjectRole = "owner" | "contributor";

type ConfirmedEntry = {
  hash: string;
  projectId: string;
  // For photos: added by this account, so this device may change or remove it.
  own?: boolean;
};

export function roleIn(state: SyncState, projectId: string): ProjectRole {
  return state.roles?.[projectId] ?? "owner";
}

// A contributor only ever writes the photos they added. Everything else in a
// shared project is the owner's, and the owner's version always wins.
function mayWrite(state: SyncState, table: CloudTable, projectId: string, addedBy?: string | null): boolean {
  if (roleIn(state, projectId) === "owner") return true;
  return table === "photos" && addedBy === state.userId;
}

export function emptySyncState(userId: string): SyncState {
  return {
    version: 1,
    userId,
    syncedProjectIds: [],
    confirmed: { projects: {}, memories: {}, page_sections: {}, photos: {} },
    roles: {},
    uploadedFiles: {}
  };
}

// Marks a photo whose file is in the cloud but not yet on this device.
export const CLOUD_URI_PREFIX = "cloud://";

export function isCloudPlaceholderUri(uri: string): boolean {
  return uri.startsWith(CLOUD_URI_PREFIX);
}

// Photo fields that only make sense on the device that has the file, or that
// are bulky, sensitive and can be recomputed (face and label analysis).
// `addedBy` travels in its own column instead, so the owner editing a contributor's
// photo never rewrites who added it.
function shareablePhoto(photo: PhotoItem): Omit<PhotoItem, "uri" | "exportDataUri" | "analysis" | "addedBy"> {
  const { uri: _uri, exportDataUri: _exportDataUri, analysis: _analysis, addedBy: _addedBy, ...rest } = photo;
  return rest;
}

// The project thumbnail is a file path on one device; it isn't synced yet.
function shareableProject(project: Project): Omit<Project, "thumbnailUri"> {
  const { thumbnailUri: _thumbnailUri, ...rest } = project;
  return rest;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

// Short content hash (FNV-1a, 2 x 32 bit). Only used to notice changes.
export function fingerprint(row: Pick<CloudRow, "project_id" | "memory_id" | "data">): string {
  const text = stableStringify({ p: row.project_id ?? null, m: row.memory_id ?? null, d: row.data });
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x811c9dc5) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export type LocalRows = Record<CloudTable, CloudRow[]>;

// Rows for every record of the given projects, in the shape the server stores.
// `storage_path` is left out on purpose: it is set only once a file upload
// succeeds, so a push can never clear a path another device already set.
export function toCloudRows(records: CloudRecords, projectIds: Iterable<string>, userId: string): LocalRows {
  const included = new Set(projectIds);
  const memoryProject = new Map(records.memories.map((memory) => [memory.id, memory.projectId] as const));
  return {
    projects: records.projects
      .filter((project) => included.has(project.id))
      .map((project) => ({ id: project.id, owner_id: userId, data: shareableProject(project) })),
    memories: records.memories
      .filter((memory) => included.has(memory.projectId))
      .map((memory) => ({ id: memory.id, project_id: memory.projectId, data: memory })),
    page_sections: records.pageSections
      .filter((section) => included.has(memoryProject.get(section.memoryId) ?? ""))
      .map((section) => ({
        id: section.id,
        project_id: memoryProject.get(section.memoryId)!,
        memory_id: section.memoryId,
        data: section
      })),
    photos: records.photos
      .filter((photo) => included.has(photo.projectId))
      .map((photo) => ({
        id: photo.id,
        project_id: photo.projectId,
        memory_id: photo.memoryId ?? null,
        added_by: photo.addedBy ?? userId,
        data: shareablePhoto(photo)
      }))
  };
}

export type PushPlan = {
  upserts: Record<CloudTable, CloudRow[]>;
  // Records the server has but this device deleted.
  deletions: Record<CloudTable, string[]>;
};

export function planPush(records: CloudRecords, state: SyncState): PushPlan {
  const rows = toCloudRows(records, state.syncedProjectIds, state.userId);
  const plan: PushPlan = {
    upserts: { projects: [], memories: [], page_sections: [], photos: [] },
    deletions: { projects: [], memories: [], page_sections: [], photos: [] }
  };
  const syncedProjects = new Set(state.syncedProjectIds);
  for (const table of CLOUD_TABLES) {
    const confirmed = state.confirmed[table];
    const present = new Set<string>();
    for (const row of rows[table]) {
      present.add(row.id);
      const projectId = row.project_id ?? row.id;
      if (confirmed[row.id]?.hash !== fingerprint(row) && mayWrite(state, table, projectId, row.added_by)) {
        plan.upserts[table].push(row);
      }
    }
    for (const [id, entry] of Object.entries(confirmed)) {
      // Only delete what belongs to a project this device still syncs. A project
      // the user stopped syncing keeps its cloud copy.
      if (!present.has(id) && syncedProjects.has(entry.projectId)) {
        const allowed = roleIn(state, entry.projectId) === "owner" || (table === "photos" && entry.own);
        if (allowed) plan.deletions[table].push(id);
      }
    }
  }
  return plan;
}

// Records the plan as agreed with the server once its writes succeeded.
export function confirmPush(state: SyncState, plan: PushPlan): SyncState {
  const confirmed = cloneConfirmed(state.confirmed);
  for (const table of CLOUD_TABLES) {
    for (const row of plan.upserts[table]) {
      confirmed[table][row.id] = {
        hash: fingerprint(row),
        projectId: row.project_id ?? row.id,
        own: table === "photos" ? row.added_by === state.userId : undefined
      };
    }
    for (const id of plan.deletions[table]) {
      delete confirmed[table][id];
    }
  }
  // A deleted project's own id leaves the synced list too.
  const deletedProjects = new Set(plan.deletions.projects);
  return {
    ...state,
    confirmed,
    syncedProjectIds: state.syncedProjectIds.filter((id) => !deletedProjects.has(id))
  };
}

function cloneConfirmed(confirmed: SyncState["confirmed"]): SyncState["confirmed"] {
  return {
    projects: { ...confirmed.projects },
    memories: { ...confirmed.memories },
    page_sections: { ...confirmed.page_sections },
    photos: { ...confirmed.photos }
  };
}

// Changes for the app to apply to its local data.
export type LocalPatch = {
  upsert: CloudRecords;
  remove: { projects: string[]; memories: string[]; pageSections: string[]; photos: string[] };
};

export function emptyPatch(): LocalPatch {
  return {
    upsert: { projects: [], memories: [], pageSections: [], photos: [] },
    remove: { projects: [], memories: [], pageSections: [], photos: [] }
  };
}

export function isEmptyPatch(patch: LocalPatch): boolean {
  return [...Object.values(patch.upsert), ...Object.values(patch.remove)].every((items) => items.length === 0);
}

const LOCAL_KEY: Record<CloudTable, keyof CloudRecords> = {
  projects: "projects",
  memories: "memories",
  page_sections: "pageSections",
  photos: "photos"
};

// Applies rows pulled from the server. A record changed on this device and not
// pushed yet keeps the local version; it goes up on the next push. Only the
// owner writes layout, so this only matters for one person on two devices.
export function applyPulledRows(
  records: CloudRecords,
  state: SyncState,
  pulled: Record<CloudTable, CloudRow[]>
): { patch: LocalPatch; state: SyncState } {
  const patch = emptyPatch();
  const confirmed = cloneConfirmed(state.confirmed);
  const synced = new Set(state.syncedProjectIds);
  const uploadedFiles = { ...state.uploadedFiles };
  const roles = { ...state.roles };
  let cursor = state.pullCursor;
  const local = toCloudRows(records, records.projects.map((project) => project.id), state.userId);
  const localById: Record<CloudTable, Map<string, CloudRow>> = {
    projects: new Map(local.projects.map((row) => [row.id, row])),
    memories: new Map(local.memories.map((row) => [row.id, row])),
    page_sections: new Map(local.page_sections.map((row) => [row.id, row])),
    photos: new Map(local.photos.map((row) => [row.id, row]))
  };
  const localPhotos = new Map(records.photos.map((photo) => [photo.id, photo]));
  const localProjects = new Map(records.projects.map((project) => [project.id, project]));

  for (const table of CLOUD_TABLES) {
    for (const row of pulled[table]) {
      if (row.updated_at && (!cursor || row.updated_at > cursor)) {
        cursor = row.updated_at;
      }
      const projectId = table === "projects" ? row.id : row.project_id ?? "";
      if (table === "projects" && row.owner_id) {
        roles[row.id] = row.owner_id === state.userId ? "owner" : "contributor";
      }
      const localRow = localById[table].get(row.id);
      const known = confirmed[table][row.id];
      // Local edits only count where this account may write; in someone else's
      // project the server copy always wins.
      const locallyChanged = Boolean(
        localRow &&
          known &&
          fingerprint(localRow) !== known.hash &&
          mayWrite({ ...state, roles }, table, projectId, row.added_by)
      );

      if (row.deleted_at) {
        if (localRow && !locallyChanged) {
          patch.remove[LOCAL_KEY[table]].push(row.id);
        }
        delete confirmed[table][row.id];
        if (table === "projects") synced.delete(row.id);
        continue;
      }
      if (table === "photos" && row.storage_path) {
        uploadedFiles[row.id] = row.storage_path;
      }
      if (locallyChanged) {
        continue;
      }
      confirmed[table][row.id] = {
        hash: fingerprint(row),
        projectId,
        own: table === "photos" ? row.added_by === state.userId : undefined
      };
      if (table === "projects") {
        synced.add(row.id);
      }
      // Already identical here, typically this device's own push coming back.
      if (localRow && fingerprint(localRow) === fingerprint(row)) {
        continue;
      }
      if (table === "projects") {
        const existing = localProjects.get(row.id);
        patch.upsert.projects.push({ ...(row.data as Project), thumbnailUri: existing?.thumbnailUri });
      } else if (table === "memories") {
        patch.upsert.memories.push(row.data as Memory);
      } else if (table === "page_sections") {
        patch.upsert.pageSections.push(row.data as MemoryPageSection);
      } else {
        const existing = localPhotos.get(row.id);
        const uri = existing && !isCloudPlaceholderUri(existing.uri)
          ? existing.uri
          : `${CLOUD_URI_PREFIX}${row.storage_path ?? ""}`;
        patch.upsert.photos.push({
          ...(row.data as PhotoItem),
          uri,
          addedBy: row.added_by,
          analysis: existing?.analysis
        });
      }
    }
  }
  return {
    patch,
    state: { ...state, confirmed, roles, syncedProjectIds: [...synced], pullCursor: cursor, uploadedFiles }
  };
}

// Photos of synced projects whose file has never been uploaded and exists here.
export function photosNeedingUpload(records: CloudRecords, state: SyncState): PhotoItem[] {
  const synced = new Set(state.syncedProjectIds);
  return records.photos.filter(
    (photo) =>
      synced.has(photo.projectId) &&
      mayWrite(state, "photos", photo.projectId, photo.addedBy ?? state.userId) &&
      !state.uploadedFiles[photo.id] &&
      !isCloudPlaceholderUri(photo.uri) &&
      !photo.uri.startsWith("data:")
  );
}

// Photos known from the cloud whose file still has to be downloaded.
export function photosNeedingDownload(records: CloudRecords, state: SyncState): { photo: PhotoItem; path: string }[] {
  return records.photos
    .filter((photo) => isCloudPlaceholderUri(photo.uri))
    .map((photo) => ({ photo, path: state.uploadedFiles[photo.id] ?? photo.uri.slice(CLOUD_URI_PREFIX.length) }))
    .filter((item) => item.path.length > 0);
}

export function photoStoragePath(photo: PhotoItem): string {
  const extension = photo.uri.match(/\.([a-zA-Z0-9]{3,4})(?:\?|$)/)?.[1]?.toLowerCase() ?? "jpg";
  return `${photo.projectId}/${photo.id}.${extension}`;
}

// Drops projects this account was removed from (or left) on another device:
// they are still synced here but the server no longer lists a membership.
export function forgetLostProjects(
  records: CloudRecords,
  state: SyncState,
  memberOf: Set<string>
): { patch: LocalPatch; state: SyncState } {
  const patch = emptyPatch();
  const lost = state.syncedProjectIds.filter((id) => roleIn(state, id) === "contributor" && !memberOf.has(id));
  if (lost.length === 0) {
    return { patch, state };
  }
  return { patch: removeProjectsPatch(records, lost), state: forgetProjects(state, lost) };
}

export function removeProjectsPatch(records: CloudRecords, projectIds: string[]): LocalPatch {
  const patch = emptyPatch();
  const gone = new Set(projectIds);
  const memoryIds = new Set(records.memories.filter((memory) => gone.has(memory.projectId)).map((memory) => memory.id));
  patch.remove.projects = [...gone];
  patch.remove.memories = [...memoryIds];
  patch.remove.pageSections = records.pageSections.filter((section) => memoryIds.has(section.memoryId)).map((section) => section.id);
  patch.remove.photos = records.photos.filter((photo) => gone.has(photo.projectId)).map((photo) => photo.id);
  return patch;
}

// Stops syncing projects without touching their cloud copy.
export function forgetProjects(state: SyncState, projectIds: string[]): SyncState {
  const gone = new Set(projectIds);
  const confirmed = cloneConfirmed(state.confirmed);
  for (const table of CLOUD_TABLES) {
    for (const [id, entry] of Object.entries(confirmed[table])) {
      if (gone.has(entry.projectId)) delete confirmed[table][id];
    }
  }
  const roles = { ...state.roles };
  projectIds.forEach((id) => delete roles[id]);
  return {
    ...state,
    confirmed,
    roles,
    syncedProjectIds: state.syncedProjectIds.filter((id) => !gone.has(id))
  };
}
