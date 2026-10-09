import { z } from "zod";
import type { BackgroundAsset, BackgroundPack } from "../layout/backgroundTypes";
import { backgroundPackSources, type GeneratedPack } from "./generated";

const unit = z.number().min(0).max(1);

// Mirrors the manifest.json written for each pack in library/backgrounds.
// Unknown fields (art direction notes, asset sizes) are allowed and ignored.
export const BackgroundManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  order: z.number().optional(),
  backgrounds: z
    .array(
      z.object({
        number: z.number(),
        id: z.string().min(1),
        label: z.string().min(1),
        theme: z.string(),
        kind: z.enum(["solid", "gradient", "pattern", "illustration", "photo-texture"]),
        backgroundColor: z.string(),
        asset: z.string().optional(),
        palette: z.array(z.string()),
        tags: z.array(z.string()),
        textColor: z.string(),
        slotBorderColor: z.string().optional(),
        retired: z.boolean().optional(),
        safeArea: z.object({ x: unit, y: unit, width: unit, height: unit })
      })
    )
    .min(1)
});

export type BackgroundLibrary = {
  packs: BackgroundPack[];
  sources: Map<string, number>;
  selections: Map<string, { packId: string; packLabel: string; asset: BackgroundAsset }>;
};

export function buildBackgroundLibrary(generated: GeneratedPack[]): BackgroundLibrary {
  const packs: BackgroundPack[] = [];
  const sources = new Map<string, number>();
  const selections = new Map<string, { packId: string; packLabel: string; asset: BackgroundAsset }>();
  for (const entry of generated) {
    const manifest = BackgroundManifestSchema.parse(entry.manifest);
    const backgrounds = manifest.backgrounds.map(({ asset, retired, ...item }) => ({
      ...item,
      ...(asset ? { assetUri: asset } : {}),
      ...(retired ? { retired } : {})
    }));
    for (const asset of backgrounds) {
      // Retired backgrounds stay resolvable so saved pages keep rendering.
      selections.set(asset.id, { packId: manifest.id, packLabel: manifest.label, asset });
      const source = entry.sources[asset.id];
      if (source !== undefined) {
        sources.set(asset.id, source);
      }
    }
    const visible = backgrounds.filter((asset) => !asset.retired);
    if (visible.length) {
      packs.push({ id: manifest.id, label: manifest.label, backgrounds: visible });
    }
  }
  return { packs, sources, selections };
}

export const backgroundLibrary = buildBackgroundLibrary(backgroundPackSources);

// Packs and backgrounds offered in pickers, in library order.
export const backgroundPacks: BackgroundPack[] = backgroundLibrary.packs;
