import { PhotoItem } from "../types";
import { LayoutSlot } from "./schemas";
import { templatePacks } from "./templatePacks";
import {
  PhotoOrientation,
  TemplateDefinition,
  TemplateSlotBlueprint
} from "./templateTypes";

export type {
  PhotoOrientation,
  SlotOrientationPreference,
  TemplateDefinition,
  TemplatePack,
  TemplateSlotBlueprint
} from "./templateTypes";

type TemplateEvaluation = {
  template: TemplateDefinition;
  score: number;
  slots: LayoutSlot[];
};

const templates: TemplateDefinition[] = [
  ...templatePacks.flatMap((pack) => pack.templates)
];

const duplicateTemplateIds = templates
  .map((template) => template.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (__DEV__ && duplicateTemplateIds.length > 0) {
  throw new Error(`Duplicate layout template ids: ${Array.from(new Set(duplicateTemplateIds)).join(", ")}`);
}

export function listTemplatesForPhotoCount(photoCount: number): TemplateDefinition[] {
  return templates.filter((template) => template.photoCount === photoCount);
}

export function listAllTemplates(): TemplateDefinition[] {
  return templates;
}

export function getTemplateById(templateId?: string): TemplateDefinition | undefined {
  if (!templateId) {
    return undefined;
  }
  return templates.find((template) => template.id === templateId);
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
  heroPhotoId?: string,
  slotAssignments?: Record<string, string | undefined>
): LayoutSlot[] {
  const remaining = [...photos];
  const assigned = new Map<string, PhotoItem>();
  const slotsByPriority = [...template.slots].sort((a, b) => a.priority - b.priority);
  const templateSlotIds = new Set(template.slots.map((slot) => slot.id));

  if (slotAssignments) {
    for (const [slotId, photoId] of Object.entries(slotAssignments)) {
      if (!templateSlotIds.has(slotId) || !photoId) {
        continue;
      }
      const photoIndex = remaining.findIndex((photo) => photo.id === photoId);
      if (photoIndex < 0) {
        continue;
      }
      assigned.set(slotId, remaining[photoIndex]);
      remaining.splice(photoIndex, 1);
    }
  }

  const heroSlot = slotsByPriority.find((slot) => slot.role === "hero");
  if (heroSlot && heroPhotoId && !assigned.has(heroSlot.id)) {
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
  preferredTemplateId?: string,
  slotAssignments?: Record<string, string | undefined>
): TemplateEvaluation | undefined {
  const count = photos.length;
  const preferred = getTemplateById(preferredTemplateId);
  if (preferred) {
    return {
      template: preferred,
      score: scoreTemplate(preferred, photos, heroPhotoId),
      slots: assignPhotosToTemplate(preferred, photos, heroPhotoId, slotAssignments)
    };
  }

  if (count <= 0) {
    return undefined;
  }

  const candidates = listTemplatesForPhotoCount(count);
  if (candidates.length === 0) {
    return undefined;
  }

  let best: TemplateEvaluation | undefined;
  for (const template of candidates) {
    const slots = assignPhotosToTemplate(template, photos, heroPhotoId, slotAssignments);
    const score = scoreTemplate(template, photos, heroPhotoId);
    if (!best || score > best.score) {
      best = { template, score, slots };
    }
  }
  return best;
}
