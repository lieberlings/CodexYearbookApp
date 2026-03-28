import { describe, expect, it } from "@jest/globals";
import { generateSuggestionsForProject, suggestCandidatePhotosForMemory } from "./promptEngine";
import { Memory, PhotoItem } from "../types";

function makePhoto(overrides: Partial<PhotoItem> & Pick<PhotoItem, "id" | "projectId" | "uri" | "capturedAt" | "addedAt">): PhotoItem {
  return {
    width: 1000,
    height: 800,
    ...overrides
  };
}

describe("promptEngine Milestone 2 foundations", () => {
  it("generates event suggestions from both memory photos and unassigned project-pool photos", () => {
    const projectId = "project-1";
    const memories: Memory[] = [
      {
        id: "memory-1",
        projectId,
        title: "Beach Day",
        kind: "event",
        status: "active",
        order: 0,
        createdAt: "2024-07-01T00:00:00.000Z",
        updatedAt: "2024-07-01T00:00:00.000Z"
      }
    ];
    const photos: PhotoItem[] = [
      makePhoto({
        id: "m1",
        projectId,
        memoryId: "memory-1",
        uri: "file:///m1.jpg",
        capturedAt: "2024-07-02T09:00:00.000Z",
        addedAt: "2024-07-02T09:00:00.000Z"
      }),
      makePhoto({
        id: "m2",
        projectId,
        memoryId: "memory-1",
        uri: "file:///m2.jpg",
        capturedAt: "2024-07-02T10:00:00.000Z",
        addedAt: "2024-07-02T10:00:00.000Z"
      }),
      makePhoto({
        id: "m3",
        projectId,
        memoryId: "memory-1",
        uri: "file:///m3.jpg",
        capturedAt: "2024-07-02T11:00:00.000Z",
        addedAt: "2024-07-02T11:00:00.000Z"
      }),
      makePhoto({
        id: "m4",
        projectId,
        memoryId: "memory-1",
        uri: "file:///m4.jpg",
        capturedAt: "2024-07-02T12:00:00.000Z",
        addedAt: "2024-07-02T12:00:00.000Z"
      }),
      makePhoto({
        id: "p1",
        projectId,
        uri: "file:///p1.jpg",
        capturedAt: "2024-07-10T09:00:00.000Z",
        addedAt: "2024-07-10T09:00:00.000Z"
      }),
      makePhoto({
        id: "p2",
        projectId,
        uri: "file:///p2.jpg",
        capturedAt: "2024-07-10T10:00:00.000Z",
        addedAt: "2024-07-10T10:00:00.000Z"
      }),
      makePhoto({
        id: "p3",
        projectId,
        uri: "file:///p3.jpg",
        capturedAt: "2024-07-10T11:00:00.000Z",
        addedAt: "2024-07-10T11:00:00.000Z"
      }),
      makePhoto({
        id: "p4",
        projectId,
        uri: "file:///p4.jpg",
        capturedAt: "2024-07-10T12:00:00.000Z",
        addedAt: "2024-07-10T12:00:00.000Z"
      })
    ];

    const suggestions = generateSuggestionsForProject(projectId, memories, photos, new Date("2024-07-11T00:00:00.000Z"));
    const eventSuggestions = suggestions.filter((suggestion) => suggestion.type === "event");

    expect(
      eventSuggestions.some((suggestion) => ["m1", "m2", "m3", "m4"].every((id) => suggestion.candidatePhotoIds.includes(id)))
    ).toBe(true);
    expect(
      eventSuggestions.some((suggestion) => ["p1", "p2", "p3", "p4"].every((id) => suggestion.candidatePhotoIds.includes(id)))
    ).toBe(true);
  });

  it("generates a collection suggestion from unassigned project photos spanning time", () => {
    const projectId = "project-1";
    const photos: PhotoItem[] = [
      makePhoto({ id: "c1", projectId, uri: "file:///c1.jpg", capturedAt: "2024-01-01T10:00:00.000Z", addedAt: "2024-01-01T10:00:00.000Z" }),
      makePhoto({ id: "c2", projectId, uri: "file:///c2.jpg", capturedAt: "2024-01-01T12:00:00.000Z", addedAt: "2024-01-01T12:00:00.000Z" }),
      makePhoto({ id: "c3", projectId, uri: "file:///c3.jpg", capturedAt: "2024-01-08T12:00:00.000Z", addedAt: "2024-01-08T12:00:00.000Z" }),
      makePhoto({ id: "c4", projectId, uri: "file:///c4.jpg", capturedAt: "2024-01-15T12:00:00.000Z", addedAt: "2024-01-15T12:00:00.000Z" }),
      makePhoto({ id: "c5", projectId, uri: "file:///c5.jpg", capturedAt: "2024-01-20T12:00:00.000Z", addedAt: "2024-01-20T12:00:00.000Z" }),
      makePhoto({ id: "c6", projectId, uri: "file:///c6.jpg", capturedAt: "2024-01-25T12:00:00.000Z", addedAt: "2024-01-25T12:00:00.000Z" })
    ];

    const suggestions = generateSuggestionsForProject(projectId, [], photos, new Date("2024-01-26T00:00:00.000Z"));
    const collectionSuggestion = suggestions.find((suggestion) => suggestion.type === "collection");

    expect(collectionSuggestion).toBeDefined();
    expect(collectionSuggestion?.candidatePhotoIds.length).toBeGreaterThan(0);
    expect(collectionSuggestion?.message).toContain("project photos span");
  });

  it("suggests candidate photos for collection memories from the unassigned project pool only", () => {
    const memory: Memory = {
      id: "memory-collection",
      projectId: "project-1",
      title: "Hiking Highlights",
      kind: "collection",
      status: "watching",
      themeTags: ["hiking"],
      order: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    };
    const projectPoolPhotos: PhotoItem[] = [
      makePhoto({
        id: "u1",
        projectId: "project-1",
        uri: "file:///u1.jpg",
        capturedAt: "2024-02-01T10:00:00.000Z",
        addedAt: "2024-02-01T10:00:00.000Z",
        location: { latitude: 47.12, longitude: 11.34 }
      }),
      makePhoto({
        id: "u2",
        projectId: "project-1",
        uri: "file:///u2.jpg",
        capturedAt: "2024-02-10T10:00:00.000Z",
        addedAt: "2024-02-10T10:00:00.000Z",
        location: { latitude: 47.13, longitude: 11.35 }
      }),
      makePhoto({
        id: "assigned",
        projectId: "project-1",
        memoryId: "other-memory",
        uri: "file:///assigned.jpg",
        capturedAt: "2024-02-11T10:00:00.000Z",
        addedAt: "2024-02-11T10:00:00.000Z"
      })
    ];

    const candidates = suggestCandidatePhotosForMemory(memory, [], projectPoolPhotos, 6);

    expect(candidates.map((photo) => photo.id)).toEqual(expect.arrayContaining(["u1", "u2"]));
    expect(candidates.map((photo) => photo.id)).not.toContain("assigned");
  });
});
