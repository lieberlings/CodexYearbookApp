import { describe, expect, it } from "@jest/globals";
import { formatPhotoLocation, normalizePhotoLocation } from "./photoLocation";

describe("photoLocation", () => {
  it("preserves valid GPS coordinates", () => {
    expect(normalizePhotoLocation({ latitude: 47.3769, longitude: 8.5417 })).toEqual({
      latitude: 47.3769,
      longitude: 8.5417
    });
  });

  it("returns undefined when GPS metadata is missing", () => {
    expect(normalizePhotoLocation(undefined)).toBeUndefined();
  });

  it("returns undefined for malformed or out-of-range GPS values", () => {
    expect(normalizePhotoLocation({ latitude: Number.NaN, longitude: 8.54 })).toBeUndefined();
    expect(normalizePhotoLocation({ latitude: 91, longitude: 8.54 })).toBeUndefined();
    expect(normalizePhotoLocation({ latitude: 47.37, longitude: 181 })).toBeUndefined();
  });

  it("treats 0,0 as invalid placeholder data instead of a fallback location", () => {
    expect(normalizePhotoLocation({ latitude: 0, longitude: 0 })).toBeUndefined();
  });

  it("formats missing or invalid GPS as a clear missing state", () => {
    expect(formatPhotoLocation(undefined)).toBe("No GPS metadata");
    expect(formatPhotoLocation({ latitude: 0, longitude: 0 })).toBe("No GPS metadata");
    expect(formatPhotoLocation({ latitude: 47.3769, longitude: 8.5417 })).toBe("47.37690, 8.54170");
  });
});
