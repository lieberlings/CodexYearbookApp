import { PhotoItem } from "../types";
import { LayoutSlot } from "./schemas";

export type PhotoOrientation = "portrait" | "landscape" | "square";
export type SlotOrientationPreference = PhotoOrientation | "any";

export type TemplateSlotBlueprint = {
  id: string;
  role: "hero" | "photo";
  frame: { x: number; y: number; width: number; height: number };
  fitMode: "contain" | "cover";
  priority: number;
  preferredOrientation: SlotOrientationPreference;
};

export type TemplateDefinition = {
  id: string;
  label: string;
  photoCount: number;
  baseScore: number;
  slots: TemplateSlotBlueprint[];
};

type TemplateEvaluation = {
  template: TemplateDefinition;
  score: number;
  slots: LayoutSlot[];
};

const GAP = 0.03;
const OUTER = 0.06;

function makeSlot(
  id: string,
  role: "hero" | "photo",
  frame: { x: number; y: number; width: number; height: number },
  priority: number,
  preferredOrientation: SlotOrientationPreference,
  fitMode: "contain" | "cover" = "cover"
): TemplateSlotBlueprint {
  return {
    id,
    role,
    frame,
    fitMode,
    priority,
    preferredOrientation
  };
}

function photoAspect(photo: PhotoItem): number {
  if (photo.width && photo.height && photo.height > 0) {
    return photo.width / photo.height;
  }
  return 1;
}

export function getPhotoOrientation(photo: PhotoItem): PhotoOrientation {
  const aspect = photoAspect(photo);
  if (aspect > 1.08) {
    return "landscape";
  }
  if (aspect < 0.92) {
    return "portrait";
  }
  return "square";
}

function slotAspect(slot: TemplateSlotBlueprint): number {
  return slot.frame.width / Math.max(0.0001, slot.frame.height);
}

function insetFrame(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  return {
    x,
    y,
    width,
    height
  };
}

function buildGridFrames(
  count: number,
  columns: number,
  rows: number,
  options?: { x?: number; y?: number; width?: number; height?: number; centeredLastRow?: boolean }
): { x: number; y: number; width: number; height: number }[] {
  const areaX = options?.x ?? OUTER;
  const areaY = options?.y ?? OUTER;
  const areaWidth = options?.width ?? 1 - OUTER * 2;
  const areaHeight = options?.height ?? 1 - OUTER * 2;
  const cellWidth = (areaWidth - GAP * (columns - 1)) / columns;
  const cellHeight = (areaHeight - GAP * (rows - 1)) / rows;
  const frames: { x: number; y: number; width: number; height: number }[] = [];

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const isLastRow = row === rows - 1;
    const itemsInLastRow = count - columns * (rows - 1);
    const useCenteredLastRow = Boolean(options?.centeredLastRow) && isLastRow && itemsInLastRow < columns;
    const rowStartX = useCenteredLastRow
      ? areaX + (areaWidth - (itemsInLastRow * cellWidth + GAP * Math.max(0, itemsInLastRow - 1))) / 2
      : areaX;
    frames.push({
      x: rowStartX + col * (cellWidth + GAP),
      y: areaY + row * (cellHeight + GAP),
      width: cellWidth,
      height: cellHeight
    });
  }

  return frames;
}

function createGridTemplate(
  id: string,
  label: string,
  photoCount: number,
  columns: number,
  rows: number,
  baseScore: number,
  preferredOrientation: SlotOrientationPreference = "any"
): TemplateDefinition {
  const frames = buildGridFrames(photoCount, columns, rows, { centeredLastRow: true });
  return {
    id,
    label,
    photoCount,
    baseScore,
    slots: frames.map((frame, index) =>
      makeSlot(`slot-${index + 1}`, "photo", frame, index + 1, preferredOrientation, "cover")
    )
  };
}

function createHeroTopTemplate(
  id: string,
  label: string,
  photoCount: number,
  heroHeight: number,
  bottomColumns: number,
  baseScore: number
): TemplateDefinition {
  const remaining = Math.max(0, photoCount - 1);
  const heroFrame = insetFrame(OUTER, OUTER, 1 - OUTER * 2, heroHeight);
  const slots: TemplateSlotBlueprint[] = [
    makeSlot("slot-1", "hero", heroFrame, 1, "landscape", "contain")
  ];

  if (remaining > 0) {
    const bottomY = OUTER + heroHeight + GAP;
    const bottomHeight = 1 - OUTER - bottomY;
    const bottomRows = Math.ceil(remaining / bottomColumns);
    const frames = buildGridFrames(remaining, bottomColumns, bottomRows, {
      x: OUTER,
      y: bottomY,
      width: 1 - OUTER * 2,
      height: bottomHeight,
      centeredLastRow: true
    });
    frames.forEach((frame, index) => {
      slots.push(makeSlot(`slot-${index + 2}`, "photo", frame, index + 2, "any"));
    });
  }

  return { id, label, photoCount, baseScore, slots };
}

function createHeroLeftTemplate(
  id: string,
  label: string,
  photoCount: number,
  heroWidth: number,
  rightColumns: number,
  baseScore: number
): TemplateDefinition {
  const remaining = Math.max(0, photoCount - 1);
  const heroFrame = insetFrame(OUTER, OUTER, heroWidth, 1 - OUTER * 2);
  const slots: TemplateSlotBlueprint[] = [
    makeSlot("slot-1", "hero", heroFrame, 1, "portrait", "contain")
  ];

  if (remaining > 0) {
    const rightX = OUTER + heroWidth + GAP;
    const rightWidth = 1 - OUTER - rightX;
    const rightRows = Math.ceil(remaining / rightColumns);
    const frames = buildGridFrames(remaining, rightColumns, rightRows, {
      x: rightX,
      y: OUTER,
      width: rightWidth,
      height: 1 - OUTER * 2,
      centeredLastRow: false
    });
    frames.forEach((frame, index) => {
      slots.push(makeSlot(`slot-${index + 2}`, "photo", frame, index + 2, "any"));
    });
  }

  return { id, label, photoCount, baseScore, slots };
}

function createTightGridTemplate(
  id: string,
  label: string,
  photoCount: number,
  columns: number,
  rows: number,
  baseScore: number
): TemplateDefinition {
  const tightOuter = 0.04;
  const tightGap = 0.02;
  const areaWidth = 1 - tightOuter * 2;
  const areaHeight = 1 - tightOuter * 2;
  const cellWidth = (areaWidth - tightGap * (columns - 1)) / columns;
  const cellHeight = (areaHeight - tightGap * (rows - 1)) / rows;
  const slots: TemplateSlotBlueprint[] = [];
  for (let index = 0; index < photoCount; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    slots.push(
      makeSlot(
        `slot-${index + 1}`,
        "photo",
        {
          x: tightOuter + col * (cellWidth + tightGap),
          y: tightOuter + row * (cellHeight + tightGap),
          width: cellWidth,
          height: cellHeight
        },
        index + 1,
        "any"
      )
    );
  }
  return { id, label, photoCount, baseScore, slots };
}

function createSingleFramedTemplate(): TemplateDefinition {
  return {
    id: "1-framed",
    label: "Framed",
    photoCount: 1,
    baseScore: 16,
    slots: [makeSlot("slot-1", "hero", insetFrame(0.15, 0.15, 0.7, 0.7), 1, "any", "contain")]
  };
}

const templates: TemplateDefinition[] = [
  {
    id: "1-full",
    label: "Full",
    photoCount: 1,
    baseScore: 20,
    slots: [makeSlot("slot-1", "hero", insetFrame(OUTER, OUTER, 1 - OUTER * 2, 1 - OUTER * 2), 1, "any", "contain")]
  },
  createSingleFramedTemplate(),
  createGridTemplate("2-grid", "Grid", 2, 2, 1, 18, "portrait"),
  createHeroTopTemplate("2-hero-top", "Hero Top", 2, 0.38, 1, 20),
  createGridTemplate("3-grid", "Grid", 3, 2, 2, 17),
  createHeroTopTemplate("3-hero-top", "Hero Top", 3, 0.28, 2, 21),
  createHeroLeftTemplate("3-hero-left", "Hero Left", 3, 0.42, 2, 21),
  createTightGridTemplate("3-tight-grid", "Tight Grid", 3, 2, 2, 16),
  createGridTemplate("4-grid", "Grid", 4, 2, 2, 18),
  createHeroTopTemplate("4-hero-top", "Hero Top", 4, 0.26, 3, 22),
  createHeroLeftTemplate("4-hero-left", "Hero Left", 4, 0.42, 2, 22),
  createTightGridTemplate("4-tight-grid", "Tight Grid", 4, 2, 2, 17),
  createGridTemplate("5-grid", "Grid", 5, 2, 3, 17),
  createHeroTopTemplate("5-hero-top", "Hero Top", 5, 0.24, 3, 23),
  createHeroLeftTemplate("5-hero-left", "Hero Left", 5, 0.42, 2, 23),
  createTightGridTemplate("5-tight-grid", "Tight Grid", 5, 2, 3, 17),
  createGridTemplate("6-grid", "Grid", 6, 2, 3, 18),
  createHeroTopTemplate("6-hero-top", "Hero Top", 6, 0.24, 3, 23),
  createHeroLeftTemplate("6-hero-left", "Hero Left", 6, 0.42, 2, 23),
  createTightGridTemplate("6-tight-grid", "Tight Grid", 6, 2, 3, 17),
  createGridTemplate("7-grid", "Grid", 7, 3, 3, 18),
  createHeroTopTemplate("7-hero-top", "Hero Top", 7, 0.23, 3, 23),
  createHeroLeftTemplate("7-hero-left", "Hero Left", 7, 0.42, 2, 23),
  createTightGridTemplate("7-tight-grid", "Tight Grid", 7, 3, 3, 17),
  createGridTemplate("8-grid", "Grid", 8, 3, 3, 18),
  createHeroTopTemplate("8-hero-top", "Hero Top", 8, 0.22, 3, 23),
  createHeroLeftTemplate("8-hero-left", "Hero Left", 8, 0.42, 2, 23),
  createTightGridTemplate("8-tight-grid", "Tight Grid", 8, 3, 3, 17),
  createGridTemplate("9-grid", "Grid", 9, 3, 3, 18),
  createHeroTopTemplate("9-hero-top", "Hero Top", 9, 0.2, 3, 22),
  createHeroLeftTemplate("9-hero-left", "Hero Left", 9, 0.42, 2, 22),
  createTightGridTemplate("9-tight-grid", "Tight Grid", 9, 3, 3, 17)
];

export function listTemplatesForPhotoCount(photoCount: number): TemplateDefinition[] {
  return templates.filter((template) => template.photoCount === photoCount);
}

export function getTemplateById(templateId?: string): TemplateDefinition | undefined {
  if (!templateId) {
    return undefined;
  }
  return templates.find((template) => template.id === templateId);
}

function scoreOrientationMatch(
  photo: PhotoItem,
  slot: TemplateSlotBlueprint
): number {
  if (slot.preferredOrientation === "any") {
    return 0.8;
  }
  const orientation = getPhotoOrientation(photo);
  if (slot.preferredOrientation === orientation) {
    return 3.2;
  }
  if (slot.preferredOrientation === "square" && orientation === "square") {
    return 3.2;
  }
  if (
    (slot.preferredOrientation === "landscape" && orientation === "square") ||
    (slot.preferredOrientation === "portrait" && orientation === "square")
  ) {
    return 1.1;
  }
  return -1.4;
}

function scorePhotoForSlot(
  photo: PhotoItem,
  slot: TemplateSlotBlueprint,
  heroPhotoId?: string
): number {
  let score = 0;
  const isHeroPhoto = heroPhotoId === photo.id;
  if (slot.role === "hero") {
    score += isHeroPhoto ? 12 : 2;
  } else if (isHeroPhoto) {
    score -= 2;
  }
  score += scoreOrientationMatch(photo, slot);
  score -= Math.abs(Math.log(photoAspect(photo) / Math.max(0.0001, slotAspect(slot)))) * 1.35;
  score += (1 - slot.priority / 10) * 0.5;
  return score;
}

function assignPhotosToTemplate(
  template: TemplateDefinition,
  photos: PhotoItem[],
  heroPhotoId?: string
): LayoutSlot[] {
  const remaining = [...photos];
  const assigned = new Map<string, PhotoItem>();
  const slotsByPriority = [...template.slots].sort((a, b) => a.priority - b.priority);

  const heroSlot = slotsByPriority.find((slot) => slot.role === "hero");
  if (heroSlot && heroPhotoId) {
    const heroIndex = remaining.findIndex((photo) => photo.id === heroPhotoId);
    if (heroIndex >= 0) {
      assigned.set(heroSlot.id, remaining[heroIndex]);
      remaining.splice(heroIndex, 1);
    }
  }

  for (const slot of slotsByPriority) {
    if (assigned.has(slot.id)) {
      continue;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    remaining.forEach((photo, index) => {
      const score = scorePhotoForSlot(photo, slot, heroPhotoId);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const nextPhoto = remaining.splice(bestIndex, 1)[0];
    if (nextPhoto) {
      assigned.set(slot.id, nextPhoto);
    }
  }

  return template.slots.map((slot) => ({
    id: slot.id,
    role: slot.role,
    fitMode: slot.fitMode,
    photoScale: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    frame: slot.frame,
    photoId: assigned.get(slot.id)?.id
  }));
}

function scoreTemplate(template: TemplateDefinition, photos: PhotoItem[], heroPhotoId?: string): number {
  const slots = assignPhotosToTemplate(template, photos, heroPhotoId);
  let score = template.baseScore;
  const hasHeroSlot = template.slots.some((slot) => slot.role === "hero");
  if (heroPhotoId) {
    score += hasHeroSlot ? 14 : -10;
  }

  score += slots.reduce((sum, slot) => {
    const photo = slot.photoId ? photos.find((item) => item.id === slot.photoId) : undefined;
    if (!photo) {
      return sum;
    }
    const blueprint = template.slots.find((item) => item.id === slot.id);
    if (!blueprint) {
      return sum;
    }
    return sum + scorePhotoForSlot(photo, blueprint, heroPhotoId);
  }, 0);

  return score;
}

export function selectTemplate(
  photos: PhotoItem[],
  heroPhotoId?: string,
  preferredTemplateId?: string
): TemplateEvaluation | undefined {
  const count = photos.length;
  if (count <= 0) {
    return undefined;
  }

  const candidates = listTemplatesForPhotoCount(count);
  if (candidates.length === 0) {
    return undefined;
  }

  const preferred = getTemplateById(preferredTemplateId);
  if (preferred && preferred.photoCount === count) {
    return {
      template: preferred,
      score: scoreTemplate(preferred, photos, heroPhotoId),
      slots: assignPhotosToTemplate(preferred, photos, heroPhotoId)
    };
  }

  let best: TemplateEvaluation | undefined;
  for (const template of candidates) {
    const slots = assignPhotosToTemplate(template, photos, heroPhotoId);
    const score = scoreTemplate(template, photos, heroPhotoId);
    if (!best || score > best.score) {
      best = { template, score, slots };
    }
  }
  return best;
}
