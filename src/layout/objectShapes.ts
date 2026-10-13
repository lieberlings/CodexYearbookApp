import { shapeRegistry } from "../library/shapes";

// Shapes come from library/shapes/<pack>/manifest.json (see library/README.md).
// Paths use a normalized 100 x 100 canvas. textBounds describes the safe text area inside each shape.
// Retire shapes with "retired": true in the manifest (enabled: false here); keep their IDs/paths for saved books.
export type ShapeDefinition = {
  id: string;
  label: string;
  path: string;
  textBounds: { x: number; y: number; width: number; height: number };
  enabled: boolean;
};

export { shapeRegistry };

export type ObjectShape = (typeof shapeRegistry)[number]["id"];

export function getShapeDefinition(id: unknown): (typeof shapeRegistry)[number] {
  return shapeRegistry.find(shape => shape.id === id) ?? shapeRegistry.find(shape => shape.id === "rectangle")!;
}

export function resolveShapeId(id: unknown): ObjectShape {
  return getShapeDefinition(id).id;
}

export function selectableShapes<T extends ShapeDefinition>(registry: readonly T[]): T[] {
  return registry.filter(shape => shape.enabled);
}

export const objectShapes = selectableShapes(shapeRegistry).map(shape => shape.id);

export function shapePath(id: unknown): string {
  return getShapeDefinition(id).path;
}
