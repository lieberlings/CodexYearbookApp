import { TemplateDefinition } from "../../layout/templates";
import { MemoryPageSection } from "../../types";
import {
  applyColorOpacity,
  clamp,
  estimateTextBoxSize,
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
});
