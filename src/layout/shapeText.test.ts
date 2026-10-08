import { getShapeTextLayout } from "./shapeText";
import { shapeRegistry } from "./objectShapes";

it("fits long and multiline text inside each shape's interior without changing the text", () => {
  const text = "Our family holiday\nA very long memory with many wonderful moments";
  for (const shape of shapeRegistry.filter(shape => shape.id !== "rectangle")) {
    const layout = getShapeTextLayout(shape.id, text, 160, 100, 26, 2)!;
    const short = getShapeTextLayout(shape.id, "Hi", 160, 100, 26, 2)!;
    expect(layout.fontSize).toBeLessThan(short.fontSize);
    expect(layout.fontSize).toBeGreaterThan(0);
    expect(layout.left).toBeGreaterThanOrEqual(shape.textBounds.x * 160);
    expect(layout.top).toBeGreaterThanOrEqual(shape.textBounds.y * 100);
    expect(layout.left + layout.width).toBeLessThanOrEqual((shape.textBounds.x + shape.textBounds.width) * 160);
    expect(layout.top + layout.height).toBeLessThanOrEqual((shape.textBounds.y + shape.textBounds.height) * 100);
    expect(layout.numberOfLines * layout.lineHeight).toBeLessThanOrEqual(layout.height);
  }
});

it("grows fitted type as a shaped text box grows, without exceeding the chosen font size", () => {
  const small = getShapeTextLayout("heart", "Happy birthday", 80, 60, 26)!;
  const large = getShapeTextLayout("heart", "Happy birthday", 300, 300, 26)!;
  expect(large.fontSize).toBeGreaterThan(small.fontSize);
  expect(large.fontSize).toBeLessThanOrEqual(26);
});

it("fits unbroken words and emoji and leaves ordinary rectangular text unchanged", () => {
  for (const text of ["averylongwordwithoutspaces".repeat(10), "😊🌸💛🎉", ""]) {
    const layout = getShapeTextLayout("star", text, 100, 100, 24)!;
    expect(Number.isFinite(layout.fontSize)).toBe(true);
    expect(layout.fontSize).toBeGreaterThan(0);
  }
  expect(getShapeTextLayout("rectangle", "Keep normal text", 100, 100, 24)).toBeUndefined();
});
