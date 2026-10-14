import { lowResolutionMessage } from "./lowResolutionAlert";

jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));

it("lists low-resolution photos by page and caps the list", () => {
  const photos = Array.from({ length: 8 }, (_, index) => ({ photoId: `p${index}`, pageLabel: `Page ${index + 1}`, ppi: 150 + index }));
  const message = lowResolutionMessage(photos);
  expect(message).toContain("8 photos are too small");
  expect(message).toContain("• Page 1: 150 PPI");
  expect(message).toContain("• Page 6: 155 PPI");
  expect(message).not.toContain("Page 7:");
  expect(message).toContain("and 2 more");
  expect(lowResolutionMessage(photos.slice(0, 1))).toContain("1 photo is too small");
});
