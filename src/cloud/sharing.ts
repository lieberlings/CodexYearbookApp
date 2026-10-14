import * as Linking from "expo-linking";
import type { CloudRole } from "./records";
import { requireSupabase } from "./supabaseClient";

export type InviteRole = Exclude<CloudRole, "owner">;

export type ProjectMember = { userId: string; role: CloudRole; displayName: string };
export type ProjectInvite = { id: string; role: InviteRole; createdAt: string; expiresAt: string; useCount: number; maxUses: number };
export type ControlRequest = { id: string; memoryId: string; requestedBy: string; createdAt: string };

export const JOIN_PATH = "join";

// Invite codes are 8 letters/digits; people may type them with spaces or dashes.
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInviteCode(code: string): string {
  const clean = normalizeInviteCode(code);
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function inviteLink(code: string): string {
  return Linking.createURL(JOIN_PATH, { queryParams: { code: normalizeInviteCode(code) } });
}

export function inviteMessage(projectName: string, code: string, role: InviteRole): string {
  const what = role === "contributor" ? "add photos to" : "look at";
  return `Join me to ${what} "${projectName}" in YearBook.\n\nOpen this link on your phone: ${inviteLink(code)}\n\nOr open YearBook, go to Account > Join a shared project, and enter the code ${formatInviteCode(code)}.`;
}

export async function createInvite(projectId: string, role: InviteRole): Promise<string> {
  const { data, error } = await requireSupabase().rpc("create_invite", { p_project_id: projectId, p_role: role });
  if (error) throw error;
  return data as string;
}

export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc("accept_invite", { p_code: normalizeInviteCode(code) });
  if (error) throw error;
  return data as string;
}

export async function listInvites(projectId: string): Promise<ProjectInvite[]> {
  const { data, error } = await requireSupabase()
    .from("invites")
    .select("id, role, created_at, expires_at, use_count, max_uses")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as InviteRole,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    useCount: row.use_count as number,
    maxUses: row.max_uses as number
  }));
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await requireSupabase().from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId);
  if (error) throw error;
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = requireSupabase();
  const { data: members, error } = await supabase.from("project_members").select("user_id, role").eq("project_id", projectId);
  if (error) throw error;
  const ids = (members ?? []).map((row) => row.user_id as string);
  const { data: profiles, error: profileError } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const names = new Map((profiles ?? []).map((row) => [row.id as string, (row.display_name as string) || "Someone"]));
  const rank: Record<CloudRole, number> = { owner: 0, contributor: 1, viewer: 2 };
  return (members ?? [])
    .map((row) => ({ userId: row.user_id as string, role: row.role as CloudRole, displayName: names.get(row.user_id as string) ?? "Someone" }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.displayName.localeCompare(b.displayName));
}

export async function setMemberRole(projectId: string, userId: string, role: InviteRole): Promise<void> {
  const { error } = await requireSupabase().from("project_members").update({ role }).eq("project_id", projectId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase().from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) throw error;
}

// Hand a memory to another owner or contributor. Null gives it back to the owner.
export async function transferMemoryControl(projectId: string, memoryId: string, toUserId: string | null): Promise<void> {
  const { error } = await requireSupabase().rpc("transfer_memory_control", {
    p_project_id: projectId,
    p_memory_id: memoryId,
    p_to: toUserId
  });
  if (error) throw error;
}

export async function requestMemoryControl(projectId: string, memoryId: string): Promise<void> {
  const { error } = await requireSupabase().from("control_requests").insert({ project_id: projectId, memory_id: memoryId });
  // A second tap while one is pending hits the unique index: that's fine.
  if (error && error.code !== "23505") throw error;
}

export async function listControlRequests(projectId: string): Promise<ControlRequest[]> {
  const { data, error } = await requireSupabase()
    .from("control_requests")
    .select("id, memory_id, requested_by, created_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    memoryId: row.memory_id as string,
    requestedBy: row.requested_by as string,
    createdAt: row.created_at as string
  }));
}

export async function answerControlRequest(request: ControlRequest, projectId: string, grant: boolean): Promise<void> {
  if (grant) {
    await transferMemoryControl(projectId, request.memoryId, request.requestedBy);
    return;
  }
  const { error } = await requireSupabase().from("control_requests").update({ status: "declined" }).eq("id", request.id);
  if (error) throw error;
}
