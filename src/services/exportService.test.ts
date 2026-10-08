import * as Print from "expo-print";
import { exportProjectToPdf } from "./exportService";
import { droppedPhoto } from "../layout/freestyle";
import { Memory, MemoryPageSection, PhotoItem, Project } from "../types";
import { getBackgroundAssetSourceUri } from "../layout/backgroundAssets";
import { loadSvgAssetXml } from "./svgAssetService";

jest.mock("../layout/templates", () => { Object.assign(globalThis, { __DEV__: false }); return jest.requireActual("../layout/templates"); });
jest.mock("../layout/backgroundAssets", () => ({ getBackgroundAssetSourceUri: jest.fn() }));
jest.mock("./svgAssetService", () => ({ loadSvgAssetXml: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ manipulateAsync: jest.fn() }));
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
