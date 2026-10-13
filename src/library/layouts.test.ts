import { createHash } from "node:crypto";
import { runBuildLibraryWith } from "../test/librarySandbox";
import { buildLayoutPacks, layoutPacks } from "./layouts";

// templates.ts reads React Native's __DEV__ flag when it loads.
Object.assign(globalThis, { __DEV__: false });

const template = (overrides: Record<string, unknown> = {}) => ({
  id: "test-layouts-01",
  label: "One",
  photoCount: 1,
  baseScore: 24,
  slots: [
    {
      id: "slot-1",
      role: "hero",
      fitMode: "cover",
      priority: 1,
      preferredOrientation: "square",
      frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
    }
  ],
  ...overrides
});

// Same JSON with object keys sorted, so the fingerprint ignores key order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

// Fingerprint of figmaBatchTemplatePack from the deleted
// src/layout/templatePacks/figmaBatchTemplates.ts, taken when the pack was
// converted to library/layouts/figma-batch (the conversion commit
// deep-compared the two directly). Saved pages reference these templates.
const figmaBatchFingerprint = "6aba488f9af32d08aed8e6910899f10bd5b36b6780df7df8029eb539cd98a35d";

const manifest = (templates = [template()]) => ({ id: "test-layouts", label: "Test Layouts", templates });

describe("layout library", () => {
  it("matches the figma-batch pack it was converted from", () => {
    expect(layoutPacks.map((pack) => pack.id)).toEqual(["figma-batch"]);
    const [pack] = layoutPacks;
    expect(pack.templates.map((item) => item.id)).toEqual(
      Array.from({ length: 36 }, (_, index) => `figma-batch-${String(index + 1).padStart(2, "0")}`)
    );
    expect(createHash("sha256").update(JSON.stringify(canonical(pack))).digest("hex")).toBe(figmaBatchFingerprint);
  });

  it("serves every library template through templates.ts", () => {
    const { listAllTemplates } = jest.requireActual<typeof import("../layout/templates")>("../layout/templates");
    expect(listAllTemplates()).toEqual(layoutPacks.flatMap((pack) => pack.templates));
  });

  it("hides retired layouts from pickers but still resolves them for saved pages", () => {
    const packs = buildLayoutPacks([manifest([template(), template({ id: "test-layouts-02", retired: true })])]);
    expect(packs[0].templates[1].retired).toBe(true);
    jest.isolateModules(() => {
      jest.doMock("./layouts", () => ({ layoutPacks: packs }));
      const templates = jest.requireActual<typeof import("../layout/templates")>("../layout/templates");
      expect(templates.listAllTemplates().map((item) => item.id)).toEqual(["test-layouts-01"]);
      expect(templates.listTemplatesForPhotoCount(1).map((item) => item.id)).toEqual(["test-layouts-01"]);
      expect(templates.getTemplateById("test-layouts-02")?.label).toBe("One");
    });
  });

  it("rejects an invalid manifest", () => {
    expect(() => buildLayoutPacks([manifest([])])).toThrow();
  });
});

describe("build-library script for layouts", () => {
  it("names the pack, layout and problem for a broken layout", () => {
    const broken = template({
      photoCount: 2,
      slots: [{ ...template().slots[0], frame: { x: 0.1, y: 0.1, width: 1.4, height: 0.8 } }]
    });
    const message = runBuildLibraryWith({ "layouts/test-layouts/manifest.json": manifest([broken]) });
    expect(message).toContain("library/layouts/test-layouts templates[0] (test-layouts-01): photoCount 2 must match the 1 slots");
    expect(message).toContain("(test-layouts-01) slots[0] (slot-1): frame needs x, y, width, height between 0 and 1");
  });

  it("requires the pack id to match its folder and layout ids to be unique across packs", () => {
    const message = runBuildLibraryWith({
      "layouts/test-layouts/manifest.json": manifest(),
      "layouts/other-layouts/manifest.json": { ...manifest(), id: "wrong-id" }
    });
    expect(message).toContain('library/layouts/other-layouts: manifest id "wrong-id" must match the folder name');
    expect(message).toContain('duplicate layout id "test-layouts-01"');
  });
});
