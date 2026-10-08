// Paths use a normalized 100 x 100 canvas. textBounds describes the safe text area inside each shape.
// Retire shapes with enabled: false; keep their IDs/paths for saved books.
export type ShapeDefinition = {
  id: string;
  label: string;
  path: string;
  textBounds: { x: number; y: number; width: number; height: number };
  enabled: boolean;
};

export const shapeRegistry = [
  { id: "rectangle", label: "rectangle", path: "M1 1 H99 V99 H1 Z", textBounds: { x: 0, y: 0, width: 1, height: 1 }, enabled: true },
  { id: "circle", label: "circle", path: "M50 2 A48 48 0 1 1 49.99 2 Z", textBounds: { x: .19, y: .19, width: .62, height: .62 }, enabled: true },
  { id: "heart", label: "heart", path: "M50 95 C38 83 3 59 3 30 C3 1 37 -5 50 22 C63 -5 97 1 97 30 C97 59 62 83 50 95 Z", textBounds: { x: .25, y: .30, width: .50, height: .35 }, enabled: true },
  { id: "star", label: "star", path: "M50 2 L62 35 L97 36 L70 57 L80 94 L50 73 L20 94 L30 57 L3 36 L38 35 Z", textBounds: { x: .36, y: .38, width: .28, height: .27 }, enabled: true },
  { id: "thought", label: "thought", path: "M20 75 C-5 75 -5 45 10 40 C-5 12 24 -2 38 12 C55 -8 80 2 80 17 C106 9 105 45 91 48 C107 71 77 90 64 76 C51 92 25 91 20 75 Z M20 84 A5 5 0 1 1 19.99 84 Z M8 94 A3 3 0 1 1 7.99 94 Z", textBounds: { x: .20, y: .25, width: .60, height: .40 }, enabled: true }
] as const satisfies readonly ShapeDefinition[];

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
