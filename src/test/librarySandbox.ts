import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.resolve(__dirname, "../../scripts/build-library.cjs");

// Runs scripts/build-library.cjs against a temporary library/ folder holding
// only the given manifests (keyed by path under library/, e.g.
// "shapes/basic/manifest.json"). Returns the error output, or "" on success.
export function runBuildLibraryWith(manifests: Record<string, unknown>): string {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "library-"));
  try {
    fs.mkdirSync(path.join(sandbox, "scripts"));
    fs.copyFileSync(script, path.join(sandbox, "scripts", "build-library.cjs"));
    for (const [file, manifest] of Object.entries(manifests)) {
      const target = path.join(sandbox, "library", file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(manifest));
    }
    try {
      execFileSync(process.execPath, [path.join(sandbox, "scripts", "build-library.cjs")], { stdio: "pipe" });
      return "";
    } catch (error) {
      return String((error as { stderr?: Buffer }).stderr);
    }
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}
