import type { CloudCollection, CloudRole, CloudRowByCollection } from "../cloud/records";
import type { Membership, PhotoFiles, ProjectSyncState, PulledRows, RemoteApi, SyncStateStore } from "../cloud/syncTypes";

type AnyRow = Record<string, unknown> & { id: string; project_id?: string; updated_at: string; deleted_at: string | null };

// An in-memory stand-in for the cloud database and photo bucket. It assigns
// server times and the server-set columns; access rules are tested against
// real Postgres in supabase/tests.
export class FakeCloud {
  tables: Record<CloudCollection, Map<string, AnyRow>> = {
    projects: new Map(),
    memories: new Map(),
    pageSections: new Map(),
    photos: new Map()
  };
  members = new Map<string, Map<string, CloudRole>>();
  files = new Map<string, string>();
  private clock = Date.parse("2026-10-01T00:00:00.000Z");

  now(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  private key(collection: CloudCollection, row: { id: string; project_id?: string }): string {
    return collection === "projects" ? row.id : `${row.project_id}/${row.id}`;
  }

  addMember(projectId: string, userId: string, role: CloudRole) {
    if (!this.members.has(projectId)) this.members.set(projectId, new Map());
    this.members.get(projectId)!.set(userId, role);
  }

  removeMember(projectId: string, userId: string) {
    this.members.get(projectId)?.delete(userId);
  }

  api(userId: string): RemoteApi {
    const cloud = this;
    return {
      userId,
      async listMemberships(): Promise<Membership[]> {
        const result: Membership[] = [];
        cloud.members.forEach((members, projectId) => {
          const role = members.get(userId);
          const project = cloud.tables.projects.get(projectId);
          if (role && project) {
            result.push({ projectId, role, ownerId: project.owner_id as string, deleted: Boolean(project.deleted_at) });
          }
        });
        return result;
      },
      async pull(projectId: string, since: string | null): Promise<PulledRows> {
        if (!cloud.members.get(projectId)?.has(userId)) throw new Error("not a member");
        const pick = (collection: CloudCollection) =>
          [...cloud.tables[collection].values()].filter(
            (row) => (collection === "projects" ? row.id === projectId : row.project_id === projectId) && (!since || row.updated_at > since)
          );
        return {
          projects: pick("projects") as never,
          memories: pick("memories") as never,
          pageSections: pick("pageSections") as never,
          photos: pick("photos") as never
        };
      },
      async fetchByIds<C extends CloudCollection>(collection: C, projectId: string, ids: string[]) {
        return ids
          .map((id) => cloud.tables[collection].get(collection === "projects" ? id : `${projectId}/${id}`))
          .filter(Boolean) as unknown as CloudRowByCollection[C][];
      },
      async upsert<C extends CloudCollection>(collection: C, rows: Record<string, unknown>[]) {
        const saved: AnyRow[] = [];
        for (const input of rows) {
          const key = cloud.key(collection, input as AnyRow);
          const existing = cloud.tables[collection].get(key);
          const row: AnyRow = { ...(existing ?? {}), ...input, updated_at: cloud.now() } as AnyRow;
          if (!existing) {
            if (collection === "projects") {
              row.owner_id = userId;
              cloud.addMember(row.id, userId, "owner");
            }
            if (collection === "memories") {
              row.created_by = userId;
              row.controller_id = cloud.members.get(row.project_id!)?.get(userId) === "contributor" ? userId : null;
            }
            if (collection === "photos") row.added_by = userId;
          }
          for (const column of ["date_from", "date_to", "area_lat", "area_lng"]) {
            if (collection === "memories" && !(column in row)) row[column] = null;
          }
          cloud.tables[collection].set(key, row);
          saved.push(row);
        }
        return saved as unknown as CloudRowByCollection[C][];
      },
      async softDelete(collection: CloudCollection, projectId: string, ids: string[]) {
        for (const id of ids) {
          const row = cloud.tables[collection].get(collection === "projects" ? id : `${projectId}/${id}`);
          if (row) {
            row.deleted_at = cloud.now();
            row.updated_at = row.deleted_at;
          }
        }
      },
      async leaveProject(projectId: string) {
        cloud.removeMember(projectId, userId);
      }
    };
  }

  photoFiles(device: string): PhotoFiles & { uploads: string[] } {
    const cloud = this;
    const uploads: string[] = [];
    return {
      uploads,
      async upload(photo, path) {
        uploads.push(path);
        cloud.files.set(path, photo.uri);
      },
      async download(path, projectId, photoId) {
        if (!cloud.files.has(path)) throw new Error("missing file");
        return `file:///${device}/${projectId}/${photoId}.jpg`;
      }
    };
  }
}

export function memorySyncState(): SyncStateStore {
  const projects = new Map<string, ProjectSyncState>();
  return {
    async listProjects() {
      return [...projects.keys()];
    },
    async load(projectId) {
      const stored = projects.get(projectId);
      return { hashes: new Map(stored?.hashes ?? []), cursor: stored?.cursor ?? null };
    },
    async save(projectId, changes) {
      const stored = projects.get(projectId) ?? { hashes: new Map<string, string>(), cursor: null };
      changes.remove.forEach((key) => stored.hashes.delete(key));
      changes.set.forEach(([key, hash]) => stored.hashes.set(key, hash));
      stored.cursor = changes.cursor;
      projects.set(projectId, stored);
    },
    async forget(projectId) {
      projects.delete(projectId);
    }
  };
}
