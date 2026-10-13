import { TemplateDefinition } from "../../layout/templates";
import { MemoryPageSection } from "../../types";

export type InspectorKind = "pages" | "layout" | "photos" | "text" | "background" | "border";

export const TEXT_BOX_CORNER_RADII = [0, 8, 18, 32];
export const PHOTO_PICKER_SELECTION_LIMIT = 50;
export const ANDROID_PHOTO_PICKER_IMPORTS_ENABLED = true;
export const FONT_FAMILIES = [
  { id: "System", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "monospace", label: "Mono" }
];
export const DRAG_HOLD_MS = 220;

export function applyColorOpacity(color: string | undefined, opacity: number | undefined) {
  if (!color) {
    return "transparent";
  }
  const normalizedOpacity = clamp(opacity ?? 1, 0, 1);
  const hex = color.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

export function sameSectionOrder(left: MemoryPageSection[], right: MemoryPageSection[]) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]?.id !== right[i]?.id) {
      return false;
    }
  }
  return true;
}

export function sectionOrderKey(sections: MemoryPageSection[]) {
  return sections.map((section) => section.id).join("|");
}

export function groupTemplatesByPhotoCount(templates: TemplateDefinition[]) {
  const groups = new Map<number, TemplateDefinition[]>();
  templates.forEach((template) => {
    groups.set(template.photoCount, [...(groups.get(template.photoCount) ?? []), template]);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([photoCount, groupedTemplates]) => ({ photoCount, templates: groupedTemplates }));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Shown in an empty text box. New boxes are sized to fit it.
export const TEXT_PLACEHOLDER = "Tap to edit";

export function estimateTextBoxSize(text: string, fontSize: number, canvasSize: number) {
  const lines = (text || TEXT_PLACEHOLDER).split("\n");
  const longestLineLength = Math.max(...lines.map((line) => line.trim().length), 4);
  const safeCanvasSize = Math.max(canvasSize, 1);
  const widthPx = clamp(longestLineLength * fontSize * 0.56 + 28, fontSize * 3.2, safeCanvasSize * 0.88);
  const heightPx = clamp(lines.length * fontSize * 1.24 + 22, fontSize * 1.9, safeCanvasSize * 0.52);
  return {
    width: clamp(widthPx / safeCanvasSize, 0.18, 0.9),
    height: clamp(heightPx / safeCanvasSize, 0.1, 0.56)
  };
}

// Where a new free text box goes: the first spot, scanning rows top to bottom
// (centre, then left, then right), whose rectangle doesn't overlap an existing
// box. A full page falls back to the spot with the least overlap.
type Rect = { x: number; y: number; width: number; height: number };

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

export function nextTextBoxPosition(existing: Rect[], size: { width: number; height: number }): { x: number; y: number } {
  const gap = 0.02;
  const margin = 0.05;
  const columns = [0.5 - size.width / 2, margin, 1 - margin - size.width].map((x) => clamp(x, 0, 1 - size.width));
  let best = { x: columns[0], y: clamp(0.12, 0, 1 - size.height) };
  let bestOverlap = Infinity;
  for (let y = 0.12; y + size.height <= 1 - margin + 1e-9; y += size.height + gap) {
    for (const x of columns) {
      const candidate = { x, y, width: size.width, height: size.height };
      const padded = { x: x - gap, y: y - gap, width: size.width + 2 * gap, height: size.height + 2 * gap };
      const overlap = existing.reduce((total, box) => total + overlapArea(padded, box), 0);
      if (overlap === 0) {
        return { x: candidate.x, y: candidate.y };
      }
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = { x: candidate.x, y: candidate.y };
      }
    }
  }
  return best;
}
