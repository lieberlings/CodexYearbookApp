import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => JSON.stringify(["#112233", 42, "not a color", "#ABC"])),
    setItem: jest.fn(async () => undefined)
  }
}));

const mockedStorage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

describe("recentColors", () => {
  it("restores saved colors, skipping bad entries, and saves new picks", async () => {
    const store = await import("./recentColors");
    await store.recentColorsLoaded;
    expect(store.getRecentColors()).toEqual(["#112233", "#AABBCC"]);

    store.addRecentColor("#FF0000");
    expect(store.getRecentColors()).toEqual(["#FF0000", "#112233", "#AABBCC"]);
    expect(mockedStorage.setItem).toHaveBeenCalledWith("yearbook.recentColors.v1", JSON.stringify(["#FF0000", "#112233", "#AABBCC"]));
  });
});
