import { z } from "zod";
import type { ShapeDefinition } from "../layout/objectShapes";
import { shapeIds, shapePackSources } from "./generated";

const unit = z.number().min(0).max(1);

// Mirrors the manifest.json written for each pack in library/shapes.
export const ShapeManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  order: z.number().optional(),
  shapes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        path: z.string().refine((value) => value.trim().length > 0, "path must be a non-empty string"),
        textBounds: z.object({ x: unit, y: unit, width: unit, height: unit }),
        retired: z.boolean().optional()
      })
    )
    .min(1)
});

export type LibraryShapeId = (typeof shapeIds)[number];

// Flattens shape packs into one registry. Retired shapes stay in it with
// enabled: false so saved books keep rendering them.
export function buildShapeRegistry(generated: unknown[]): ShapeDefinition[] {
  return generated.flatMap((entry) =>
    ShapeManifestSchema.parse(entry).shapes.map(({ retired, ...shape }) => ({ ...shape, enabled: !retired }))
  );
}

export const shapeRegistry = buildShapeRegistry(shapePackSources) as (ShapeDefinition & { id: LibraryShapeId })[];
