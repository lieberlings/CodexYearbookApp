import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { buildLayoutDocument } from "../layout/engine";
import { applySlotOverridesToPage } from "../layout/overrides";
import type { SlotOverride } from "../state/editorStore";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { buildPhotoExportPlan, safeExportName, uniqueExportFilename } from "./photoExportPlan";
import { utf8, writePhotoZip, ZipSource } from "./photoZipArchive";

type ExportProgress = { completed: number; total: number };
export type PhotoZipResult = { uri: string; exported: number; storedCopies: number; missing: number };

export async function exportProjectPhotosToZip(
  project: Project, memories: Memory[], photos: PhotoItem[], sections: MemoryPageSection[],
  overrides: Record<string, Record<string, SlotOverride>>,
  onProgress?: (progress: ExportProgress) => void,
  includeUnplacedPhotos = true
): Promise<PhotoZipResult> {
  const projectPhotos = [...new Map(photos.filter((photo) => photo.projectId === project.id).map((photo) => [photo.id, photo])).values()];
  if (!projectPhotos.length) throw new Error("There are no photos to export yet.");
  const document = buildLayoutDocument(project, memories,
    Object.fromEntries(memories.map((memory) => [memory.id, projectPhotos.filter((photo) => photo.memoryId === memory.id)])),
    Object.fromEntries(memories.map((memory) => [memory.id, sections.filter((page) => page.memoryId === memory.id)])), "portrait");
  const pagePhotoIds = Object.fromEntries(document.pages.map((base) => {
    const page = applySlotOverridesToPage(base, overrides[base.id]);
    return [page.id, page.slots.map((slot) => slot.photoId).filter((id): id is string => Boolean(id))];
  }));
  const placedIds = new Set(Object.values(pagePhotoIds).flat());
  const exportPhotos = includeUnplacedPhotos ? projectPhotos : projectPhotos.filter((photo) => placedIds.has(photo.id));
  if (!exportPhotos.length) throw new Error("There are no photos placed on pages yet. Choose All photos to include unplaced photos.");
  const entries = buildPhotoExportPlan(memories, exportPhotos, sections, pagePhotoIds);
  const folder = new Directory(Paths.cache, `photo-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  folder.create();
  const output = new File(folder, `${safeExportName(project.name, "Project")}.zip`);
  const temporary = new File(folder, "source-image");
  let libraryAccessible = false;
  try { libraryAccessible = (await MediaLibrary.getPermissionsAsync(false, ["photo"])).granted; } catch { /* Stored photos remain exportable. */ }
  const result: PhotoZipResult = { uri: output.uri, exported: 0, storedCopies: 0, missing: 0 };
  const report: { path?: string; photoId: string; source: string }[] = [];
  const fileNames = new Map<string, Set<string>>();
  // A photo filename must not collide with a page subfolder of the same name.
  for (const entry of entries) {
    const parts = entry.folder.split("/");
    for (let index = 1; index < parts.length; index++) {
      const parent = parts.slice(0, index).join("/");
      const used = fileNames.get(parent) ?? new Set<string>();
      used.add(parts[index].toLowerCase());
      fileNames.set(parent, used);
    }
  }

  async function resolveSource(photo: PhotoItem): Promise<{ file: File; filename: string; original: boolean } | undefined> {
    const candidates: { uri: string; filename?: string; original: boolean }[] = [];
    if (libraryAccessible && photo.importMetadata?.assetId) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(photo.importMetadata.assetId, { shouldDownloadFromNetwork: false });
        candidates.push({ uri: asset.localUri ?? asset.uri, filename: asset.filename, original: true });
      } catch { /* Fall back to the imported copy. */ }
    }
    candidates.push({ uri: photo.uri, original: false });
    for (const candidate of candidates) {
      try {
        if (temporary.exists) temporary.delete();
        let file: File;
        if (candidate.uri.startsWith("file://")) file = new File(candidate.uri);
        else if (candidate.uri.startsWith("content://")) {
          await LegacyFileSystem.copyAsync({ from: candidate.uri, to: temporary.uri });
          file = temporary;
        } else continue;
        if (!file.exists || file.size === 0) continue;
        const handle = file.open();
        let header: Uint8Array;
        try { header = handle.readBytes(Math.min(32, file.size)); } finally { handle.close(); }
        // Imported file extensions can be guessed by older import paths; prefer the bytes.
        const signature = Array.from(header.slice(0, 12), (byte) => String.fromCharCode(byte)).join("");
        const extension = header[0] === 0xff && header[1] === 0xd8 ? "jpg"
          : signature.startsWith("\x89PNG") ? "png" : signature.startsWith("GIF8") ? "gif"
          : signature.startsWith("RIFF") && signature.endsWith("WEBP") ? "webp"
          : signature.includes("ftypavif") ? "avif" : /ftyphei[cfx]|ftypmif1/.test(signature) ? "heic"
          : (candidate.filename ?? candidate.uri).split(/[?#]/)[0].match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] ?? "bin";
        const rawName = candidate.filename ?? `Photo-${photo.id}`;
        const stem = safeExportName(rawName.replace(/\.[a-zA-Z0-9]{2,5}$/, ""), "Photo");
        return { file, filename: `${stem}.${extension}`, original: candidate.original };
      } catch { /* An unavailable original must not prevent exporting a stored copy. */ }
    }
    return undefined;
  }

  async function* sources(): AsyncGenerator<ZipSource> {
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const source = await resolveSource(entry.photo);
      if (!source) {
        result.missing++;
        report.push({ photoId: entry.photo.id, source: "Unavailable: neither original nor stored copy could be read" });
      } else {
        const used = fileNames.get(entry.folder) ?? new Set<string>();
        fileNames.set(entry.folder, used);
        const filename = uniqueExportFilename(source.filename, used);
        const path = `${entry.folder}/${filename}`;
        const file = source.file;
        async function* chunks() {
          const handle = file.open();
          try {
            const size = file.size;
            let read = 0;
            while (read < size) {
              const bytes = handle.readBytes(Math.min(256 * 1024, size - read));
              if (!bytes.length) throw new Error("A photo became unavailable during export. Please try again.");
              read += bytes.length;
              yield bytes;
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }
          } finally { handle.close(); }
        }
        yield { path, chunks: chunks() };
        result.exported++;
        if (!source.original) result.storedCopies++;
        report.push({ path, photoId: entry.photo.id, source: source.original ? "Photo library original" : "Stored copy (no additional resizing or compression)" });
      }
      onProgress?.({ completed: index + 1, total: entries.length });
    }
    if (!result.exported) throw new Error("None of the project's photos are accessible on this device.");
    async function* reportChunks() {
      yield utf8(JSON.stringify({ project: project.name, scope: includeUnplacedPhotos ? "All photos" : "Only photos on pages", exported: result.exported, storedCopies: result.storedCopies,
        missing: result.missing, note: "Files are copied without resizing or recompression. A photo used on multiple named pages appears in each page folder.", files: report }, null, 2));
    }
    yield { path: "export-report.json", chunks: reportChunks() };
  }
  try {
    output.create();
    const handle = output.open();
    try { await writePhotoZip(sources(), (bytes) => handle.writeBytes(bytes)); }
    finally { handle.close(); }
    return result;
  } catch (error) {
    if (output.exists) output.delete();
    throw error;
  } finally {
    if (temporary.exists) temporary.delete();
  }
}

export async function sharePhotoZip(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Export project photos" });
}
