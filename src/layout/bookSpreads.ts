import type { LayoutPage } from "./schemas";
import type { CoverDesign, CoverPanel, Memory } from "../types";

export type BookSpread = {
  id: string;
  kind: "front" | "content" | "back";
  left?: LayoutPage;
  right?: LayoutPage;
  leftNumber?: number;
  rightNumber?: number;
};

export function buildBookSpreads(pages: LayoutPage[], memories: Memory[]): BookSpread[] {
  const roles = new Map(memories.map(memory => [memory.id, memory.bookRole]));
  const front = pages.find(page => roles.get(page.memoryId) === "front-cover");
  const back = pages.find(page => roles.get(page.memoryId) === "back-cover");
  const content = pages.filter(page => !["front-cover", "back-cover"].includes(roles.get(page.memoryId) ?? ""));
  const spreads: BookSpread[] = [{ id: "front", kind: "front", right: front }];
  for (let index = -1; index < content.length; index += 2) {
    if (index === -1 && !content.length) break;
    spreads.push({ id: `content-${content[index + 1]?.id ?? content[index]?.id}`, kind: "content",
      left: index >= 0 ? content[index] : undefined, right: content[index + 1],
      leftNumber: index >= 0 ? index + 1 : undefined, rightNumber: content[index + 1] ? index + 2 : undefined });
  }
  spreads.push({ id: "back", kind: "back", left: back });
  return spreads;
}

export function spreadLabel(spread: BookSpread): string {
  if (spread.kind === "front") return "Front cover";
  if (spread.kind === "back") return "Back cover";
  const numbers = [spread.leftNumber, spread.rightNumber].filter((n): n is number => n !== undefined);
  return `${numbers.length > 1 ? "Pages" : "Page"} ${numbers.join("–")}`;
}

export function coverGeometry(design?: CoverDesign) {
  const panel = design?.panelWidthMm && design.panelWidthMm > 0 ? design.panelWidthMm : 205;
  const confirmed = Boolean(design?.spineWidthMm && design.spineWidthMm > 0 && design?.panelWidthMm && design.panelWidthMm > 0);
  const spine = confirmed ? design!.spineWidthMm! : panel * .065;
  return { panel, spine, total: panel * 2 + spine, confirmed };
}

export function coverPanelRegion(panel: CoverPanel, design?: CoverDesign) {
  const geometry = coverGeometry(design);
  return { x: panel === "back" ? 0 : panel === "spine" ? geometry.panel : geometry.panel + geometry.spine,
    width: panel === "spine" ? geometry.spine : geometry.panel, total: geometry.total, height: geometry.panel };
}

export function usesSharedCoverBackground(panel: CoverPanel, design?: CoverDesign): boolean {
  return Boolean(design?.background && (panel === "spine" || !design.panelBackgrounds?.[panel]));
}
