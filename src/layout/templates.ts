import { PhotoItem } from "../types";
import { LayoutSlot } from "./schemas";

type TemplateContext = {
  photoCount: number;
  hasHero: boolean;
  photos: PhotoItem[];
};

export type TemplateDefinition = {
  id: string;
  supportsHero: boolean;
  minPhotos: number;
  maxPhotos: number;
  preferredCounts: number[];
  baseScore: number;
  buildSlots: (photoCount: number) => LayoutSlot[];
};

const GAP = 0.018;

function createSlot(
  id: string,
  role: "hero" | "photo",
  frame: { x: number; y: number; width: number; height: number },
  fitMode: "contain" | "cover"
): LayoutSlot {
  return {
    id,
    role,
    frame,
    fitMode,
    photoScale: 1,
    photoOffsetX: 0,
    photoOffsetY: 0
  };
}

function makeGrid(
  count: number,
  area: { x: number; y: number; width: number; height: number },
  idPrefix: string,
  columnsOverride?: number
): LayoutSlot[] {
  if (count <= 0) {
    return [];
  }
  const columns = columnsOverride ?? (count <= 2 ? 2 : count <= 4 ? 2 : 3);
  const rows = Math.ceil(count / columns);
  const xGap = columns > 1 ? GAP : 0;
  const yGap = rows > 1 ? GAP : 0;
  const cellWidth = (area.width - xGap * (columns - 1)) / columns;
  const cellHeight = (area.height - yGap * (rows - 1)) / rows;

  const slots: LayoutSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    slots.push(
      createSlot(
        `${idPrefix}-${i + 1}`,
        "photo",
        {
          x: area.x + col * (cellWidth + xGap),
          y: area.y + row * (cellHeight + yGap),
          width: cellWidth,
          height: cellHeight
        },
        "cover"
      )
    );
  }
  return slots;
}

const heroTopTemplate: TemplateDefinition = {
  id: "hero-top-v2",
  supportsHero: true,
  minPhotos: 1,
  maxPhotos: 8,
  preferredCounts: [1, 2, 3, 4, 5, 6],
  baseScore: 20,
  buildSlots: (photoCount) => {
    const remaining = Math.max(photoCount - 1, 0);
    const heroHeight = remaining <= 2 ? 0.72 : remaining <= 4 ? 0.62 : 0.56;
    const slots = [createSlot("hero-1", "hero", { x: 0, y: 0, width: 1, height: heroHeight }, "contain")];
    if (remaining > 0) {
      slots.push(
        ...makeGrid(
          remaining,
          {
            x: 0,
            y: heroHeight + GAP,
            width: 1,
            height: 1 - heroHeight - GAP
          },
          "grid"
        )
      );
    }
    return slots;
  }
};

const heroLeftTemplate: TemplateDefinition = {
  id: "hero-left-v1",
  supportsHero: true,
  minPhotos: 2,
  maxPhotos: 8,
  preferredCounts: [2, 3, 4, 5],
  baseScore: 18,
  buildSlots: (photoCount) => {
    const remaining = Math.max(photoCount - 1, 0);
    const heroWidth = remaining <= 2 ? 0.65 : 0.58;
    const slots = [createSlot("hero-1", "hero", { x: 0, y: 0, width: heroWidth, height: 1 }, "contain")];
    if (remaining > 0) {
      slots.push(
        ...makeGrid(
          remaining,
          {
            x: heroWidth + GAP,
            y: 0,
            width: 1 - heroWidth - GAP,
            height: 1
          },
          "grid",
          remaining <= 2 ? 1 : 2
        )
      );
    }
    return slots;
  }
};

const heroBandTemplate: TemplateDefinition = {
  id: "hero-band-v1",
  supportsHero: true,
  minPhotos: 4,
  maxPhotos: 8,
  preferredCounts: [6, 7, 8],
  baseScore: 22,
  buildSlots: (photoCount) => {
    const remaining = Math.max(photoCount - 1, 0);
    const heroHeight = 0.48;
    const slots = [createSlot("hero-1", "hero", { x: 0, y: 0, width: 1, height: heroHeight }, "contain")];
    slots.push(
      ...makeGrid(
        remaining,
        {
          x: 0,
          y: heroHeight + GAP,
          width: 1,
          height: 1 - heroHeight - GAP
        },
        "grid",
        remaining <= 4 ? 2 : 3
      )
    );
    return slots;
  }
};

const gridTwoCols: TemplateDefinition = {
  id: "grid-2col-v1",
  supportsHero: false,
  minPhotos: 1,
  maxPhotos: 4,
  preferredCounts: [1, 2, 3, 4],
  baseScore: 14,
  buildSlots: (photoCount) => makeGrid(photoCount, { x: 0, y: 0, width: 1, height: 1 }, "grid", 2)
};

const gridThreeCols: TemplateDefinition = {
  id: "grid-3col-v1",
  supportsHero: false,
  minPhotos: 5,
  maxPhotos: 8,
  preferredCounts: [5, 6, 7, 8],
  baseScore: 16,
  buildSlots: (photoCount) => makeGrid(photoCount, { x: 0, y: 0, width: 1, height: 1 }, "grid", 3)
};

const allTemplates: TemplateDefinition[] = [
  heroTopTemplate,
  heroLeftTemplate,
  heroBandTemplate,
  gridTwoCols,
  gridThreeCols
];

function photoAspect(photo: PhotoItem): number {
  if (photo.width && photo.height && photo.height > 0) {
    return photo.width / photo.height;
  }
  return 4 / 3;
}

function slotAspect(slot: LayoutSlot): number {
  if (slot.frame.height <= 0) {
    return 1;
  }
  return slot.frame.width / slot.frame.height;
}

function scoreAspectFit(templateSlots: LayoutSlot[], photos: PhotoItem[]): number {
  if (templateSlots.length === 0 || photos.length === 0) {
    return 0;
  }
  const count = Math.min(templateSlots.length, photos.length);
  let penalty = 0;
  for (let i = 0; i < count; i += 1) {
    const s = templateSlots[i];
    const p = photos[i];
    const ratioDelta = Math.abs(Math.log(photoAspect(p) / slotAspect(s)));
    penalty += s.fitMode === "cover" ? ratioDelta * 0.35 : ratioDelta * 1.25;
  }
  return -penalty;
}

function scoreTemplate(template: TemplateDefinition, ctx: TemplateContext): number {
  if (ctx.photoCount < template.minPhotos || ctx.photoCount > template.maxPhotos) {
    return Number.NEGATIVE_INFINITY;
  }
  if (ctx.hasHero && !template.supportsHero) {
    return Number.NEGATIVE_INFINITY;
  }
  if (!ctx.hasHero && template.supportsHero) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = template.baseScore;
  if (template.preferredCounts.includes(ctx.photoCount)) {
    score += 5;
  }

  const slots = template.buildSlots(ctx.photoCount);
  const usedArea = slots.reduce((sum, slot) => sum + slot.frame.width * slot.frame.height, 0);
  score += usedArea * 10;
  score += scoreAspectFit(slots, ctx.photos);
  return score;
}

export function selectTemplate(ctx: TemplateContext): TemplateDefinition {
  let best = allTemplates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const template of allTemplates) {
    const score = scoreTemplate(template, ctx);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return best;
}
