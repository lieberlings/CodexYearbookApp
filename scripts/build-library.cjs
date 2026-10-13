/* global __dirname */
// Scans library/ for design packs and writes src/library/generated.ts.
// Metro needs every asset require() spelled out at build time, so packs are
// discovered here instead of being listed by hand.
//
//   node scripts/build-library.cjs          regenerate
//   node scripts/build-library.cjs --check  exit 1 if the generated file is stale or a pack is invalid

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const libraryDir = path.join(root, "library");
const outputFile = path.join(root, "src", "library", "generated.ts");
const backgroundKinds = ["solid", "gradient", "pattern", "illustration", "photo-texture"];
const slotRoles = ["hero", "photo"];
const slotFitModes = ["contain", "cover"];
const slotOrientations = ["portrait", "landscape", "square", "any"];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isUnit(value) {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function isUnitRect(rect) {
  return Boolean(rect) && [rect.x, rect.y, rect.width, rect.height].every(isUnit);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Reads and checks the parts every pack manifest shares: id, label, order and
// a non-empty item list under `listKey`.
function readManifest(kind, packDir, listKey, errors) {
  const folder = path.basename(packDir);
  const manifestPath = path.join(packDir, "manifest.json");
  const where = `library/${kind}/${folder}`;
  if (!fs.existsSync(manifestPath)) {
    errors.push(`${where}: missing manifest.json`);
    return undefined;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`${where}/manifest.json: invalid JSON (${error.message})`);
    return undefined;
  }
  if (manifest.id !== folder) errors.push(`${where}: manifest id "${manifest.id}" must match the folder name`);
  if (typeof manifest.label !== "string" || !manifest.label) errors.push(`${where}: label is required`);
  if (manifest.order !== undefined && typeof manifest.order !== "number") errors.push(`${where}: order must be a number`);
  if (!Array.isArray(manifest[listKey]) || manifest[listKey].length === 0) {
    errors.push(`${where}: ${listKey} must be a non-empty array`);
    return undefined;
  }
  return { folder, manifest, where };
}

// Runs `validateItem` on each entry of the manifest's item list and keeps the objects.
function readItems(pack, listKey, errors, validateItem) {
  const items = [];
  for (const [index, item] of pack.manifest[listKey].entries()) {
    const at = `${pack.where} ${listKey}[${index}]${item && item.id ? ` (${item.id})` : ""}`;
    if (!item || typeof item !== "object") {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (typeof item.id !== "string" || !idPattern.test(item.id)) errors.push(`${at}: id must be lowercase-kebab-case`);
    if (typeof item.label !== "string" || !item.label) errors.push(`${at}: label is required`);
    if (item.retired !== undefined && typeof item.retired !== "boolean") errors.push(`${at}: retired must be true or false`);
    validateItem(item, at);
    items.push(item);
  }
  return items;
}

function readBackgroundPack(packDir, errors) {
  const pack = readManifest("backgrounds", packDir, "backgrounds", errors);
  if (!pack) return undefined;
  const items = readItems(pack, "backgrounds", errors, (item, at) => {
    if (!backgroundKinds.includes(item.kind)) errors.push(`${at}: kind must be one of ${backgroundKinds.join(", ")}`);
    if (typeof item.backgroundColor !== "string") errors.push(`${at}: backgroundColor is required`);
    if (typeof item.textColor !== "string") errors.push(`${at}: textColor is required`);
    if (!isStringArray(item.palette)) errors.push(`${at}: palette must be a list of colors`);
    if (!isStringArray(item.tags)) errors.push(`${at}: tags must be a list of strings`);
    if (!isUnitRect(item.safeArea)) {
      errors.push(`${at}: safeArea needs x, y, width, height between 0 and 1`);
    }
    if (item.asset !== undefined) {
      const assetPath = path.join(packDir, item.asset);
      if (typeof item.asset !== "string" || !fs.existsSync(assetPath)) {
        errors.push(`${at}: asset file "${item.asset}" not found`);
      } else if (!assetPath.startsWith(packDir + path.sep)) {
        errors.push(`${at}: asset must be inside the pack folder`);
      }
    }
  });
  return { ...pack, items };
}

function readLayoutPack(packDir, errors) {
  const pack = readManifest("layouts", packDir, "templates", errors);
  if (!pack) return undefined;
  const items = readItems(pack, "templates", errors, (item, at) => {
    if (typeof item.baseScore !== "number") errors.push(`${at}: baseScore must be a number`);
    if (!Array.isArray(item.slots) || item.slots.length === 0) {
      errors.push(`${at}: slots must be a non-empty array`);
      return;
    }
    if (item.photoCount !== item.slots.length) {
      errors.push(`${at}: photoCount ${item.photoCount} must match the ${item.slots.length} slots`);
    }
    const slotIds = new Set();
    for (const [index, slot] of item.slots.entries()) {
      const slotAt = `${at} slots[${index}]${slot && slot.id ? ` (${slot.id})` : ""}`;
      if (!slot || typeof slot !== "object") {
        errors.push(`${slotAt}: must be an object`);
        continue;
      }
      if (typeof slot.id !== "string" || !slot.id) errors.push(`${slotAt}: id is required`);
      else if (slotIds.has(slot.id)) errors.push(`${slotAt}: duplicate slot id`);
      slotIds.add(slot.id);
      if (!slotRoles.includes(slot.role)) errors.push(`${slotAt}: role must be one of ${slotRoles.join(", ")}`);
      if (!slotFitModes.includes(slot.fitMode)) errors.push(`${slotAt}: fitMode must be one of ${slotFitModes.join(", ")}`);
      if (typeof slot.priority !== "number") errors.push(`${slotAt}: priority must be a number`);
      if (!slotOrientations.includes(slot.preferredOrientation)) {
        errors.push(`${slotAt}: preferredOrientation must be one of ${slotOrientations.join(", ")}`);
      }
      if (!isUnitRect(slot.frame)) errors.push(`${slotAt}: frame needs x, y, width, height between 0 and 1`);
    }
  });
  return { ...pack, items };
}

function readShapePack(packDir, errors) {
  const pack = readManifest("shapes", packDir, "shapes", errors);
  if (!pack) return undefined;
  const items = readItems(pack, "shapes", errors, (item, at) => {
    if (typeof item.path !== "string" || !item.path.trim()) errors.push(`${at}: path must be a non-empty string`);
    if (!isUnitRect(item.textBounds)) errors.push(`${at}: textBounds needs x, y, width, height between 0 and 1`);
  });
  return { ...pack, items };
}

// Reads every pack folder of one kind, checks ids are unique across packs and
// sorts the packs into library order.
function collectPacks(kind, itemName, readPack, errors) {
  const dir = path.join(libraryDir, kind);
  if (!fs.existsSync(dir)) return [];
  const packs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .map((entry) => readPack(path.join(dir, entry.name), errors))
    .filter(Boolean);

  const seen = new Map();
  for (const pack of packs) {
    for (const item of pack.items) {
      if (seen.has(item.id)) errors.push(`duplicate ${itemName} id "${item.id}" in ${seen.get(item.id)} and ${pack.folder}`);
      seen.set(item.id, pack.folder);
    }
  }
  // Packs with an explicit order come first; the rest follow alphabetically.
  return packs.sort((a, b) => {
    const orderA = a.manifest.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.manifest.order ?? Number.POSITIVE_INFINITY;
    return orderA - orderB || a.folder.localeCompare(b.folder);
  });
}

function renderManifestList(name, kind, packs) {
  if (packs.length === 0) return [`export const ${name}: unknown[] = [];`];
  return [
    `export const ${name}: unknown[] = [`,
    ...packs.map((pack, index) => {
      const comma = index < packs.length - 1 ? "," : "";
      return `  require("../../library/${kind}/${pack.folder}/manifest.json")${comma}`;
    }),
    "];"
  ];
}

function render(backgroundPacks, layoutPacks, shapePacks) {
  const lines = [
    "// Generated by scripts/build-library.cjs from the library/ folder. Do not edit.",
    "// Add or change packs in library/ and run `npm run library`.",
    "",
    "export type GeneratedPack = {",
    "  manifest: unknown;",
    "  sources: Record<string, number>;",
    "};",
    "",
    "export const backgroundPackSources: GeneratedPack[] = ["
  ];
  for (const pack of backgroundPacks) {
    const base = `../../library/backgrounds/${pack.folder}`;
    lines.push("  {");
    lines.push(`    manifest: require("${base}/manifest.json"),`);
    const withAssets = pack.items.filter((item) => typeof item.asset === "string");
    if (withAssets.length === 0) {
      lines.push("    sources: {}");
    } else {
      lines.push("    sources: {");
      withAssets.forEach((item, index) => {
        const asset = item.asset.replace(/\\/g, "/").replace(/^\.\//, "");
        const comma = index < withAssets.length - 1 ? "," : "";
        lines.push(`      "${item.id}": require("${base}/${asset}")${comma}`);
      });
      lines.push("    }");
    }
    lines.push(`  }${pack === backgroundPacks[backgroundPacks.length - 1] ? "" : ","}`);
  }
  lines.push("];", "");
  lines.push(...renderManifestList("layoutPackSources", "layouts", layoutPacks), "");
  lines.push(...renderManifestList("shapePackSources", "shapes", shapePacks), "");
  // Spelled out so the ObjectShape type stays a literal union of shape ids.
  const shapeIds = shapePacks.flatMap((pack) => pack.items.map((item) => `"${item.id}"`));
  lines.push(`export const shapeIds = [${shapeIds.join(", ")}] as const;`, "");
  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const errors = [];
  const backgroundPacks = collectPacks("backgrounds", "background", readBackgroundPack, errors);
  const layoutPacks = collectPacks("layouts", "layout", readLayoutPack, errors);
  const shapePacks = collectPacks("shapes", "shape", readShapePack, errors);
  if (shapePacks.length > 0 && !shapePacks.some((pack) => pack.items.some((item) => item.id === "rectangle"))) {
    errors.push(`library/shapes: a "rectangle" shape is required; unknown saved shapes fall back to it`);
  }
  if (errors.length) {
    console.error(`Design library has ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
    process.exit(1);
  }
  const output = render(backgroundPacks, layoutPacks, shapePacks);
  const current = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8").replace(/\r\n/g, "\n") : "";
  if (check) {
    if (current !== output) {
      console.error("src/library/generated.ts is out of date. Run `npm run library`.");
      process.exit(1);
    }
    return;
  }
  if (current !== output) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output);
  }
  const count = (packs) => packs.reduce((sum, pack) => sum + pack.items.length, 0);
  console.log(
    `Design library: ${backgroundPacks.length} background packs, ${count(backgroundPacks)} backgrounds; ` +
      `${layoutPacks.length} layout packs, ${count(layoutPacks)} layouts; ` +
      `${shapePacks.length} shape packs, ${count(shapePacks)} shapes.`
  );
}

main();
