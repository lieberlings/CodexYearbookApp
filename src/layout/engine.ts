import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { LayoutDocument, LayoutDocumentSchema, LayoutPage, LayoutSlot } from "./schemas";

const MAX_PHOTOS_PER_PAGE = 4;
const GAP = 0.018;
const INNER_PADDING = 0.006;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PhotoOrientation = "portrait" | "landscape" | "square";

function prioritizePrimary(photos: PhotoItem[], primaryPhotoId?: string): PhotoItem[] {
  const sorted = [...photos].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  if (!primaryPhotoId) {
    return sorted;
  }
  const primary = sorted.find((photo) => photo.id === primaryPhotoId);
  if (!primary) {
    return sorted;
  }
  return [primary, ...sorted.filter((photo) => photo.id !== primaryPhotoId)];
}

function getOrientation(photo: PhotoItem): PhotoOrientation {
  const width = photo.width ?? 0;
  const height = photo.height ?? 0;
  if (width <= 0 || height <= 0) {
    return "landscape";
  }
  const ratio = width / height;
  if (ratio > 1.08) {
    return "landscape";
  }
  if (ratio < 0.92) {
    return "portrait";
  }
  return "square";
}

function targetFrameAspect(photo: PhotoItem): number {
  const orientation = getOrientation(photo);
  if (orientation === "portrait") {
    return 0.74;
  }
  if (orientation === "square") {
    return 1;
  }
  return 1.34;
}

function insetRect(area: Rect, inset: number): Rect {
  const x = area.x + inset;
  const y = area.y + inset;
  const width = Math.max(0.0001, area.width - inset * 2);
  const height = Math.max(0.0001, area.height - inset * 2);
  return { x, y, width, height };
}

function fitAspectInArea(area: Rect, targetAspect: number, inset = 0): Rect {
  const padded = insetRect(area, inset);
  const areaAspect = padded.width / Math.max(0.0001, padded.height);
  if (areaAspect > targetAspect) {
    const height = padded.height;
    const width = height * targetAspect;
    return {
      x: padded.x + (padded.width - width) / 2,
      y: padded.y,
      width,
      height
    };
  }
  const width = padded.width;
  const height = width / Math.max(0.0001, targetAspect);
  return {
    x: padded.x,
    y: padded.y + (padded.height - height) / 2,
    width,
    height
  };
}

function chooseGridColumns(count: number, area: Rect): number {
  if (count <= 1) {
    return 1;
  }
  let bestCols = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const totalGapX = Math.max(0, cols - 1) * GAP;
    const totalGapY = Math.max(0, rows - 1) * GAP;
    const cellWidth = (area.width - totalGapX) / cols;
    const cellHeight = (area.height - totalGapY) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) {
      continue;
    }
    const cellAspect = cellWidth / cellHeight;
    const emptyCells = rows * cols - count;
    const score = Math.abs(Math.log(cellAspect)) + emptyCells * 0.1;
    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
    }
  }
  return bestCols;
}

function buildGridCells(count: number, area: Rect): Rect[] {
  if (count <= 0) {
    return [];
  }
  const columns = chooseGridColumns(count, area);
  const rows = Math.ceil(count / columns);
  const totalGapX = Math.max(0, columns - 1) * GAP;
  const totalGapY = Math.max(0, rows - 1) * GAP;
  const cellWidth = (area.width - totalGapX) / columns;
  const cellHeight = (area.height - totalGapY) / rows;
  const cells: Rect[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    cells.push({
      x: area.x + col * (cellWidth + GAP),
      y: area.y + row * (cellHeight + GAP),
      width: cellWidth,
      height: cellHeight
    });
  }
  return cells;
}

function createSlot(
  id: string,
  role: "hero" | "photo",
  frame: Rect,
  photoId?: string
): LayoutSlot {
  return {
    id,
    role,
    fitMode: "cover",
    photoScale: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    frame,
    photoId
  };
}

function buildAdaptiveSlots(
  photos: PhotoItem[],
  heroPhotoId?: string
): LayoutSlot[] {
  const ordered = [...photos].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  if (ordered.length === 0) {
    return [];
  }
  const effectiveHeroId = ordered.some((photo) => photo.id === heroPhotoId)
    ? heroPhotoId
    : ordered[0]?.id;
  const heroPhoto = ordered.find((photo) => photo.id === effectiveHeroId) ?? ordered[0];
  const others = ordered.filter((photo) => photo.id !== heroPhoto.id);

  let heroArea: Rect = { x: 0, y: 0, width: 1, height: 1 };
  let othersArea: Rect = { x: 0, y: 0, width: 0, height: 0 };

  if (others.length > 0) {
    const heroOrientation = getOrientation(heroPhoto);
    if (heroOrientation === "portrait") {
      const heroWidth = others.length === 1 ? 0.42 : 0.46;
      heroArea = { x: 0, y: 0, width: heroWidth, height: 1 };
      othersArea = { x: heroWidth + GAP, y: 0, width: 1 - heroWidth - GAP, height: 1 };
    } else {
      const heroHeight = others.length <= 2 ? 0.6 : 0.56;
      heroArea = { x: 0, y: 0, width: 1, height: heroHeight };
      othersArea = { x: 0, y: heroHeight + GAP, width: 1, height: 1 - heroHeight - GAP };
    }
  }

  const slots: LayoutSlot[] = [
    createSlot(
      "hero-1",
      "hero",
      fitAspectInArea(heroArea, targetFrameAspect(heroPhoto), INNER_PADDING),
      heroPhoto.id
    )
  ];

  const cells = buildGridCells(others.length, othersArea);
  others.forEach((photo, index) => {
    const cell = cells[index];
    if (!cell) {
      return;
    }
    slots.push(
      createSlot(
        `photo-${index + 1}`,
        "photo",
        fitAspectInArea(cell, targetFrameAspect(photo), INNER_PADDING),
        photo.id
      )
    );
  });

  return slots;
}

function splitEvenly<T>(items: T[], maxPerPage: number): T[][] {
  if (items.length === 0) {
    return [[]];
  }
  const pageCount = Math.ceil(items.length / maxPerPage);
  const baseSize = Math.floor(items.length / pageCount);
  const remainder = items.length % pageCount;
  const chunks: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < pageCount; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    chunks.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return chunks;
}

function buildPage(
  memory: Memory,
  photos: PhotoItem[],
  pageIndex: number,
  pageCount: number,
  pageId: string,
  heroPhotoId?: string
): LayoutPage {
  const slots = buildAdaptiveSlots(photos, heroPhotoId);

  return {
    id: pageId,
    memoryId: memory.id,
    memoryTitle: memory.title,
    themeLabel: memory.themeLabel,
    pageIndex,
    pageCount,
    templateId: "adaptive-orientation-v1",
    slots
  };
}

export function buildLayoutDocument(
  project: Project,
  memories: Memory[],
  photosByMemoryId: Record<string, PhotoItem[]>,
  pageSectionsByMemoryId?: Record<string, MemoryPageSection[]>,
  orientation: "landscape" | "portrait" = "landscape"
): LayoutDocument {
  const pages: LayoutPage[] = [];
  const sortedMemories = [...memories].sort((a, b) => a.order - b.order);

  for (const memory of sortedMemories) {
    const memoryPhotos = photosByMemoryId[memory.id] ?? [];
    const photosById = Object.fromEntries(memoryPhotos.map((photo) => [photo.id, photo] as const));
    const pageSections = [...(pageSectionsByMemoryId?.[memory.id] ?? [])].sort((a, b) => a.order - b.order);

    if (pageSections.length > 0) {
      pageSections.forEach((section, index) => {
        const sectionPhotos = section.photoIds
          .map((photoId) => photosById[photoId])
          .filter((photo): photo is PhotoItem => Boolean(photo));
        pages.push(
          buildPage(
            memory,
            sectionPhotos,
            index,
            pageSections.length,
            section.id,
            section.heroPhotoId
          )
        );
      });
    } else {
      const chunks = splitEvenly(prioritizePrimary(memoryPhotos, memory.primaryPhotoId), MAX_PHOTOS_PER_PAGE);
      chunks.forEach((chunk, index) => {
        pages.push(buildPage(memory, chunk, index, chunks.length, `${memory.id}-page-${index + 1}`, memory.primaryPhotoId));
      });
    }
  }

  return LayoutDocumentSchema.parse({
    projectId: project.id,
    projectName: project.name,
    orientation,
    pages
  });
}
