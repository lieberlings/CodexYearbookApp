import * as FileSystem from "expo-file-system/legacy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "../config";
import type { CloudApi } from "./engine";
import type { CloudRow, CloudTable } from "./model";

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;
// Supabase returns at most 1000 rows per request by default.
const PAGE_SIZE = 500;

function fail(context: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function contentTypeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "heic" || extension === "heif") return "image/heic";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export function createSupabaseCloudApi(supabase: SupabaseClient, userId: string): CloudApi {
  return {
    async upsert(table: CloudTable, rows: CloudRow[]) {
      for (let start = 0; start < rows.length; start += PAGE_SIZE) {
        const { error } = await supabase.from(table).upsert(rows.slice(start, start + PAGE_SIZE), { onConflict: "id" });
        fail(`Saving ${table}`, error);
      }
    },

    async markDeleted(table: CloudTable, ids: string[]) {
      const now = new Date().toISOString();
      for (let start = 0; start < ids.length; start += PAGE_SIZE) {
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: now })
          .in("id", ids.slice(start, start + PAGE_SIZE));
        fail(`Deleting ${table}`, error);
      }
    },

    async pullSince(table: CloudTable, cursor: string | undefined) {
      const rows: CloudRow[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let query = supabase.from(table).select("*").order("updated_at", { ascending: true }).order("id");
        if (cursor) {
          query = query.gt("updated_at", cursor);
        }
        const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
        fail(`Loading ${table}`, error);
        rows.push(...((data ?? []) as CloudRow[]));
        if (!data || data.length < PAGE_SIZE) {
          return rows;
        }
      }
    },

    async uploadPhotoFile(path: string, localUri: string) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path, { upsert: true });
      fail("Preparing photo upload", error);
      // Streams the file from disk instead of loading it into memory.
      const result = await FileSystem.uploadAsync(data!.signedUrl, localUri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": contentTypeFor(path), "x-upsert": "true" }
      });
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Photo upload failed (${result.status})`);
      }
    },

    async setPhotoStoragePath(photoId: string, path: string) {
      const { error } = await supabase.from("photos").update({ storage_path: path }).eq("id", photoId);
      fail("Saving photo location", error);
    },

    async downloadPhotoFile(path: string, photoId: string) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 600);
      fail("Preparing photo download", error);
      const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
      }
      const extension = path.split(".").pop() ?? "jpg";
      const destination = `${PHOTOS_DIR}/${photoId}.${extension}`;
      const result = await FileSystem.downloadAsync(data!.signedUrl, destination);
      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(destination, { idempotent: true });
        throw new Error(`Photo download failed (${result.status})`);
      }
      return result.uri;
    },

    // Throws on any error: an empty answer would make the device drop every
    // shared project, so it must only ever come from the server itself.
    async listMyProjectIds() {
      const { data, error } = await supabase.from("project_members").select("project_id").eq("user_id", userId);
      fail("Loading memberships", error);
      if (!data) throw new Error("Loading memberships: no answer");
      return data.map((row) => row.project_id as string);
    }
  };
}
