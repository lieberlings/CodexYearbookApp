import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "./config";

const LIST_PAGE = 100;

async function removeFiles(supabase: SupabaseClient, paths: string[]) {
  for (let start = 0; start < paths.length; start += LIST_PAGE) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths.slice(start, start + LIST_PAGE));
    if (error) throw new Error(`Deleting photo files: ${error.message}`);
  }
}

async function listFolder(supabase: SupabaseClient, folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(folder, { limit: LIST_PAGE, offset });
    if (error) throw new Error(`Listing photo files: ${error.message}`);
    paths.push(...(data ?? []).map((item) => `${folder}/${item.name}`));
    if (!data || data.length < LIST_PAGE) return paths;
  }
}

// Deletes the signed-in account and everything it owns in the cloud: photo
// files first (Supabase doesn't allow removing them from SQL), then the account
// itself, which cascades to its projects, memberships and added photos.
export async function deleteCloudAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: owned, error: ownedError } = await supabase.from("projects").select("id").eq("owner_id", userId);
  if (ownedError) throw new Error(`Finding your projects: ${ownedError.message}`);
  for (const project of owned ?? []) {
    await removeFiles(supabase, await listFolder(supabase, project.id as string));
  }
  // Photos this account added to projects owned by someone else.
  const { data: added, error: addedError } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("added_by", userId)
    .not("storage_path", "is", null);
  if (addedError) throw new Error(`Finding your photos: ${addedError.message}`);
  await removeFiles(
    supabase,
    (added ?? []).map((row) => row.storage_path as string)
  );
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(`Deleting your account: ${error.message}`);
}
