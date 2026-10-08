import { buildBookSpreads, coverPanelRegion, spreadLabel, usesSharedCoverBackground } from "./bookSpreads";
import type { LayoutPage } from "./schemas";
import type { CoverDesign, Memory } from "../types";

const memories = [{ id: "front", bookRole: "front-cover" }, { id: "dedication", bookRole: "dedication" }, { id: "memory" }, { id: "back", bookRole: "back-cover" }] as Memory[];
const page = (id: string, memoryId = "memory") => ({ id, memoryId }) as LayoutPage;

it("opens page one on the right and pairs across memory boundaries", () => {
  const spreads = buildBookSpreads([page("f", "front"), page("d", "dedication"), page("1"), page("2"), page("3"), page("b", "back")], memories);
  expect(spreads.map(spreadLabel)).toEqual(["Front cover", "Page 1", "Pages 2–3", "Page 4", "Back cover"]);
  expect(spreads[1].left).toBeUndefined();
  expect(spreads[1].right?.id).toBe("d");
  expect(spreads[2].left?.id).toBe("1");
  expect(spreads[2].right?.id).toBe("2");
  expect(spreads[3].right).toBeUndefined();
});

it("keeps an odd final interior page on the right without inserting content", () => {
  const pages = [page("1"), page("2"), page("3")];
  const spreads = buildBookSpreads(pages, memories);
  expect(spreads.map(spreadLabel)).toEqual(["Front cover", "Page 1", "Pages 2–3", "Back cover"]);
  expect(spreads.filter(spread => spread.kind === "content").flatMap(spread => [spread.left, spread.right]).filter(Boolean)).toEqual(pages);
});

it("supports an empty project and preserves blank covers outside interior numbering", () => {
  expect(buildBookSpreads([], []).map(spreadLabel)).toEqual(["Front cover", "Back cover"]);
});

it("uses contiguous coordinates for a shared back-spine-front background", () => {
  const design: CoverDesign = { panelWidthMm: 205, spineWidthMm: 12 };
  const back = coverPanelRegion("back", design);
  const spine = coverPanelRegion("spine", design);
  const front = coverPanelRegion("front", design);
  expect(back.x + back.width).toBe(spine.x);
  expect(spine.x + spine.width).toBe(front.x);
  expect(front.x + front.width).toBe(front.total);
  expect(front.total).toBe(422);
});

it("preserves existing panel backgrounds until a shared background is chosen", () => {
  expect(usesSharedCoverBackground("front", undefined)).toBe(false);
  const design: CoverDesign = { background: { kind: "color", color: "#fff" }, panelBackgrounds: { back: true } };
  expect(usesSharedCoverBackground("front", design)).toBe(true);
  expect(usesSharedCoverBackground("back", design)).toBe(false);
  expect(usesSharedCoverBackground("spine", design)).toBe(true);
});
