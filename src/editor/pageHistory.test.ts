import { PageHistory, recordSnapshot, travelSnapshot } from "./pageHistory";

it("restores a deleted page with its photos and crop settings, and can redo deletion", () => {
  const page = { sections: [{ id: "page", textBoxes: [{ text: "Hello" }] }], photos: [{ id: "photo", uri: "file://image.jpg" }], overrides: { page: { slot: { photoScale: 1.5 } } } };
  const before = JSON.stringify(page);
  const after = JSON.stringify({ sections: [], photos: [], overrides: {} });
  const h: PageHistory = { key: "memory", past: [], present: before, future: [] };
  recordSnapshot(h, after);
  page.sections[0].textBoxes[0].text = "Changed later";
  const restored = JSON.parse(travelSnapshot(h, false)!);
  expect(restored.sections[0].textBoxes[0].text).toBe("Hello");
  expect(restored.photos[0].uri).toBe("file://image.jpg");
  expect(restored.overrides.page.slot.photoScale).toBe(1.5);
  expect(travelSnapshot(h, true)).toBe(after);
});

it("does not record no-op taps and discards redo after a new edit", () => {
  const h: PageHistory = { key: "memory", past: [], present: "initial", future: [] };
  expect(recordSnapshot(h, "initial")).toBe(false);
  recordSnapshot(h, "drag completed");
  recordSnapshot(h, "rotation completed");
  expect(travelSnapshot(h, false)).toBe("drag completed");
  recordSnapshot(h, "new text");
  expect(travelSnapshot(h, true)).toBeUndefined();
  expect(travelSnapshot(h, false)).toBe("drag completed");
  expect(travelSnapshot(h, false)).toBe("initial");
});
