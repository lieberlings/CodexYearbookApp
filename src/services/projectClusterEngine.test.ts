import { describe, expect, it } from "@jest/globals";
import { PhotoItem } from "../types";
import { generateProjectPhotoClusters } from "./projectClusterEngine";

function makePhoto(
  overrides: Partial<PhotoItem> & Pick<PhotoItem, "id" | "projectId" | "uri" | "capturedAt" | "addedAt">
): PhotoItem {
  return {
    width: 1600,
    height: 1200,
    ...overrides
  };
}

describe("projectClusterEngine", () => {
  it("generates event-like clusters from project photos close together in time", () => {
    const projectId = "project-1";
    const photos = [
      makePhoto({
        id: "event-1",
        projectId,
        uri: "file:///event-1.jpg",
        capturedAt: "2026-04-10T10:00:00.000Z",
        addedAt: "2026-04-10T10:00:00.000Z",
        location: { latitude: 47.37, longitude: 8.54 },
        analysis: {
          quality: { qualityScore: 0.82, heroCandidateScore: 0.9 },
          faces: { faceCount: 2, hasFace: true, hasMultipleFaces: true }
        }
      }),
      makePhoto({
        id: "event-2",
        projectId,
        uri: "file:///event-2.jpg",
        capturedAt: "2026-04-10T11:00:00.000Z",
        addedAt: "2026-04-10T11:00:00.000Z",
        location: { latitude: 47.371, longitude: 8.541 },
        analysis: {
          quality: { qualityScore: 0.78, heroCandidateScore: 0.84 },
          faces: { faceCount: 1, hasFace: true, hasMultipleFaces: false }
        }
      }),
      makePhoto({
        id: "event-3",
        projectId,
        uri: "file:///event-3.jpg",
        capturedAt: "2026-04-10T12:00:00.000Z",
        addedAt: "2026-04-10T12:00:00.000Z",
        location: { latitude: 47.372, longitude: 8.542 },
        analysis: {
          quality: { qualityScore: 0.74, heroCandidateScore: 0.8 }
        }
      })
    ];

    const clusters = generateProjectPhotoClusters(projectId, photos);
    const eventCluster = clusters.find((cluster) => cluster.type === "event");

    expect(eventCluster).toBeDefined();
    expect(eventCluster?.photoIds).toEqual(["event-1", "event-2", "event-3"]);
    expect(eventCluster?.bestPhotoIds[0]).toBe("event-1");
    expect(eventCluster?.cues).toEqual(expect.arrayContaining(["time-burst", "location-cluster", "group-faces"]));
    expect(eventCluster?.explanation).toContain("Event-like cluster");
  });

  it("generates recurring collection-like clusters from repeated themes across days", () => {
    const projectId = "project-1";
    const photos = [0, 4, 8, 12, 16].map((offset, index) =>
      makePhoto({
        id: `scenic-${index + 1}`,
        projectId,
        uri: `file:///scenic-${index + 1}.jpg`,
        capturedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        addedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        analysis: {
          sceneTags: ["scenic", "outdoor"],
          themeTags: ["nature-like"],
          quality: { qualityScore: 0.72 + index * 0.02, heroCandidateScore: 0.76 + index * 0.02 }
        }
      })
    );

    const clusters = generateProjectPhotoClusters(projectId, photos);
    const collectionCluster = clusters.find(
      (cluster) => cluster.type === "collection" && ["nature-like", "scenic"].includes(cluster.recurrence?.key ?? "")
    );

    expect(collectionCluster).toBeDefined();
    expect(collectionCluster?.photoCount).toBe(5);
    expect(collectionCluster?.recurrence).toMatchObject({
      distinctDays: 5,
      spanDays: 16
    });
    expect(collectionCluster?.cues).toEqual(expect.arrayContaining(["recurring-theme", "scenic", "multi-day"]));
    expect(collectionCluster?.explanation).toContain("Recurring collection-like cluster");
  });

  it("does not create a broad portrait-only collection bucket", () => {
    const projectId = "project-1";
    const photos = [0, 4, 8, 12, 16].map((offset, index) =>
      makePhoto({
        id: `portrait-${index + 1}`,
        projectId,
        uri: `file:///portrait-${index + 1}.jpg`,
        capturedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        addedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        analysis: {
          faces: { faceCount: 1, hasFace: true, hasMultipleFaces: false },
          subjectCues: { portraitLike: true },
          quality: { qualityScore: 0.7, heroCandidateScore: 0.72 }
        }
      })
    );

    const clusters = generateProjectPhotoClusters(projectId, photos);

    expect(clusters.some((cluster) => cluster.type === "collection" && cluster.recurrence?.key === "portrait")).toBe(false);
  });

  it("dedupes overlapping group collection buckets", () => {
    const projectId = "project-1";
    const photos = [0, 4, 8, 12, 16, 20].map((offset, index) =>
      makePhoto({
        id: `group-${index + 1}`,
        projectId,
        uri: `file:///group-${index + 1}.jpg`,
        capturedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        addedAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + offset * 24 * 60 * 60 * 1000).toISOString(),
        analysis: {
          sceneTags: ["group"],
          faces: { faceCount: 2, hasFace: true, hasMultipleFaces: true },
          subjectCues: { groupPhotoLike: true },
          quality: { qualityScore: 0.72, heroCandidateScore: 0.75 }
        }
      })
    );

    const clusters = generateProjectPhotoClusters(projectId, photos);
    const groupCollections = clusters.filter(
      (cluster) => cluster.type === "collection" && ["group", "group-faces"].includes(cluster.recurrence?.key ?? "")
    );

    expect(groupCollections).toHaveLength(1);
    expect(groupCollections[0]?.recurrence?.key).toBe("group");
  });
});
