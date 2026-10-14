import { getShapeTextLayout } from "../layout/shapeText";
import { shapePath } from "../layout/objectShapes";
import * as ImageManipulator from "expo-image-manipulator";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { applySlotOverridesToPage } from "../layout/overrides";
import { buildLayoutDocument } from "../layout/engine";
import { loadSvgAssetXml } from "./svgAssetService";
import { getBackgroundAssetSourceUri } from "../layout/backgroundAssets";
import { getPhotoAspect, getPhotoRenderMetrics } from "../layout/photoMetrics";
import { SlotOverride } from "../state/editorStore";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import type { LayoutSlot } from "../layout/schemas";
import { effectivePrintPpi, printResolutionStatus, renderedImageWidthInches, type PrintSize } from "./bookfactoryPrintPlan";
import { BookSize, getBookSize, mmToPoints, pdfPageSizePoints } from "./bookSizes";

// Text sizes and stroke widths are authored against a 620 px wide page.
const DESIGN_CANVAS_PX = 620;
const CSS_PX_PER_MM = 96 / 25.4;
const TARGET_PRINT_PPI = 300;
const PRINT_JPEG_QUALITY = 0.9;
// Slots this close to a trim edge are stretched into the bleed so a slightly
// off cut doesn't leave a white sliver.
const EDGE_SNAP = 0.005;

export type PdfExportOptions = {
  bookSizeId?: string;
};

export type LowResolutionPhoto = {
  photoId: string;
  pageLabel: string;
  ppi: number;
};

export type PdfExportResult = {
  uri: string;
  bookSize: BookSize;
  lowResolutionPhotos: LowResolutionPhoto[];
};

type EmbeddedImage = {
  src: string;
  width?: number;
  height?: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function applyColorOpacity(color: string | undefined, opacity: number | undefined): string {
  if (!color) {
    return "transparent";
  }
  const normalizedOpacity = Math.max(0, Math.min(1, opacity ?? 1));
  const hex = color.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

// Embed each photo at the pixel width its largest placement needs for
// TARGET_PRINT_PPI, never upscaling past the original.
async function toEmbeddableImage(photo: PhotoItem, neededWidthInches: number | undefined): Promise<EmbeddedImage | undefined> {
  if (photo.exportDataUri?.startsWith("data:image/")) {
    return { src: photo.exportDataUri, width: photo.width, height: photo.height };
  }
  if (photo.uri.startsWith("data:image/")) {
    return { src: photo.uri, width: photo.width, height: photo.height };
  }
  const fallback = photo.uri.startsWith("file://") ? { src: photo.uri, width: photo.width, height: photo.height } : undefined;
  try {
    // Measure the decoded image (orientation applied) rather than trusting library metadata.
    const original = await ImageManipulator.manipulateAsync(photo.uri, [], {
      compress: 0,
      format: ImageManipulator.SaveFormat.JPEG
    });
    const targetWidth = neededWidthInches ? Math.ceil(neededWidthInches * TARGET_PRINT_PPI) : original.width;
    const actions = targetWidth < original.width ? [{ resize: { width: targetWidth } }] : [];
    const embedded = await ImageManipulator.manipulateAsync(photo.uri, actions, {
      compress: PRINT_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true
    });
    if (embedded.base64) {
      return { src: `data:image/jpeg;base64,${embedded.base64}`, width: embedded.width, height: embedded.height };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function snapToBleed(frame: LayoutSlot["frame"], rotation: number | undefined, bleedX: number, bleedY: number): LayoutSlot["frame"] {
  if (rotation) {
    return frame;
  }
  let { x, y, width, height } = frame;
  if (x <= EDGE_SNAP) { width += x + bleedX; x = -bleedX; }
  if (y <= EDGE_SNAP) { height += y + bleedY; y = -bleedY; }
  if (x + width >= 1 - EDGE_SNAP) { width = 1 + bleedX - x; }
  if (y + height >= 1 - EDGE_SNAP) { height = 1 + bleedY - y; }
  return { x, y, width, height };
}

async function renderPhotoBlock(src: string | undefined): Promise<string> {
  if (!src) {
    return '<div class="missing">Photo unavailable</div>';
  }
  return `<img src="${escapeAttr(src)}" />`;
}

export async function exportProjectToPdf(
  project: Project,
  memories: Memory[],
  photosByMemoryId: Record<string, PhotoItem[]>,
  pageSectionsByMemoryId?: Record<string, MemoryPageSection[]>,
  slotOverridesByPage?: Record<string, Record<string, SlotOverride>>,
  options: PdfExportOptions = {}
): Promise<PdfExportResult> {
  const bookSize = getBookSize(options.bookSizeId);
  const trim: PrintSize = { widthMm: bookSize.trimWidthMm, heightMm: bookSize.trimHeightMm };
  const pagePoints = pdfPageSizePoints(bookSize);
  const bleedX = bookSize.bleedMm / bookSize.trimWidthMm;
  const bleedY = bookSize.bleedMm / bookSize.trimHeightMm;
  const canvasHeightPx = DESIGN_CANVAS_PX * bookSize.trimHeightMm / bookSize.trimWidthMm;
  const canvasScale = (bookSize.trimWidthMm * CSS_PX_PER_MM) / DESIGN_CANVAS_PX;

  const baseDocument = buildLayoutDocument(project, memories, photosByMemoryId, pageSectionsByMemoryId, "portrait");
  const pages = baseDocument.pages.map((page) => applySlotOverridesToPage(page, slotOverridesByPage?.[page.id]));
  const photosById = Object.fromEntries(Object.values(photosByMemoryId).flat().map((photo) => [photo.id, photo] as const));
  const printFrame = (slot: LayoutSlot) => snapToBleed(slot.frame, slot.rotation, bleedX, bleedY);

  // Size each photo once, for the largest place it prints.
  const neededWidthInches = new Map<string, number>();
  for (const page of pages) {
    for (const slot of page.slots) {
      const photo = slot.photoId ? photosById[slot.photoId] : undefined;
      if (!photo) continue;
      const inches = renderedImageWidthInches({ ...slot, frame: printFrame(slot) }, getPhotoAspect(photo), trim);
      if (inches) neededWidthInches.set(photo.id, Math.max(inches, neededWidthInches.get(photo.id) ?? 0));
    }
  }
  const imageCache = new Map<string, EmbeddedImage | undefined>();
  async function getImage(photo: PhotoItem): Promise<EmbeddedImage | undefined> {
    if (!imageCache.has(photo.id)) {
      imageCache.set(photo.id, await toEmbeddableImage(photo, neededWidthInches.get(photo.id)));
    }
    return imageCache.get(photo.id);
  }

  const lowResolutionPhotos: LowResolutionPhoto[] = [];
  let pageHtml = "";
  for (const page of pages) {
    const pageLabel = page.pageCount > 1 ? `${page.memoryTitle} (${page.pageIndex + 1}/${page.pageCount})` : page.memoryTitle;
    const backgroundUri = getBackgroundAssetSourceUri(page.backgroundAssetId);
    const backgroundSource = backgroundUri
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await loadSvgAssetXml(backgroundUri))}`
      : undefined;
    let slotsHtml = "";
    let textBoxesHtml = "";
    const textAnchorSlotIds = new Set(page.textBoxes.map((textBox) => textBox.anchorSlotId).filter(Boolean));

    for (const slot of page.slots) {
      const photo = slot.photoId ? photosById[slot.photoId] : undefined;
      if (!photo && textAnchorSlotIds.has(slot.id)) {
        continue;
      }
      const image = photo ? await getImage(photo) : undefined;
      const src = image?.src;
      const frame = printFrame(slot);
      if (photo && image?.width && image.height) {
        const ppi = effectivePrintPpi({ ...slot, frame }, { width: image.width, height: image.height }, trim);
        if (ppi !== undefined && printResolutionStatus(ppi) === "low") {
          lowResolutionPhotos.push({ photoId: photo.id, pageLabel, ppi: Math.round(ppi) });
        }
      }
      const photoMetrics = getPhotoRenderMetrics({
        containerAspect: frame.width / Math.max(0.0001, frame.height),
        imageAspect: getPhotoAspect(photo),
        fitMode: slot.fitMode,
        scale: slot.photoScale ?? 1,
        offsetX: slot.photoOffsetX ?? 0,
        offsetY: slot.photoOffsetY ?? 0
      });
      slotsHtml += `
        <div
          class="slot"
          style="
            transform:rotate(${slot.rotation ?? 0}deg); z-index:${slot.zIndex ?? 2}; background:${slot.shape && slot.shape !== "rectangle" ? "transparent" : "#f8fafc"};
            left:${(frame.x * 100).toFixed(4)}%;
            top:${(frame.y * 100).toFixed(4)}%;
            width:${(frame.width * 100).toFixed(4)}%;
            height:${(frame.height * 100).toFixed(4)}%;
            border-color:${escapeAttr(page.slotBorderColor ?? "#e2e8f0")};
            border-width:${(slot.shape && slot.shape !== "rectangle" ? 0 : page.slotBorderWidth ?? 1).toFixed(2)}px;
            border-radius:${(page.slotCornerRadius ?? 0).toFixed(2)}px;
          "
        >
          ${
            slot.shape && slot.shape !== "rectangle" ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><defs><clipPath id="shape-${escapeAttr(page.id)}-${escapeAttr(slot.id)}"><path d="${shapePath(slot.shape)}" /></clipPath></defs>${src ? `<image href="${escapeAttr(src)}" x="${photoMetrics.leftPercent}" y="${photoMetrics.topPercent}" width="${photoMetrics.width * 100}" height="${photoMetrics.height * 100}" preserveAspectRatio="none" clip-path="url(#shape-${escapeAttr(page.id)}-${escapeAttr(slot.id)})" />` : ""}<path d="${shapePath(slot.shape)}" fill="none" stroke="${escapeAttr(page.slotBorderColor ?? "#e2e8f0")}" stroke-width="${page.slotBorderWidth ?? 1}" /></svg>` : src
              ? `<img class="fit-${slot.fitMode}" src="${escapeAttr(src)}" style="
                width:${(photoMetrics.width * 100).toFixed(3)}%;
                height:${(photoMetrics.height * 100).toFixed(3)}%;
                left:${photoMetrics.leftPercent.toFixed(3)}%;
                top:${photoMetrics.topPercent.toFixed(3)}%;
              " />`
              : await renderPhotoBlock(src)
          }
        </div>
      `;
    }

    for (const textBox of page.textBoxes) {
      const anchorSlot = textBox.anchorSlotId
        ? page.slots.find((slot) => slot.id === textBox.anchorSlotId)
        : undefined;
      const textFrame = anchorSlot?.frame ?? textBox;
      const shapeText = getShapeTextLayout(textBox.shape, textBox.text, textFrame.width * 620, textFrame.height * 620, textBox.sticker ? textFrame.height * 620 * .7 : textBox.fontSize ?? page.textSize ?? 24, textBox.borderWidth);
      textBoxesHtml += `
        <div
          class="text-box"
          style="
            transform:rotate(${textBox.rotation ?? 0}deg); z-index:${textBox.zIndex ?? 20};
            left:${(textFrame.x * 100).toFixed(4)}%;
            top:${(textFrame.y * 100).toFixed(4)}%;
            width:${(textFrame.width * 100).toFixed(4)}%;
            height:${(textFrame.height * 100).toFixed(4)}%;
            border-width:${(textBox.shape && textBox.shape !== "rectangle" ? 0 : textBox.borderWidth ?? 0).toFixed(2)}px;
            border-color:${escapeAttr(textBox.borderColor ?? "#0f172a")};
            border-radius:${(textBox.cornerRadius ?? 0).toFixed(2)}px;
            background:${escapeAttr((anchorSlot || (textBox.shape && textBox.shape !== "rectangle")) ? "transparent" : applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0))};
            color:${escapeAttr(textBox.textColor ?? page.textColor ?? "#0f172a")};
            font-size:${(textBox.sticker ? textFrame.height * 620 * .7 : textBox.fontSize ?? page.textSize ?? 24).toFixed(0)}px;
            padding:${shapeText || textBox.sticker ? "0" : "8px 10px"};
            font-weight:${escapeAttr(textBox.fontWeight ?? "700")};
            font-style:${escapeAttr(textBox.fontStyle ?? "normal")};
            font-family:${escapeAttr(textBox.fontFamily ?? page.textFontFamily ?? "Arial, sans-serif")};
            text-align:${escapeAttr(textBox.textAlign ?? "center")};
          "
        >${textBox.shape && textBox.shape !== "rectangle" ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="${shapePath(textBox.shape)}" fill="${escapeAttr(applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0))}" stroke="${escapeAttr(textBox.borderColor ?? "#0f172a")}" stroke-width="${textBox.borderWidth ?? 0}" /></svg>` : ""}<span style="${shapeText ? `position:absolute;left:${shapeText.left}px;top:${shapeText.top}px;width:${shapeText.width}px;height:${shapeText.height}px;font-size:${shapeText.fontSize}px;line-height:${shapeText.lineHeight}px;display:flex;align-items:center;overflow:hidden;` : "position:relative;"}"><span style="width:100%;overflow-wrap:anywhere;">${escapeHtml(textBox.text)}</span></span></div>
      `;
    }

    // The page is the full bleed area; the design canvas sits on the trim box.
    pageHtml += `
      <section class="page" style="background:${escapeAttr(page.backgroundColor ?? "#ffffff")};">
        ${backgroundSource ? `<img class="background-image" src="${escapeAttr(backgroundSource)}" />` : ""}
        <div class="canvas">
          ${slotsHtml}
          ${textBoxesHtml}
        </div>
      </section>
    `;
  }

  // One point short of the PDF page so rounding never spills onto a blank page.
  const pageCss = `width:${pagePoints.width}pt;height:${pagePoints.height - 1}pt;`;
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: ${pagePoints.width}pt ${pagePoints.height}pt;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
          }
          .page, .project-cover {
            position: relative;
            ${pageCss}
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .project-cover {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            box-sizing: border-box;
            padding: ${mmToPoints(bookSize.bleedMm + 15).toFixed(2)}pt;
          }
          .project-title {
            font-size: 34px;
            font-weight: bold;
            letter-spacing: 0.3px;
            margin-bottom: 6px;
          }
          .project-type {
            font-size: 14px;
            color: #64748b;
            text-transform: capitalize;
          }
          .canvas {
            position: absolute;
            left: ${bookSize.bleedMm}mm;
            top: ${bookSize.bleedMm}mm;
            width: ${DESIGN_CANVAS_PX}px;
            height: ${canvasHeightPx.toFixed(3)}px;
            transform: scale(${canvasScale.toFixed(6)});
            transform-origin: 0 0;
          }
          .background-image {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
          }
          .slot {
            position: absolute;
            border-radius: 0;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            box-sizing: border-box;
            z-index: 2;
          }
          img {
            display: block;
            background: #f8fafc;
            position: absolute;
          }
          img.fit-contain { object-fit: contain; }
          img.fit-cover { object-fit: cover; }
          .missing {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            background: #f8fafc;
            font-size: 12px;
          }
          .text-box {
            position: absolute;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 10px;
            border-style: solid;
            white-space: pre-wrap;
            overflow: hidden;
            z-index: 5;
          }
        </style>
      </head>
      <body>
        ${memories.some(memory => memory.bookRole === "front-cover") ? "" : `<section class="project-cover"><div class="project-title">${escapeHtml(project.name)}</div><div class="project-type">${escapeHtml(project.projectType)}</div></section>`}
        ${pageHtml || '<section class="page"></section>'}
      </body>
    </html>
  `;

  const result = await Print.printToFileAsync({ html, width: pagePoints.width, height: pagePoints.height });
  return { uri: result.uri, bookSize, lowResolutionPhotos };
}

export async function sharePdf(pdfUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is unavailable on this device.");
  }
  await Sharing.shareAsync(pdfUri, {
    UTI: ".pdf",
    mimeType: "application/pdf"
  });
}
