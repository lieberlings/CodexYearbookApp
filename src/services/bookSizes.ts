// Printed book sizes. A size is the trimmed page plus the bleed a print
// service needs past each cut edge. Add new sizes here; keep shipped ids.
export type BookSize = {
  id: string;
  label: string;
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
};

export const BOOK_SIZES: readonly BookSize[] = [
  { id: "square-20cm", label: "20 × 20 cm", trimWidthMm: 200, trimHeightMm: 200, bleedMm: 3 }
];

export const DEFAULT_BOOK_SIZE_ID = "square-20cm";

export function getBookSize(id?: string): BookSize {
  return BOOK_SIZES.find((size) => size.id === id) ?? BOOK_SIZES.find((size) => size.id === DEFAULT_BOOK_SIZE_ID)!;
}

const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;

export function mmToPoints(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

// expo-print takes whole points, so the PDF page is rounded to the nearest
// point (at most 0.18 mm off).
export function pdfPageSizePoints(size: BookSize): { width: number; height: number } {
  return {
    width: Math.round(mmToPoints(size.trimWidthMm + 2 * size.bleedMm)),
    height: Math.round(mmToPoints(size.trimHeightMm + 2 * size.bleedMm))
  };
}
