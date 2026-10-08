import { effectivePrintPpi, printResolutionStatus, splitPrintPages, validatePrintSize } from "./bookfactoryPrintPlan";
import type { LayoutPage, LayoutSlot } from "../layout/schemas";
import type { Memory } from "../types";

const slot: LayoutSlot = { id: "s", role: "photo", fitMode: "cover", photoScale: 1, photoOffsetX: 0, photoOffsetY: 0,
  frame: { x: 0, y: 0, width: 1, height: 1 } };
const size = { widthMm: 203.2, heightMm: 203.2 };

it("calculates effective resolution after cropping and zooming", () => {
  expect(effectivePrintPpi(slot, { width: 3600, height: 2400 }, size)).toBeCloseTo(300);
  expect(effectivePrintPpi({ ...slot, photoScale: 2 }, { width: 3600, height: 2400 }, size)).toBeCloseTo(150);
  expect(effectivePrintPpi({ ...slot, fitMode: "contain" }, { width: 3600, height: 2400 }, size)).toBeCloseTo(450);
});

it("accounts for physical dimensions and ignores crop offsets when calculating resolution", () => {
  expect(effectivePrintPpi({ ...slot, photoOffsetX: .2, rotation: 45 }, { width: 3600, height: 2400 }, size)).toBeCloseTo(300);
  expect(effectivePrintPpi(slot, { width: 3600, height: 2400 }, { widthMm: 304.8, heightMm: 203.2 })).toBeCloseTo(300);
});

it("does not treat unknown dimensions as print quality", () => {
  expect(effectivePrintPpi(slot, { width: 0, height: 0 }, size)).toBeUndefined();
  expect(printResolutionStatus(undefined)).toBe("unknown");
  expect(printResolutionStatus(219.9)).toBe("low");
  expect(printResolutionStatus(220)).toBe("below-recommended");
  expect(printResolutionStatus(300)).toBe("recommended");
  expect(() => validatePrintSize({ widthMm: NaN, heightMm: 200 })).toThrow();
});

it("separates covers while retaining dedication and content order", () => {
  const memories = [
    { id: "f", bookRole: "front-cover" }, { id: "d", bookRole: "dedication" }, { id: "m" }, { id: "b", bookRole: "back-cover" }
  ] as Memory[];
  const pages = memories.map(memory => ({ id: memory.id, memoryId: memory.id })) as LayoutPage[];
  const result = splitPrintPages(pages, memories);
  expect(result.content.map(page => page.id)).toEqual(["d", "m"]);
  expect(result.front.map(page => page.id)).toEqual(["f"]);
  expect(result.back.map(page => page.id)).toEqual(["b"]);
  expect(pages).toHaveLength(4);
});
