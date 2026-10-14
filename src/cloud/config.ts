// Supabase connection for accounts, backup and sharing. Both values are
// public: the anon key only grants what the database's access rules allow.
// Set them in .env.local (see docs/engineering/supabase_setup.md). Without
// them the app works exactly as before, fully on-device.
export type CloudConfig = { url: string; anonKey: string };

export function getCloudConfig(): CloudConfig | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function isCloudConfigured(): boolean {
  return getCloudConfig() !== null;
}

// Bucket and folder layout for print-quality photo copies.
export const PHOTO_BUCKET = "photos";

export function cloudPhotoPath(projectId: string, photoId: string): string {
  return `${projectId}/${photoId}.jpg`;
}
