import type { LayoutPage, LayoutSlot } from "../layout/schemas";
import { getPhotoRenderMetrics } from "../layout/photoMetrics";
import type { Memory } from "../types";

export type PrintSize = { widthMm: number; heightMm: number };
export type PrintImageDimensions = { width: number; height: number };

export function validatePrintSize(size: PrintSize): void {
  if (![size.widthMm, size.heightMm].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("Enter valid positive page dimensions from the Bookfactory template.");
  }
}

// Evaluate the decoded image actually embedded, not stale library metadata.
// Cropping and zoom enlarge the printed image and reduce its effective PPI.
export function effectivePrintPpi(slot: LayoutSlot, image: PrintImageDimensions, size: PrintSize): number | undefined {
  validatePrintSize(size);
  if (![image.width, image.height, slot.frame.width, slot.frame.height, slot.photoScale]
    .every(value => Number.isFinite(value) && value > 0)) return undefined;
  const widthMm = size.widthMm * slot.frame.width;
  const heightMm = size.heightMm * slot.frame.height;
  const metrics = getPhotoRenderMetrics({
    containerAspect: widthMm / heightMm,
    imageAspect: image.width / image.height,
    fitMode: slot.fitMode,
    scale: slot.photoScale,
    offsetX: slot.photoOffsetX,
    offsetY: slot.photoOffsetY
  });
  return Math.min(image.width * 25.4 / (widthMm * metrics.width), image.height * 25.4 / (heightMm * metrics.height));
}

export function printResolutionStatus(ppi: number | undefined): "unknown" | "low" | "below-recommended" | "recommended" {
  if (ppi === undefined || !Number.isFinite(ppi) || ppi <= 0) return "unknown";
  if (ppi < 220) return "low";
  return ppi < 300 ? "below-recommended" : "recommended";
}

// Keep dedication in content. Do not invent blank pages or a spine width:
// those depend on the selected product and its final page count.
export function splitPrintPages(pages: LayoutPage[], memories: Memory[]) {
  const memoriesById = new Map(memories.map(memory => [memory.id, memory]));
  const content: LayoutPage[] = [];
  const front: LayoutPage[] = [];
  const back: LayoutPage[] = [];
  for (const page of pages) {
    const memory = memoriesById.get(page.memoryId);
    if (!memory) throw new Error(`Page ${page.id} has no associated memory.`);
    if (memory.bookRole === "front-cover") front.push(page);
    else if (memory.bookRole === "back-cover") back.push(page);
    else content.push(page);
  }
  return { content, front, back };
}
