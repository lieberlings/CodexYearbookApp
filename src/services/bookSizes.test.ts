import { BOOK_SIZES, DEFAULT_BOOK_SIZE_ID, getBookSize, pdfPageSizePoints } from "./bookSizes";

it("falls back to the default size for unknown ids", () => {
  expect(getBookSize().id).toBe(DEFAULT_BOOK_SIZE_ID);
  expect(getBookSize("missing").id).toBe(DEFAULT_BOOK_SIZE_ID);
});

it("sizes the 20 cm square PDF page with 3 mm bleed on each side", () => {
  // 206 mm = 583.9 pt
  expect(pdfPageSizePoints(getBookSize("square-20cm"))).toEqual({ width: 584, height: 584 });
});

it("keeps book size ids unique", () => {
  expect(new Set(BOOK_SIZES.map((size) => size.id)).size).toBe(BOOK_SIZES.length);
});
