import { z } from "zod";
import type { TemplateDefinition, TemplatePack } from "../layout/templateTypes";
import { layoutPackSources } from "./generated";

const unit = z.number().min(0).max(1);

// Mirrors the manifest.json written for each pack in library/layouts.
export const LayoutManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  order: z.number().optional(),
  templates: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        photoCount: z.number().int().min(1),
        baseScore: z.number(),
        retired: z.boolean().optional(),
        slots: z
          .array(
            z.object({
              id: z.string().min(1),
              role: z.enum(["hero", "photo"]),
              fitMode: z.enum(["contain", "cover"]),
              priority: z.number(),
              preferredOrientation: z.enum(["portrait", "landscape", "square", "any"]),
              frame: z.object({ x: unit, y: unit, width: unit, height: unit })
            })
          )
          .min(1)
      })
    )
    .min(1)
});

export function buildLayoutPacks(generated: unknown[]): TemplatePack[] {
  return generated.map((entry) => {
    const manifest = LayoutManifestSchema.parse(entry);
    const templates: TemplateDefinition[] = manifest.templates.map(({ retired, ...template }) => ({
      ...template,
      ...(retired ? { retired } : {})
    }));
    return { id: manifest.id, label: manifest.label, templates };
  });
}

// Every layout pack in library order. Retired templates are included so saved
// pages keep resolving them; templates.ts hides them from pickers.
export const layoutPacks: TemplatePack[] = buildLayoutPacks(layoutPackSources);
