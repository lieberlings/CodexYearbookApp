import type { SupabaseClient } from "@supabase/supabase-js";
import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type { PhotoItem } from "../types";
import { PHOTO_BUCKET } from "./config";
import type { PhotoFiles } from "./syncTypes";

// Print quality: enough pixels for a full 20 cm page at 300 PPI with room to
// crop. Re-encoding also drops the original's EXIF, GPS position included.
export const CLOUD_PHOTO_LONG_SIDE = 3000;
const CLOUD_PHOTO_QUALITY = 0.9;
const SIGNED_URL_SECONDS = 600;

async function measure(uri: string): Promise<{ width: number; height: number }> {
  const probe = await ImageManipulator.manipulateAsync(uri, [], { compress: 0, format: ImageManipulator.SaveFormat.JPEG });
  new File(probe.uri).delete();
  return { width: probe.width, height: probe.height };
}

export function createPhotoFiles(supabase: SupabaseClient): PhotoFiles {
  return {
    async upload(photo: PhotoItem, path: string) {
      const size = await measure(photo.uri);
      const longSide = Math.max(size.width, size.height);
      const actions = longSide > CLOUD_PHOTO_LONG_SIDE
        ? [{ resize: size.width >= size.height ? { width: CLOUD_PHOTO_LONG_SIDE } : { height: CLOUD_PHOTO_LONG_SIDE } }]
        : [];
      const copy = await ImageManipulator.manipulateAsync(photo.uri, actions, {
        compress: CLOUD_PHOTO_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG
      });
      const file = new File(copy.uri);
      try {
        const bytes = await file.bytes();
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
      } finally {
        if (file.exists) file.delete();
      }
    },

    async download(path: string, projectId: string, photoId: string) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl) throw error ?? new Error("No download link for a shared photo.");
      const folder = new Directory(Paths.document, "cloud-photos", projectId);
      folder.create({ idempotent: true, intermediates: true });
      const file = await File.downloadFileAsync(data.signedUrl, new File(folder, `${photoId}.jpg`), { idempotent: true });
      return file.uri;
    }
  };
}
