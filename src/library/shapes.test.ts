import { getShapeDefinition, objectShapes, resolveShapeId, shapePath } from "../layout/objectShapes";
import { runBuildLibraryWith } from "../test/librarySandbox";
import { shapeIds } from "./generated";
import { buildShapeRegistry, shapeRegistry } from "./shapes";

const shape = (overrides: Record<string, unknown> = {}) => ({
  id: "rectangle",
  label: "rectangle",
  path: "M1 1 H99 V99 H1 Z",
  textBounds: { x: 0, y: 0, width: 1, height: 1 },
  ...overrides
});

describe("shape library", () => {
  it("keeps the shipped shapes, in order, with ids the type system knows", () => {
    expect(shapeRegistry.map((item) => item.id)).toEqual(["rectangle", "circle", "heart", "star", "thought"]);
    expect([...shapeIds]).toEqual(shapeRegistry.map((item) => item.id));
    expect(objectShapes).toEqual(["rectangle", "circle", "heart", "star", "thought"]);
    expect(getShapeDefinition("circle")).toEqual({
      id: "circle",
      label: "circle",
      path: "M50 2 A48 48 0 1 1 49.99 2 Z",
      textBounds: { x: 0.19, y: 0.19, width: 0.62, height: 0.62 },
      enabled: true
    });
  });

  it("derives enabled from retired", () => {
    const registry = buildShapeRegistry([
      { id: "test-shapes", label: "Test", shapes: [shape(), shape({ id: "old", retired: true })] }
    ]);
    expect(registry.map((item) => [item.id, item.enabled])).toEqual([
      ["rectangle", true],
      ["old", false]
    ]);
  });

  it("falls back to the rectangle for unknown or missing ids", () => {
    for (const id of ["no-such-shape", undefined, 42]) {
      expect(resolveShapeId(id)).toBe("rectangle");
      expect(shapePath(id)).toBe("M1 1 H99 V99 H1 Z");
    }
  });
});

describe("build-library script for shapes", () => {
  it("names the pack, shape and problem for a broken shape", () => {
    const message = runBuildLibraryWith({
      "shapes/test-shapes/manifest.json": {
        id: "test-shapes",
        label: "Test",
        shapes: [shape(), shape({ id: "blob", path: " ", textBounds: { x: -0.1, y: 0, width: 1, height: 1 } })]
      }
    });
    expect(message).toContain("library/shapes/test-shapes shapes[1] (blob): path must be a non-empty string");
    expect(message).toContain("library/shapes/test-shapes shapes[1] (blob): textBounds needs x, y, width, height between 0 and 1");
  });

  it("requires a rectangle shape for the fallback", () => {
    const message = runBuildLibraryWith({
      "shapes/test-shapes/manifest.json": { id: "test-shapes", label: "Test", shapes: [shape({ id: "circle" })] }
    });
    expect(message).toContain('a "rectangle" shape is required');
  });

  it("accepts a valid pack", () => {
    expect(runBuildLibraryWith({ "shapes/test-shapes/manifest.json": { id: "test-shapes", label: "Test", shapes: [shape()] } })).toBe("");
  });
});
