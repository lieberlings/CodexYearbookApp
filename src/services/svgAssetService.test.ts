import * as FileSystem from "expo-file-system/legacy";
import { loadSvgAssetXml } from "./svgAssetService";

jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));
const read = FileSystem.readAsStringAsync as jest.Mock;

afterEach(() => { jest.restoreAllMocks(); read.mockReset(); });

it.each(["assets_background_spring_svg", "asset:/background.svg", "file:///background.svg"])("reads packaged/local SVG %s without a network fetch", async uri => {
  const network = jest.spyOn(globalThis, "fetch");
  read.mockResolvedValue('<svg><path d="M0 0" /></svg>');
  expect(await loadSvgAssetXml(uri)).toContain("<path");
  expect(read).toHaveBeenCalledWith(uri);
  expect(network).not.toHaveBeenCalled();
  await loadSvgAssetXml(uri);
  expect(read).toHaveBeenCalledTimes(1);
});

it("loads SVGs from Metro during development", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, text: async () => "<svg />" } as Response);
  expect(await loadSvgAssetXml("http://localhost:8081/background.svg")).toBe("<svg />");
  expect(read).not.toHaveBeenCalled();
});

it("allows retry after a failed read", async () => {
  read.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce("<svg />");
  await expect(loadSvgAssetXml("retry_background")).rejects.toThrow("temporary failure");
  expect(await loadSvgAssetXml("retry_background")).toBe("<svg />");
});
