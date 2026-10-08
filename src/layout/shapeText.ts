import { getShapeDefinition } from "./objectShapes";

// Conservative glyph widths leave room for font differences between Android and PDF.
function textWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((sum, char) => sum + (/\s/.test(char) ? .35 : /[ilI.,'!|]/.test(char) ? .35 : /[MW@#]/.test(char) || (char.codePointAt(0) ?? 0) > 255 ? 1.05 : .68), 0) * fontSize;
}

function wrappedLines(text: string, fontSize: number, width: number): number {
  return text.split("\n").reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/)) {
      const wordWidth = textWidth(word, fontSize);
      const gap = used ? fontSize * .35 : 0;
      if (used && used + gap + wordWidth > width) { lines++; used = 0; }
      if (wordWidth > width) {
        const count = Math.ceil(wordWidth / width);
        lines += count - 1;
        used = wordWidth - (count - 1) * width;
      } else used += (used ? gap : 0) + wordWidth;
    }
    return total + lines;
  }, 0);
}

export function getShapeTextLayout(shape: unknown, text: string, width: number, height: number, preferredFontSize: number, borderWidth = 0) {
  const definition = getShapeDefinition(shape);
  if (definition.id === "rectangle") return undefined;
  const bounds = definition.textBounds;
  const inset = Math.max(1, borderWidth / 2);
  const content = { left: width * bounds.x + inset, top: height * bounds.y + inset,
    width: Math.max(1, width * bounds.width - 2 * inset), height: Math.max(1, height * bounds.height - 2 * inset) };
  let low = .1;
  let high = Math.max(.1, preferredFontSize);
  for (let i = 0; i < 18; i++) {
    const fontSize = (low + high) / 2;
    if (wrappedLines(text, fontSize, content.width) * fontSize * 1.25 <= content.height) low = fontSize;
    else high = fontSize;
  }
  return { ...content, fontSize: low, lineHeight: low * 1.25,
    numberOfLines: Math.max(1, Math.floor(content.height / (low * 1.25))) };
}
