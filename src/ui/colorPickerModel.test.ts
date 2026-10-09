import {
  buildColorSections,
  MAX_RECENT_COLORS,
  normalizeColor,
  pushRecentColor,
  QUICK_COLOR_COUNT,
  quickColors,
  sameColor,
  STANDARD_COLORS
} from "./colorPickerModel";

describe("colorPickerModel", () => {
  it("normalizes case and short hex", () => {
    expect(normalizeColor("#abc")).toBe("#AABBCC");
    expect(normalizeColor(" #6b5bd2 ")).toBe("#6B5BD2");
    expect(normalizeColor(undefined)).toBeUndefined();
    expect(sameColor("#fff", "#FFFFFF")).toBe(true);
    expect(sameColor(undefined, undefined)).toBe(false);
  });

  it("has no duplicate standard colors", () => {
    expect(new Set(STANDARD_COLORS.map((color) => normalizeColor(color))).size).toBe(STANDARD_COLORS.length);
  });

  it("puts theme colors first, then recent, then standard, and drops empty sections", () => {
    expect(buildColorSections([], []).map((section) => section.id)).toEqual(["standard"]);
    const sections = buildColorSections(["#9fb8b6", "#9FB8B6"], ["#123456"]);
    expect(sections.map((section) => section.id)).toEqual(["theme", "recent", "standard"]);
    expect(sections[0].colors).toEqual(["#9FB8B6"]);
  });

  it("builds a short quick row without the current value", () => {
    const quick = quickColors("#9FB8B6", ["#9fb8b6", "#7A2E3A"], ["#123456"]);
    expect(quick).toHaveLength(QUICK_COLOR_COUNT);
    expect(quick.slice(0, 2)).toEqual(["#7A2E3A", "#123456"]);
    expect(quick).not.toContain("#9FB8B6");
  });

  it("keeps recent colors unique, newest first, and capped", () => {
    let recent: string[] = [];
    for (const color of STANDARD_COLORS.slice(0, MAX_RECENT_COLORS + 2)) recent = pushRecentColor(recent, color);
    expect(recent).toHaveLength(MAX_RECENT_COLORS);
    expect(pushRecentColor(recent, recent[3].toLowerCase())[0]).toBe(recent[3]);
    expect(pushRecentColor(["#111111", "#222222"], "#222222")).toEqual(["#222222", "#111111"]);
  });
});
