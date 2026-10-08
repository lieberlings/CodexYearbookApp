import { LayoutPage, LayoutSlot } from "./schemas";
import { Memory, MemoryPageSection } from "../types";

export function unlockPage(section: MemoryPageSection, page: LayoutPage): MemoryPageSection {
  return { ...section, templateId: "freestyle", layoutLocked: false,
    freestyleSlots: page.slots.map(slot => ({ ...slot, frame: { ...slot.frame } })),
    slotAssignments: Object.fromEntries(page.slots.map(slot => [slot.id, slot.photoId])),
    photoIds: [...new Set([...section.photoIds, ...page.slots.flatMap(slot => slot.photoId ? [slot.photoId] : [])])],
    textBoxes: page.textBoxes.map(box => {
      const anchor = page.slots.find(slot => slot.id === box.anchorSlotId);
      return { ...box, ...(anchor?.frame ?? {}), anchorSlotId: undefined };
    }) };
}

export function droppedPhoto(photoId: string, x: number, y: number, id: string, zIndex: number): LayoutSlot {
  return { id, role: "photo", fitMode: "cover", photoId, photoScale: 1, photoOffsetX: 0, photoOffsetY: 0,
    zIndex, frame: { x: Math.max(0, Math.min(.65, x - .175)), y: Math.max(0, Math.min(.65, y - .175)), width: .35, height: .35 } };
}

export function bookOrder(a: Memory, b: Memory): number {
  const rank = (m: Memory) => m.bookRole === "front-cover" ? 0 : m.bookRole === "dedication" ? 1 : m.bookRole === "back-cover" ? 3 : 2;
  return rank(a) - rank(b) || a.order - b.order;
}

export function snapRotation(degrees: number): number {
  const normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  const snap = Math.round(normalized / 90) * 90;
  return (Math.abs(normalized - snap) < 4 ? snap : normalized) || 0;
}

// Move through adjacent layers without changing the relative order of the others.
export function stepLayer<T>(layers: readonly T[], from: number, forward: boolean): T[] {
  const ordered = [...layers];
  if (from < 0 || from >= ordered.length) return ordered;
  const to = Math.max(0, Math.min(ordered.length - 1, from + (forward ? 1 : -1)));
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered;
}
