// Cloud features (accounts, backup, sharing) switch on only when the app is built
// with a Supabase project configured. Without it the app stays fully local and
// every account entry point is hidden.
//
// Values come from EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY,
// set in a local .env (never committed) or as EAS environment variables. The anon
// key is designed to ship inside apps; the database's row-level security is what
// protects the data.

export type CloudConfig = { url: string; anonKey: string };

export function readCloudConfig(env: Record<string, string | undefined> = process.env): CloudConfig | undefined {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return undefined;
  }
  return { url: url.replace(/\/+$/, ""), anonKey };
}

// Expo inlines EXPO_PUBLIC_* only for direct `process.env.NAME` references, so
// the build-time values are read explicitly here.
export const cloudConfig = readCloudConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
});

export const cloudEnabled = Boolean(cloudConfig);

// Private storage bucket for photo files (see supabase/migrations).
export const PHOTO_BUCKET = "photos";
