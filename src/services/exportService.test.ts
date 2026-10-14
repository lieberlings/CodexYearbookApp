import * as Print from "expo-print";
import { exportProjectToPdf } from "./exportService";
import { droppedPhoto } from "../layout/freestyle";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { getBackgroundAssetSourceUri } from "../layout/backgroundAssets";
import { loadSvgAssetXml } from "./svgAssetService";
import * as ImageManipulator from "expo-image-manipulator";

jest.mock("../layout/templates", () => { Object.assign(globalThis, { __DEV__: false }); return jest.requireActual("../layout/templates"); });
jest.mock("../layout/backgroundAssets", () => ({ getBackgroundAssetSourceUri: jest.fn() }));
jest.mock("./svgAssetService", () => ({ loadSvgAssetXml: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn(async () => ({ uri: "file://book.pdf" })) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

it("exports shaped rotated layers and emoji, without adding an extra cover or cover heading", async () => {
  const project = { id: "p", name: "My Book", projectType: "yearbook" } as Project;
  const memory = { id: "m", projectId: "p", title: "Front cover", bookRole: "front-cover", order: 0 } as Memory;
  const photo = { id: "photo", memoryId: "m", projectId: "p", addedAt: "", uri: "data:image/png;base64,abc" } as PhotoItem;
  const section: MemoryPageSection = { id: "page", memoryId: "m", order: 0, photoIds: [photo.id], templateId: "freestyle", freestyleSlots: [{ ...droppedPhoto(photo.id, .5, .5, "free", 8), rotation: 45, shape: "heart" }], textBoxes: [{ id: "text", text: "😊", sticker: true, x: .2, y: .2, width: .2, height: .2, rotation: 15, zIndex: 9, shape: "thought", fillColor: "#ffffff", fillOpacity: .5 }] };
  await exportProjectToPdf(project, [memory], { m: [photo] }, { m: [section] });
  const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html as string;
  expect(html).toContain("transform:rotate(45deg); z-index:8");
  expect(html).toContain('clip-path="url(#shape-page-free)"');
  expect(html).toContain("transform:rotate(15deg); z-index:9");
  expect(html).toContain("😊");
  expect(html).not.toContain('<section class="project-cover">');
  expect(html).not.toContain('>Front cover</div>');
});

it("embeds packaged background patterns in the PDF instead of an Android resource name", async () => {
  const xml = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10" /></svg>';
  (getBackgroundAssetSourceUri as jest.Mock).mockReturnValue("assets_background_pattern");
  (loadSvgAssetXml as jest.Mock).mockResolvedValue(xml);
  const project = { id: "p", name: "Book", projectType: "yearbook" } as Project;
  const memory = { id: "m", projectId: "p", title: "Memory", order: 0 } as Memory;
  await exportProjectToPdf(project, [memory], { m: [] }, { m: [{ id: "page", memoryId: "m", order: 0, photoIds: [], backgroundAssetId: "pattern" }] });
  const calls = (Print.printToFileAsync as jest.Mock).mock.calls;
  const html = calls[calls.length - 1][0].html as string;
  expect(html).toContain(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  expect(html).not.toContain('src="assets_background_pattern"');
});

function fullPageSection(photoId: string, frame = { x: 0, y: 0, width: 1, height: 1 }): MemoryPageSection {
  return { id: "page", memoryId: "m", order: 0, photoIds: [photoId], templateId: "freestyle",
    freestyleSlots: [{ ...droppedPhoto(photoId, .5, .5, "full", 2), frame }] };
}

function mockDecodedPhoto(width: number, height: number) {
  (ImageManipulator.manipulateAsync as jest.Mock).mockReset().mockImplementation(async (_uri: string, actions: { resize?: { width: number } }[], options: { base64?: boolean }) => {
    const resize = actions[0]?.resize;
    const outWidth = resize?.width ?? width;
    return { uri: "file://out.jpg", width: outWidth, height: Math.round(outWidth * height / width), base64: options.base64 ? "img" : undefined };
  });
}

function lastPrintCall() {
  const calls = (Print.printToFileAsync as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as { html: string; width: number; height: number };
}

const project = { id: "p", name: "Book", projectType: "yearbook" } as Project;
const memory = { id: "m", projectId: "p", title: "Beach day", order: 0 } as Memory;

it("prints a 20 cm square book on full-bleed pages without page titles", async () => {
  mockDecodedPhoto(4000, 4000);
  const photo = { id: "photo", memoryId: "m", projectId: "p", addedAt: "", uri: "file://photo.jpg", width: 4000, height: 4000 } as PhotoItem;
  const result = await exportProjectToPdf(project, [memory], { m: [photo] }, { m: [fullPageSection(photo.id)] });
  const call = lastPrintCall();
  expect(call.width).toBe(584);
  expect(call.height).toBe(584);
  expect(call.html).toContain("size: 584pt 584pt");
  expect(call.html).toContain("margin: 0;");
  expect(call.html).not.toContain("Beach day");
  expect(result.bookSize.id).toBe("square-20cm");
  // A slot touching the trim edges is stretched 3 mm into the bleed on every side.
  expect(call.html).toContain("left:-1.5000%");
  expect(call.html).toContain("width:103.0000%");
});

it("embeds photos at 300 PPI for their printed size with high JPEG quality", async () => {
  mockDecodedPhoto(4000, 4000);
  const photo = { id: "photo", memoryId: "m", projectId: "p", addedAt: "", uri: "file://photo.jpg", width: 4000, height: 4000 } as PhotoItem;
  const result = await exportProjectToPdf(project, [memory], { m: [photo] }, { m: [fullPageSection(photo.id)] });
  const calls = (ImageManipulator.manipulateAsync as jest.Mock).mock.calls;
  const embedCall = calls.find(([, , options]) => options.base64);
  // 206 mm (trim plus bleed) at 300 PPI is 2434 px.
  expect(embedCall[1]).toEqual([{ resize: { width: 2434 } }]);
  expect(embedCall[2].compress).toBe(0.9);
  expect(result.lowResolutionPhotos).toEqual([]);
});

it("never upscales and reports photos that will print below 220 PPI", async () => {
  mockDecodedPhoto(1200, 1200);
  const photo = { id: "photo", memoryId: "m", projectId: "p", addedAt: "", uri: "file://small.jpg", width: 1200, height: 1200 } as PhotoItem;
  const result = await exportProjectToPdf(project, [memory], { m: [photo] }, { m: [fullPageSection(photo.id)] });
  const embedCall = (ImageManipulator.manipulateAsync as jest.Mock).mock.calls.find(([, , options]) => options.base64);
  expect(embedCall[1]).toEqual([]);
  expect(result.lowResolutionPhotos).toEqual([{ photoId: "photo", pageLabel: "Beach day", ppi: 148 }]);
});
