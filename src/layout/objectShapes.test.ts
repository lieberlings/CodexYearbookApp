import { getShapeDefinition, resolveShapeId, selectableShapes, shapePath, shapeRegistry, ShapeDefinition } from "./objectShapes";
import { ObjectShapeSchema, PageTextBoxSchema } from "./schemas";

it("derives validation and rendering from every registered shape", () => {
  expect(new Set(shapeRegistry.map(shape => shape.id)).size).toBe(shapeRegistry.length);
  for (const shape of shapeRegistry) {
    expect(ObjectShapeSchema.parse(shape.id)).toBe(shape.id);
    expect(shapePath(shape.id)).toBe(shape.path);
    expect(shape.label).not.toBe("");
    expect(shape.textBounds.width).toBeGreaterThan(0);
    expect(shape.textBounds.height).toBeGreaterThan(0);
  }
});

it("hides retired shapes from selection while preserving saved rendering and validation", () => {
  const circle = getShapeDefinition("circle") as ShapeDefinition;
  const enabled = circle.enabled;
  try {
    circle.enabled = false;
    expect(selectableShapes(shapeRegistry).some(shape => shape.id === "circle")).toBe(false);
    expect(ObjectShapeSchema.parse("circle")).toBe("circle");
    expect(shapePath("circle")).toBe(circle.path);
  } finally {
    circle.enabled = enabled;
  }
});

it("falls back to a rectangle for unknown saved IDs without losing the text box", () => {
  expect(resolveShapeId("unknown-shape")).toBe("rectangle");
  expect(shapePath("unknown-shape")).toBe(shapePath("rectangle"));
  const box = PageTextBoxSchema.parse({ id: "text", text: "Keep me", x: .1, y: .1, width: .3, height: .2, shape: "unknown-shape" });
  expect(box).toMatchObject({ text: "Keep me", shape: "rectangle" });
  expect(PageTextBoxSchema.parse({ ...box, shape: undefined }).shape).toBeUndefined();
});
