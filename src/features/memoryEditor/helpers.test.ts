import { TemplateDefinition } from "../../layout/templates";
import { MemoryPageSection } from "../../types";
import {
  applyColorOpacity,
  clamp,
  estimateTextBoxSize,
  nextTextBoxPosition,
  groupTemplatesByPhotoCount,
  sameSectionOrder,
  sectionOrderKey
} from "./helpers";

const section = (id: string) => ({ id }) as MemoryPageSection;
const template = (id: string, photoCount: number) => ({ id, photoCount }) as TemplateDefinition;

describe("memory editor helpers", () => {
  it("turns a hex color and opacity into rgba", () => {
    expect(applyColorOpacity("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    expect(applyColorOpacity("#fff", undefined)).toBe("rgba(255, 255, 255, 1)");
    expect(applyColorOpacity("#000000", 3)).toBe("rgba(0, 0, 0, 1)");
    expect(applyColorOpacity(undefined, 0.5)).toBe("transparent");
    expect(applyColorOpacity("red", 0.5)).toBe("red");
  });

  it("compares page order by id", () => {
    expect(sameSectionOrder([section("a"), section("b")], [section("a"), section("b")])).toBe(true);
    expect(sameSectionOrder([section("a"), section("b")], [section("b"), section("a")])).toBe(false);
    expect(sameSectionOrder([section("a")], [section("a"), section("b")])).toBe(false);
    expect(sectionOrderKey([section("a"), section("b")])).toBe("a|b");
  });

  it("groups templates by photo count in ascending order", () => {
    const groups = groupTemplatesByPhotoCount([template("t3", 3), template("t1", 1), template("t3b", 3)]);
    expect(groups.map((group) => group.photoCount)).toEqual([1, 3]);
    expect(groups[1].templates.map((item) => item.id)).toEqual(["t3", "t3b"]);
  });

  it("clamps values", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  it("sizes an empty text box to fit the placeholder and keeps sizes within bounds", () => {
    const empty = estimateTextBoxSize("", 26, 320);
    expect(empty.width).toBeGreaterThan(0.18);
    expect(empty.width * 320).toBeGreaterThanOrEqual("Tap to edit".length * 26 * 0.56);
    const huge = estimateTextBoxSize("x".repeat(500), 72, 320);
    expect(huge.width).toBeLessThanOrEqual(0.9);
    expect(huge.height).toBeLessThanOrEqual(0.56);
  });

  it("places new text boxes where they don't overlap existing ones", () => {
    const size = { width: 0.36, height: 0.1 };
    const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < size.width && Math.abs(a.y - b.y) < size.height;
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < 6; i += 1) {
      const next = nextTextBoxPosition(placed, size);
      expect(placed.some((box) => overlaps(box, next))).toBe(false);
      expect(next.x + size.width).toBeLessThanOrEqual(1);
      expect(next.y + size.height).toBeLessThanOrEqual(1);
      placed.push({ ...next, ...size });
    }
    expect(placed[0].x).toBeCloseTo(0.32);
    expect(placed[0].y).toBeCloseTo(0.12);
  });

  it("avoids a wide box an older layout left at the top", () => {
    const size = { width: 0.36, height: 0.1 };
    const old = { x: 0.05, y: 0.1, width: 0.9, height: 0.15 };
    const next = nextTextBoxPosition([old], size);
    expect(next.y).toBeGreaterThanOrEqual(old.y + old.height);
  });

  it("still returns an on-page spot when the page is full", () => {
    const size = { width: 0.36, height: 0.1 };
    const next = nextTextBoxPosition([{ x: 0, y: 0, width: 1, height: 1 }], size);
    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.y + size.height).toBeLessThanOrEqual(1);
  });
});
