import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backgroundLibrary, backgroundPacks, buildBackgroundLibrary } from "./backgrounds";

const manifest = (overrides: Record<string, unknown> = {}) => ({
  id: "test-pack",
  label: "Test Pack",
  backgrounds: [
    {
      number: 1,
      id: "test-pack-01",
      label: "One",
      theme: "test",
      kind: "solid",
      backgroundColor: "#FFFFFF",
      asset: "assets/test-pack-01.svg",
      palette: ["#FFFFFF"],
      tags: ["test"],
      textColor: "#000000",
      safeArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
    }
  ],
  ...overrides
});

describe("background library", () => {
  it("loads every bundled pack in library order", () => {
    expect(backgroundPacks.map((pack) => pack.id)).toEqual([
      "summer-vacation",
      "winter-get-away",
      "everyday-clean",
      "birthday-party",
      "baby-toddler",
      "spring-day",
      "school-days",
      "fall-cozy"
    ]);
    const ids = backgroundPacks.flatMap((pack) => pack.backgrounds.map((asset) => asset.id));
    expect(ids).toHaveLength(64);
    expect(new Set(ids).size).toBe(64);
    for (const id of ids) {
      expect(backgroundLibrary.sources.has(id)).toBe(true);
    }
  });

  it("keeps the assetUri field the rest of the app reads", () => {
    const fallCozy = backgroundLibrary.selections.get("fall-cozy-01");
    expect(fallCozy?.packId).toBe("fall-cozy");
    expect(fallCozy?.asset.assetUri).toBe("assets/fall-cozy-01.svg");
  });

  it("hides retired backgrounds from pickers but still resolves them for saved pages", () => {
    const retired = manifest();
    (retired.backgrounds[0] as Record<string, unknown>).retired = true;
    const library = buildBackgroundLibrary([{ manifest: retired, sources: { "test-pack-01": 7 } }]);
    expect(library.packs).toEqual([]);
    expect(library.selections.get("test-pack-01")?.asset.label).toBe("One");
    expect(library.sources.get("test-pack-01")).toBe(7);
  });

  it("rejects an invalid manifest", () => {
    expect(() => buildBackgroundLibrary([{ manifest: manifest({ backgrounds: [] }), sources: {} }])).toThrow();
  });
});

describe("build-library script", () => {
  const script = path.resolve(__dirname, "../../scripts/build-library.cjs");

  it("reports the committed generated file as up to date", () => {
    expect(() => execFileSync(process.execPath, [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("names the broken pack and field when a manifest is invalid", () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "library-"));
    try {
      fs.mkdirSync(path.join(sandbox, "scripts"));
      fs.copyFileSync(script, path.join(sandbox, "scripts", "build-library.cjs"));
      const packDir = path.join(sandbox, "library", "backgrounds", "test-pack");
      fs.mkdirSync(packDir, { recursive: true });
      fs.writeFileSync(path.join(packDir, "manifest.json"), JSON.stringify(manifest()));
      let message = "";
      try {
        execFileSync(process.execPath, [path.join(sandbox, "scripts", "build-library.cjs")], { stdio: "pipe" });
      } catch (error) {
        message = String((error as { stderr?: Buffer }).stderr);
      }
      expect(message).toContain('test-pack-01): asset file "assets/test-pack-01.svg" not found');
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("picks up a new pack folder without any code changes", () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "library-"));
    try {
      fs.mkdirSync(path.join(sandbox, "scripts"));
      fs.copyFileSync(script, path.join(sandbox, "scripts", "build-library.cjs"));
      const packDir = path.join(sandbox, "library", "backgrounds", "test-pack");
      fs.mkdirSync(path.join(packDir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(packDir, "assets", "test-pack-01.svg"), "<svg/>");
      fs.writeFileSync(path.join(packDir, "manifest.json"), JSON.stringify(manifest()));
      execFileSync(process.execPath, [path.join(sandbox, "scripts", "build-library.cjs")], { stdio: "pipe" });
      const generated = fs.readFileSync(path.join(sandbox, "src", "library", "generated.ts"), "utf8");
      expect(generated).toContain('require("../../library/backgrounds/test-pack/manifest.json")');
      expect(generated).toContain('"test-pack-01": require("../../library/backgrounds/test-pack/assets/test-pack-01.svg")');
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
