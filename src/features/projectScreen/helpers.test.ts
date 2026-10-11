import { PhotoItem, Project, Suggestion } from "../../types";
import {
  buildFinalizationStateCard,
  buildProjectPhotoStateCard,
  buildSuggestionStateCard,
  formatProjectStats,
  getSuggestionCandidateCount,
  getThumbnailUri,
  orderKey,
  parseCollectionHooks,
  pluralize,
  prioritizePrimary,
  resolveThumbnailPhotoId,
  StagedAsset
} from "./helpers";

const photo = (id: string) => ({ id, uri: `file://${id}.jpg` }) as PhotoItem;
const staged = (key: string) => ({ key, uri: `file://${key}.jpg` }) as StagedAsset;

describe("project screen helpers", () => {
  it("pluralizes counts and formats project stats", () => {
    expect(pluralize(1, "photo")).toBe("1 photo");
    expect(pluralize(3, "photo")).toBe("3 photos");
    expect(pluralize(2, "Memory", "Memories")).toBe("2 Memories");
    expect(formatProjectStats(1, 0, 2)).toBe("1 Memory · 0 Photos · 2 Pages");
    expect(orderKey([photo("a"), photo("b")])).toBe("a|b");
  });

  it("moves the primary photo to the front", () => {
    const photos = [photo("a"), photo("b"), photo("c")];
    expect(prioritizePrimary(photos, "c").map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(prioritizePrimary(photos, "missing")).toBe(photos);
    expect(prioritizePrimary(photos)).toBe(photos);
  });

  it("parses comma-separated collection hooks", () => {
    expect(parseCollectionHooks(" hiking, family ,, sunsets ")).toEqual(["hiking", "family", "sunsets"]);
    expect(parseCollectionHooks("")).toEqual([]);
  });

  it("resolves thumbnail choices for existing and staged photos", () => {
    const existing = [photo("a")];
    const assets = [staged("s1"), staged("s2")];
    expect(getThumbnailUri(undefined, existing, assets)).toBeUndefined();
    expect(getThumbnailUri({ kind: "existing", photoId: "a" }, existing, assets)).toBe("file://a.jpg");
    expect(getThumbnailUri({ kind: "existing", photoId: "p" }, existing, assets, [photo("p")])).toBe("file://p.jpg");
    expect(getThumbnailUri({ kind: "staged", stagedKey: "s2" }, existing, assets)).toBe("file://s2.jpg");
    expect(resolveThumbnailPhotoId({ kind: "staged", stagedKey: "s2" }, assets, ["new-1", "new-2"])).toBe("new-2");
    expect(resolveThumbnailPhotoId({ kind: "staged", stagedKey: "zz" }, assets, ["new-1"])).toBeUndefined();
    expect(resolveThumbnailPhotoId({ kind: "existing", photoId: "a" }, assets, [])).toBe("a");
  });

  it("counts suggestion candidates from refs before photo ids", () => {
    const withRefs = { candidatePhotoRefs: [{ id: "r1" }, { id: "r2" }], candidatePhotoIds: ["p1"] } as unknown as Suggestion;
    const withIds = { candidatePhotoIds: ["p1", "p2", "p3"] } as unknown as Suggestion;
    expect(getSuggestionCandidateCount(withRefs)).toBe(2);
    expect(getSuggestionCandidateCount(withIds)).toBe(3);
  });

  it("builds the suggestion and photo status cards", () => {
    const base = { suggestionScanError: undefined, lastSuggestionScanFeedback: undefined };
    expect(buildSuggestionStateCard({ ...base, suggestionScanState: "scanning", suggestionCount: 4 })?.title).toBe(
      "Scanning suggestions"
    );
    expect(buildSuggestionStateCard({ ...base, suggestionScanState: "idle", suggestionCount: 4 })).toBeUndefined();
    expect(buildSuggestionStateCard({ ...base, suggestionScanState: "empty", suggestionCount: 0 })?.tone).toBe("empty");
    expect(
      buildSuggestionStateCard({
        ...base,
        suggestionScanState: "done",
        lastSuggestionScanFeedback: { generatedCount: 2, source: "manual" },
        suggestionCount: 2
      })?.message
    ).toBe("2 suggestions generated or refreshed from the current project scope.");
    expect(
      buildProjectPhotoStateCard({ projectPhotoFeedback: undefined, projectPhotoCount: 3, unassignedPhotoCount: 1 })
    ).toBeUndefined();
    expect(
      buildProjectPhotoStateCard({ projectPhotoFeedback: undefined, projectPhotoCount: 0, unassignedPhotoCount: 0 })?.title
    ).toBe("No project photos yet");
  });

  it("builds the finalization status card from the project state", () => {
    expect(buildFinalizationStateCard(undefined, 3).title).toBe("Finalization is optional");
    const reviewed = { finalizationStatus: "reviewed" } as Project;
    expect(buildFinalizationStateCard(reviewed, 0).title).toBe("No finalization issues found");
    expect(buildFinalizationStateCard(reviewed, 2).tone).toBe("success");
  });
});
