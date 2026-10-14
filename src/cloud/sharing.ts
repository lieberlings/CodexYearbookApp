import type { SupabaseClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import type { ProjectRole } from "./sync/model";

export type ProjectMember = {
  userId: string;
  role: ProjectRole;
  displayName?: string;
  addedAt: string;
};

export type ProjectInvite = { token: string; expiresAt: string; link: string };

// The app link that opens app/invite/[token]. Messengers don't always make
// custom-scheme links tappable, so the invite text also carries the plain code.
export function inviteLink(token: string): string {
  return Linking.createURL(`invite/${token}`);
}

// Accepts a pasted code, or a whole invite link or message containing one.
export function parseInviteCode(input: string): string | undefined {
  const match = input.trim().toLowerCase().match(/(?:invite\/)?([0-9a-f]{24})\b/);
  return match?.[1];
}

export function inviteMessage(projectName: string, invite: ProjectInvite): string {
  return [
    `Join my yearbook "${projectName}" and add your photos.`,
    "",
    `Open in the app: ${invite.link}`,
    `Or enter this code under Account → Join a shared project: ${invite.token}`,
    "",
    "The invite works for 14 days."
  ].join("\n");
}

export async function createInvite(supabase: SupabaseClient, projectId: string, userId: string): Promise<ProjectInvite> {
  const { data, error } = await supabase
    .from("project_invites")
    .insert({ project_id: projectId, created_by: userId })
    .select("token, expires_at")
    .single();
  if (error) throw new Error(`Creating the invite: ${error.message}`);
  return { token: data.token as string, expiresAt: data.expires_at as string, link: inviteLink(data.token as string) };
}

export async function acceptInvite(supabase: SupabaseClient, code: string): Promise<string> {
  const token = parseInviteCode(code);
  if (!token) throw new Error("That doesn't look like an invite code.");
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listMembers(supabase: SupabaseClient, projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase.rpc("project_member_list", { p_project_id: projectId });
  if (error) throw new Error(`Loading people: ${error.message}`);
  return ((data ?? []) as { user_id: string; role: ProjectRole; display_name: string | null; added_at: string }[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name ?? undefined,
    addedAt: row.added_at
  }));
}

// Removes a contributor (owner), or yourself (leaving).
export async function removeMember(supabase: SupabaseClient, projectId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) throw new Error(`Removing: ${error.message}`);
}
