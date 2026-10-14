import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOUD_TABLES, CloudCollection, CloudRole, CloudRowByCollection } from "./records";
import type { Membership, PulledRows, RemoteApi } from "./syncTypes";

const PAGE_SIZE = 500;
const ID_CHUNK = 100;
// Rows committed slightly out of order still get picked up by the next pull;
// re-reading a few is harmless.
const PULL_OVERLAP_MS = 2 * 60 * 1000;

function conflictTarget(collection: CloudCollection): string {
  return collection === "projects" ? "id" : "project_id,id";
}

function projectColumn(collection: CloudCollection): string {
  return collection === "projects" ? "id" : "project_id";
}

export function createSupabaseRemote(supabase: SupabaseClient, userId: string): RemoteApi {
  async function pullTable<C extends CloudCollection>(collection: C, projectId: string, since: string | null): Promise<CloudRowByCollection[C][]> {
    const rows: CloudRowByCollection[C][] = [];
    const after = since ? new Date(Date.parse(since) - PULL_OVERLAP_MS).toISOString() : null;
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from(CLOUD_TABLES[collection]).select("*").eq(projectColumn(collection), projectId);
      if (after) query = query.gt("updated_at", after);
      const { data, error } = await query.order("updated_at").order("id").range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as CloudRowByCollection[C][]));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  }

  return {
    userId,

    async listMemberships(): Promise<Membership[]> {
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, role, projects(owner_id, deleted_at)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const project = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as { owner_id: string; deleted_at: string | null } | null;
        if (!project) return [];
        return [{ projectId: row.project_id as string, role: row.role as CloudRole, ownerId: project.owner_id, deleted: Boolean(project.deleted_at) }];
      });
    },

    async pull(projectId, since): Promise<PulledRows> {
      const [projects, memories, pageSections, photos] = await Promise.all([
        pullTable("projects", projectId, since),
        pullTable("memories", projectId, since),
        pullTable("pageSections", projectId, since),
        pullTable("photos", projectId, since)
      ]);
      return { projects, memories, pageSections, photos };
    },

    async fetchByIds(collection, projectId, ids) {
      const rows: CloudRowByCollection[typeof collection][] = [];
      for (let index = 0; index < ids.length; index += ID_CHUNK) {
        const query = collection === "projects"
          ? supabase.from(CLOUD_TABLES[collection]).select("*").in("id", ids.slice(index, index + ID_CHUNK))
          : supabase.from(CLOUD_TABLES[collection]).select("*").eq("project_id", projectId).in("id", ids.slice(index, index + ID_CHUNK));
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data ?? []) as CloudRowByCollection[typeof collection][]));
      }
      return rows;
    },

    async upsert(collection, rows) {
      // Bulk upserts set every column named in any row, so send rows with the
      // same columns together; otherwise a missing column would be cleared.
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const shape = Object.keys(row).sort().join(",");
        groups.set(shape, [...(groups.get(shape) ?? []), row]);
      }
      const saved: CloudRowByCollection[typeof collection][] = [];
      for (const group of groups.values()) {
        const { data, error } = await supabase
          .from(CLOUD_TABLES[collection])
          .upsert(group, { onConflict: conflictTarget(collection) })
          .select("*");
        if (error) throw error;
        saved.push(...((data ?? []) as CloudRowByCollection[typeof collection][]));
      }
      return saved;
    },

    async softDelete(collection, projectId, ids) {
      for (let index = 0; index < ids.length; index += ID_CHUNK) {
        const chunk = ids.slice(index, index + ID_CHUNK);
        const query = supabase.from(CLOUD_TABLES[collection]).update({ deleted_at: new Date().toISOString() });
        const { error } = collection === "projects"
          ? await query.in("id", chunk)
          : await query.eq("project_id", projectId).in("id", chunk);
        if (error) throw error;
      }
    },

    async leaveProject(projectId) {
      const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
      if (error) throw error;
    }
  };
}
