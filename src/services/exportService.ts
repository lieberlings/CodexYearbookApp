import * as ImageManipulator from "expo-image-manipulator";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { applySlotOverridesToPage } from "../layout/overrides";
import { buildLayoutDocument } from "../layout/engine";
import { SlotOverride } from "../state/editorStore";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";

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

async function toEmbeddableImageSource(photo: PhotoItem): Promise<string | undefined> {
  if (photo.exportDataUri?.startsWith("data:image/")) {
    return photo.exportDataUri;
  }
  if (photo.uri.startsWith("data:image/")) {
    return photo.uri;
  }
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1100 } }],
      {
        compress: 0.48,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true
      }
    );
    if (manipulated.base64) {
      return `data:image/jpeg;base64,${manipulated.base64}`;
    }
  } catch {
    return photo.uri.startsWith("file://") ? photo.uri : undefined;
  }
  return photo.uri.startsWith("file://") ? photo.uri : undefined;
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
  slotOverridesByPage?: Record<string, Record<string, SlotOverride>>
): Promise<string> {
  const baseDocument = buildLayoutDocument(project, memories, photosByMemoryId, pageSectionsByMemoryId, "portrait");
  const pages = baseDocument.pages.map((page) => applySlotOverridesToPage(page, slotOverridesByPage?.[page.id]));
  const sourceCache = new Map<string, string | undefined>();
  const photosById = Object.fromEntries(Object.values(photosByMemoryId).flat().map((photo) => [photo.id, photo] as const));

  async function getSource(photo: PhotoItem): Promise<string | undefined> {
    if (sourceCache.has(photo.id)) {
      return sourceCache.get(photo.id);
    }
    const source = await toEmbeddableImageSource(photo);
    sourceCache.set(photo.id, source);
    return source;
  }

  let pageHtml = "";
  for (const page of pages) {
    const pageTitle = page.pageCount > 1 ? `${page.memoryTitle} (${page.pageIndex + 1}/${page.pageCount})` : page.memoryTitle;
    let slotsHtml = "";

    for (const slot of page.slots) {
      const photo = slot.photoId ? photosById[slot.photoId] : undefined;
      const src = photo ? await getSource(photo) : undefined;
      const sizePercent = slot.photoScale * 100;
      const leftPercent = 50 - slot.photoScale * 50 + slot.photoOffsetX * 100;
      const topPercent = 50 - slot.photoScale * 50 + slot.photoOffsetY * 100;
      slotsHtml += `
        <div
          class="slot"
          style="
            left:${(slot.frame.x * 100).toFixed(4)}%;
            top:${(slot.frame.y * 100).toFixed(4)}%;
            width:${(slot.frame.width * 100).toFixed(4)}%;
            height:${(slot.frame.height * 100).toFixed(4)}%;
            border-color:${escapeAttr(page.slotBorderColor ?? "#e2e8f0")};
            border-width:${(page.slotBorderWidth ?? 1).toFixed(2)}px;
            border-radius:${(page.slotCornerRadius ?? 10).toFixed(2)}px;
          "
        >
          ${
            src
              ? `<img class="fit-${slot.fitMode}" src="${escapeAttr(src)}" style="
                width:${sizePercent.toFixed(3)}%;
                height:${sizePercent.toFixed(3)}%;
                left:${leftPercent.toFixed(3)}%;
                top:${topPercent.toFixed(3)}%;
              " />`
              : await renderPhotoBlock(src)
          }
        </div>
      `;
    }

    pageHtml += `
      <section class="page">
        <div class="page-title" style="
          color:${escapeAttr(page.textColor ?? "#0f172a")};
          font-size:${(page.textSize ?? 22).toFixed(0)}px;
          font-weight:${escapeAttr(page.textWeight ?? "700")};
          font-family:${escapeAttr(page.textFontFamily ?? "Arial, sans-serif")};
        ">${escapeHtml(pageTitle)}</div>
        ${page.themeLabel ? `<div class="page-theme" style="color:${escapeAttr(page.textColor ?? "#64748b")};">${escapeHtml(page.themeLabel)}</div>` : ""}
        <div class="canvas" style="background:${escapeAttr(page.backgroundColor ?? "#ffffff")}; border-radius:18px;">
          ${slotsHtml || '<div class="empty">No photos on this page.</div>'}
        </div>
      </section>
    `;
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: 20cm 20cm;
            margin: 1cm;
          }
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            background: #ffffff;
          }
          .project-cover {
            page-break-after: always;
            min-height: 18cm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 24px;
            box-sizing: border-box;
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
          .page {
            page-break-after: always;
            min-height: 18cm;
            padding: 4px;
            box-sizing: border-box;
          }
          .page:last-child {
            page-break-after: auto;
          }
          .page-title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 4px;
            line-height: 1.2;
          }
          .page-theme {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .canvas {
            position: relative;
            width: 16.4cm;
            height: 16.4cm;
            margin-top: 0.3cm;
          }
          .slot {
            position: absolute;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            box-sizing: border-box;
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
          .empty {
            color: #64748b;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <section class="project-cover">
          <div class="project-title">${escapeHtml(project.name)}</div>
          <div class="project-type">${escapeHtml(project.projectType)}</div>
        </section>
        ${pageHtml || '<section class="page"><div class="empty">No memories yet.</div></section>'}
      </body>
    </html>
  `;

  const result = await Print.printToFileAsync({ html });
  return result.uri;
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
