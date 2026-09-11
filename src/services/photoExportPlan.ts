import { Memory, MemoryPageSection, PhotoItem } from "../types";

export function safeExportName(value: string, fallback: string): string {
  const clean = value.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80).replace(/[. ]+$/g, "");
  if (!clean) return fallback;
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(clean) ? `_${clean}` : clean;
}

export function uniqueExportName(name: string, used: Set<string>): string {
  let candidate = name;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${name} (${suffix++})`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export function uniqueExportFilename(filename: string, used: Set<string>): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  let candidate = filename;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${stem} (${suffix++})${extension}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export type PhotoExportEntry = { photo: PhotoItem; folder: string };

export function buildPhotoExportPlan(
  memories: Memory[], photos: PhotoItem[], sections: MemoryPageSection[],
  pagePhotoIds: Record<string, string[]>
): PhotoExportEntry[] {
  const entries: PhotoExportEntry[] = [];
  const memoryFolders = new Set<string>(["export-report.json"]);
  const assigned = new Set<string>();
  for (const memory of [...memories].sort((a, b) => a.order - b.order)) {
    const folder = uniqueExportName(safeExportName(memory.title, "Memory"), memoryFolders);
    const memoryPhotos = photos.filter((photo) => photo.memoryId === memory.id);
    const grouped = new Set<string>();
    const pageFolders = new Set<string>();
    for (const section of sections.filter((page) => page.memoryId === memory.id).sort((a, b) => a.order - b.order)) {
      if (!section.exportToFolder) continue;
      const pageFolder = uniqueExportName(safeExportName(section.exportFolderName ?? "", `Page ${section.order + 1}`), pageFolders);
      const ids = new Set(pagePhotoIds[section.id] ?? section.photoIds);
      for (const photo of memoryPhotos) {
        if (!ids.has(photo.id)) continue;
        entries.push({ photo, folder: `${folder}/${pageFolder}` });
        grouped.add(photo.id);
      }
    }
    for (const photo of memoryPhotos) {
      assigned.add(photo.id);
      if (!grouped.has(photo.id)) entries.push({ photo, folder });
    }
  }
  const unassigned = photos.filter((photo) => !assigned.has(photo.id));
  if (unassigned.length) {
    const folder = uniqueExportName("Other photos", memoryFolders);
    for (const photo of unassigned) entries.push({ photo, folder });
  }
  return entries;
}
