import type { Memory, MemoryPageSection, PhotoItem, Project, ProjectCloudInfo } from "../types";

// The four record kinds that sync. Suggestions stay on the device.
export type CloudCollection = "projects" | "memories" | "pageSections" | "photos";
export const CLOUD_COLLECTIONS: CloudCollection[] = ["projects", "memories", "pageSections", "photos"];

export const CLOUD_TABLES: Record<CloudCollection, string> = {
  projects: "projects",
  memories: "memories",
  pageSections: "page_sections",
  photos: "photos"
};

export type CloudRole = ProjectCloudInfo["role"];

// Rows as the cloud database returns them.
export type CloudProjectRow = { id: string; owner_id: string; data: Record<string, unknown>; updated_at: string; deleted_at: string | null };
export type CloudMemoryRow = {
  project_id: string;
  id: string;
  data: Record<string, unknown>;
  created_by: string;
  controller_id: string | null;
  date_from: string | null;
  date_to: string | null;
  area_lat: number | null;
  area_lng: number | null;
  updated_at: string;
  deleted_at: string | null;
};
export type CloudPageSectionRow = { project_id: string; id: string; memory_id: string; data: Record<string, unknown>; updated_at: string; deleted_at: string | null };
export type CloudPhotoRow = {
  project_id: string;
  id: string;
  memory_id: string | null;
  added_by: string;
  storage_path: string | null;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
};
export type CloudRowByCollection = {
  projects: CloudProjectRow;
  memories: CloudMemoryRow;
  pageSections: CloudPageSectionRow;
  photos: CloudPhotoRow;
};
export type LocalRecordByCollection = {
  projects: Project;
  memories: Memory;
  pageSections: MemoryPageSection;
  photos: PhotoItem;
};

// ---------------------------------------------------------------------------
// Local record → cloud data. Device-only fields never leave the phone.
// ---------------------------------------------------------------------------

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloudProjectData(project: Project): Record<string, unknown> {
  const { cloud: _cloud, thumbnailUri: _thumbnail, ...rest } = project;
  return withoutUndefined(rest);
}

export function cloudMemoryData(memory: Memory): Record<string, unknown> {
  const { cloud: _cloud, ...rest } = memory;
  return withoutUndefined(rest);
}

export function cloudPageSectionData(section: MemoryPageSection): Record<string, unknown> {
  const { exportToFolder: _export, exportFolderName: _folder, ...rest } = section;
  return withoutUndefined(rest);
}

// Only what other members need to lay the photo out. The file location,
// exact GPS position, picker details and on-device analysis stay local.
export function cloudPhotoData(photo: PhotoItem): Record<string, unknown> {
  return withoutUndefined({
    id: photo.id,
    projectId: photo.projectId,
    memoryId: photo.memoryId,
    width: photo.width,
    height: photo.height,
    capturedAt: photo.capturedAt,
    addedAt: photo.addedAt
  });
}

export function cloudData<C extends CloudCollection>(collection: C, record: LocalRecordByCollection[C]): Record<string, unknown> {
  switch (collection) {
    case "projects":
      return cloudProjectData(record as Project);
    case "memories":
      return cloudMemoryData(record as Memory);
    case "pageSections":
      return cloudPageSectionData(record as MemoryPageSection);
    default:
      return cloudPhotoData(record as PhotoItem);
  }
}

// A memory's date range and rough area (two decimals, about 1 km), so other
// members' suggestions can match their own photos to it.
export type MemoryArea = { date_from: string | null; date_to: string | null; area_lat: number | null; area_lng: number | null };

export function memoryArea(memoryId: string, photos: PhotoItem[]): MemoryArea {
  const own = photos.filter((photo) => photo.memoryId === memoryId);
  const times = own.map((photo) => Date.parse(photo.capturedAt)).filter((time) => Number.isFinite(time));
  const located = own.filter((photo) => photo.location && Number.isFinite(photo.location.latitude) && Number.isFinite(photo.location.longitude));
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    date_from: times.length ? new Date(Math.min(...times)).toISOString() : null,
    date_to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    area_lat: located.length ? round(located.reduce((sum, photo) => sum + photo.location!.latitude, 0) / located.length) : null,
    area_lng: located.length ? round(located.reduce((sum, photo) => sum + photo.location!.longitude, 0) / located.length) : null
  };
}

// ---------------------------------------------------------------------------
// Cloud row → local record, keeping whatever only this device knows.
// ---------------------------------------------------------------------------

export function projectFromCloud(row: CloudProjectRow, role: CloudRole, existing?: Project): Project {
  return {
    ...(row.data as unknown as Project),
    id: row.id,
    thumbnailUri: existing?.thumbnailUri,
    cloud: { role, ownerId: row.owner_id }
  };
}

export function memoryFromCloud(row: CloudMemoryRow): Memory {
  return {
    ...(row.data as unknown as Memory),
    id: row.id,
    projectId: row.project_id,
    cloud: { createdBy: row.created_by, controllerId: row.controller_id }
  };
}

export function pageSectionFromCloud(row: CloudPageSectionRow, existing?: MemoryPageSection): MemoryPageSection {
  return {
    ...(row.data as unknown as MemoryPageSection),
    id: row.id,
    memoryId: row.memory_id,
    exportToFolder: existing?.exportToFolder,
    exportFolderName: existing?.exportFolderName
  };
}

export function photoFromCloud(row: CloudPhotoRow, existing?: PhotoItem): PhotoItem {
  const data = row.data as unknown as PhotoItem;
  return withoutUndefined({
    ...data,
    id: row.id,
    projectId: row.project_id,
    memoryId: row.memory_id ?? undefined,
    uri: existing?.uri ?? "",
    location: existing?.location,
    importMetadata: existing?.importMetadata,
    analysis: existing?.analysis,
    cloud: { path: row.storage_path ?? undefined, addedBy: row.added_by }
  }) as PhotoItem;
}

// ---------------------------------------------------------------------------
// Change detection: a stable JSON form and a short hash of it.
// ---------------------------------------------------------------------------

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stableStringify(item))).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// cyrb53: a fast 53-bit string hash. Only used to notice changes.
export function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function recordHash<C extends CloudCollection>(collection: C, record: LocalRecordByCollection[C]): string {
  return hashString(stableStringify(cloudData(collection, record)));
}

// ---------------------------------------------------------------------------
// Who may change what. Mirrors the database's access rules so the app never
// queues a change the server would refuse.
// ---------------------------------------------------------------------------

export type AccessContext = {
  role: CloudRole | undefined;
  userId: string;
  memoriesById: Map<string, Memory>;
};

export function canEditMemory(context: AccessContext, memoryId: string | undefined): boolean {
  if (context.role === "owner") return true;
  if (context.role !== "contributor" || !memoryId) return false;
  const memory = context.memoriesById.get(memoryId);
  // A memory this contributor just made locally is its own until it uploads.
  return Boolean(memory && (memory.cloud?.controllerId === context.userId || !memory.cloud));
}

export function canWriteRecord<C extends CloudCollection>(
  context: AccessContext,
  collection: C,
  record: LocalRecordByCollection[C],
  isNew: boolean
): boolean {
  const { role, userId } = context;
  if (role === "owner") return true;
  if (role !== "contributor") return false;
  switch (collection) {
    case "projects":
      return false;
    case "memories":
      return isNew || canEditMemory(context, (record as Memory).id);
    case "pageSections":
      return canEditMemory(context, (record as MemoryPageSection).memoryId);
    default: {
      const photo = record as PhotoItem;
      return isNew || photo.cloud?.addedBy === userId || canEditMemory(context, photo.memoryId);
    }
  }
}

export function canDeleteRecord<C extends CloudCollection>(
  context: AccessContext,
  collection: C,
  record: LocalRecordByCollection[C]
): boolean {
  const { role, userId } = context;
  if (role === "owner") return true;
  if (role !== "contributor") return false;
  if (collection === "memories") {
    const memory = record as Memory;
    return memory.cloud?.createdBy === userId && canEditMemory(context, memory.id);
  }
  return canWriteRecord(context, collection, record, false);
}

export function recordProjectId<C extends CloudCollection>(
  collection: C,
  record: LocalRecordByCollection[C],
  memoryProjectIds: Map<string, string>
): string | undefined {
  switch (collection) {
    case "projects":
      return (record as Project).id;
    case "memories":
      return (record as Memory).projectId;
    case "pageSections":
      return memoryProjectIds.get((record as MemoryPageSection).memoryId);
    default:
      return (record as PhotoItem).projectId;
  }
}
