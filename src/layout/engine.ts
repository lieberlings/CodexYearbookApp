import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { getDefaultPagePhotoCounts } from "./pagination";
import { LayoutDocument, LayoutDocumentSchema, LayoutPage } from "./schemas";
import { selectTemplate } from "./templates";

function sortByAddedAt(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

function buildFallbackSections(memoryId: string, photos: PhotoItem[]): MemoryPageSection[] {
  const ordered = sortByAddedAt(photos);
  const counts = getDefaultPagePhotoCounts(ordered.length);
  const sections: MemoryPageSection[] = [];
  let cursor = 0;

  counts.forEach((count, index) => {
    sections.push({
      id: `${memoryId}-page-${index + 1}`,
      memoryId,
      order: index,
      heroPhotoId: count === 1 ? ordered[cursor]?.id : undefined,
      photoIds: ordered.slice(cursor, cursor + count).map((photo) => photo.id)
    });
    cursor += count;
  });

  if (sections.length === 0) {
    sections.push({
      id: `${memoryId}-page-1`,
      memoryId,
      order: 0,
      photoIds: []
    });
  }

  return sections;
}

function resolvePageHeroId(
  memory: Memory,
  section: MemoryPageSection,
  sectionPhotos: PhotoItem[]
): string | undefined {
  if (section.heroPhotoId && sectionPhotos.some((photo) => photo.id === section.heroPhotoId)) {
    return section.heroPhotoId;
  }
  if (memory.primaryPhotoId && sectionPhotos.some((photo) => photo.id === memory.primaryPhotoId)) {
    return memory.primaryPhotoId;
  }
  return sectionPhotos[0]?.id;
}

export function buildLayoutPage(
  memory: Memory,
  section: MemoryPageSection,
  sectionPhotos: PhotoItem[],
  pageIndex: number,
  pageCount: number
): LayoutPage {
  const orderedPhotos = sortByAddedAt(sectionPhotos);
  const heroPhotoId = resolvePageHeroId(memory, section, orderedPhotos);
  const selected = selectTemplate(orderedPhotos, heroPhotoId, section.templateId);

  return {
    id: section.id,
    memoryId: memory.id,
    memoryTitle: memory.title,
    themeLabel: memory.themeLabel,
    backgroundColor: section.backgroundColor,
    slotBorderColor: section.slotBorderColor,
    slotBorderWidth: section.slotBorderWidth,
    slotCornerRadius: section.slotCornerRadius,
    textColor: section.textColor,
    textSize: section.textSize,
    textWeight: section.textWeight,
    textFontFamily: section.textFontFamily,
    pageIndex,
    pageCount,
    templateId: selected?.template.id ?? "empty",
    slots: selected?.slots ?? []
  };
}

export function buildLayoutDocument(
  project: Project,
  memories: Memory[],
  photosByMemoryId: Record<string, PhotoItem[]>,
  pageSectionsByMemoryId?: Record<string, MemoryPageSection[]>,
  orientation: "landscape" | "portrait" = "portrait"
): LayoutDocument {
  const pages: LayoutPage[] = [];
  const sortedMemories = [...memories].sort((a, b) => a.order - b.order);

  for (const memory of sortedMemories) {
    const memoryPhotos = photosByMemoryId[memory.id] ?? [];
    const photosById = Object.fromEntries(memoryPhotos.map((photo) => [photo.id, photo] as const));
    const sections = (
      pageSectionsByMemoryId?.[memory.id]?.length
        ? [...pageSectionsByMemoryId[memory.id]]
        : buildFallbackSections(memory.id, memoryPhotos)
    ).sort((a, b) => a.order - b.order);

    sections.forEach((section, index) => {
      const sectionPhotos = section.photoIds
        .map((photoId) => photosById[photoId])
        .filter((photo): photo is PhotoItem => Boolean(photo));
      pages.push(buildLayoutPage(memory, section, sectionPhotos, index, sections.length));
    });
  }

  return LayoutDocumentSchema.parse({
    projectId: project.id,
    projectName: project.name,
    orientation,
    pages
  });
}
