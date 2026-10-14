import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { parseAuthRedirect } from "./authRedirect";
import { requireSupabase } from "./supabaseClient";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_CALLBACK_PATH = "auth-callback";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Emails a 6-digit sign-in code. New addresses get an account on first use.
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true }
  });
  if (error) {
    throw error;
  }
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await requireSupabase().auth.verifyOtp({
    email: normalizeEmail(email),
    token: code.replace(/\s/g, ""),
    type: "email"
  });
  if (error) {
    throw error;
  }
}

// Opens Google sign-in in a browser tab and finishes the session from the
// redirect. Resolves false when the person closes the tab.
export async function signInWithGoogle(): Promise<boolean> {
  const supabase = requireSupabase();
  const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true }
  });
  if (error) {
    throw error;
  }
  if (!data.url) {
    throw new Error("Google sign-in couldn't start.");
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    return false;
  }
  await completeAuthRedirect(result.url);
  return true;
}

export async function completeAuthRedirect(url: string): Promise<void> {
  const supabase = requireSupabase();
  const parsed = parseAuthRedirect(url);
  if (parsed.kind === "error") {
    throw new Error(parsed.message);
  }
  if (parsed.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) throw error;
  } else if (parsed.kind === "tokens") {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken
    });
    if (error) throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throw error;
  }
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("profiles")
    .update({ display_name: displayName.trim().slice(0, 80) })
    .eq("id", userId);
  if (error) {
    throw error;
  }
}

// Removes this account's photo files, then the account and its projects.
export async function deleteAccount(): Promise<void> {
  const supabase = requireSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error("Not signed in.");
  }
  const { data: owned, error: ownedError } = await supabase.from("projects").select("id").eq("owner_id", userId);
  if (ownedError) throw ownedError;
  const { data: added, error: addedError } = await supabase.from("photos").select("storage_path").eq("added_by", userId);
  if (addedError) throw addedError;
  const paths = new Set<string>((added ?? []).map((row) => row.storage_path as string | null).filter((path): path is string => Boolean(path)));
  for (const project of owned ?? []) {
    const { data: files } = await supabase.storage.from("photos").list(project.id as string, { limit: 1000 });
    for (const file of files ?? []) {
      paths.add(`${project.id}/${file.name}`);
    }
  }
  const list = [...paths];
  for (let index = 0; index < list.length; index += 100) {
    const { error } = await supabase.storage.from("photos").remove(list.slice(index, index + 100));
    if (error) throw error;
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
}
