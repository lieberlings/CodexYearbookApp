import { describe, expect, it } from "@jest/globals";
import {
  applyPhotoAssignmentToMemory,
  buildMemorySeedFromSuggestion,
  getProjectScanReferenceDate,
  getScopedProjectPhotos,
  markSuggestionAccepted,
  updateSuggestionStatusRecords,
  upsertSuggestionRecords
} from "./appDataHelpers";
import { Memory, PhotoItem, Project, Suggestion } from "../types";

function makeProject(overrides: Partial<Project> & Pick<Project, "id" | "name" | "projectType" | "timelineMode" | "includeFutureProjectPhotos" | "assistLevel" | "styleIntensity" | "createdAt" | "updatedAt">): Project {
  return {
    ...overrides
  };
}

function makeMemory(overrides: Partial<Memory> & Pick<Memory, "id" | "projectId" | "title" | "kind" | "status" | "order" | "createdAt" | "updatedAt">): Memory {
  return {
    ...overrides
  };
}

function makePhoto(overrides: Partial<PhotoItem> & Pick<PhotoItem, "id" | "projectId" | "uri" | "capturedAt" | "addedAt">): PhotoItem {
  return {
    ...overrides
  };
}

describe("appDataHelpers Milestone 2 foundations", () => {
  it("scopes project photos using the project timeline and date range", () => {
    const project = makeProject({
      id: "project-1",
      name: "Trip",
      projectType: "vacation",
      timelineMode: "past",
      includeFutureProjectPhotos: false,
      startDate: "2024-07-01",
      endDate: "2024-07-10",
      assistLevel: "balanced",
      styleIntensity: "warm",
      createdAt: "2024-07-11T00:00:00.000Z",
      updatedAt: "2024-07-11T00:00:00.000Z"
    });
    const photos: PhotoItem[] = [
      makePhoto({ id: "before", projectId: "project-1", uri: "file:///before.jpg", capturedAt: "2024-06-30T23:00:00.000Z", addedAt: "2024-06-30T23:00:00.000Z" }),
      makePhoto({ id: "inside", projectId: "project-1", uri: "file:///inside.jpg", capturedAt: "2024-07-05T12:00:00.000Z", addedAt: "2024-07-05T12:00:00.000Z" }),
      makePhoto({ id: "after", projectId: "project-1", uri: "file:///after.jpg", capturedAt: "2024-07-11T01:00:00.000Z", addedAt: "2024-07-11T01:00:00.000Z" })
    ];

    const scoped = getScopedProjectPhotos(project, photos);
    const referenceDate = getProjectScanReferenceDate(project, scoped);

    expect(scoped.map((photo) => photo.id)).toEqual(["inside"]);
    expect(referenceDate.toISOString()).toBe("2024-07-10T23:59:59.999Z");
  });

  it("reconciles repeated suggestions by id while preserving non-new lifecycle state", () => {
    const existing: Suggestion[] = [
      {
        id: "suggestion-1",
        projectId: "project-1",
        type: "event",
        status: "snoozed",
        title: "Old title",
        message: "Old message",
        candidatePhotoIds: ["p1"],
        createdAt: "2024-01-01T00:00:00.000Z"
      },
      {
        id: "suggestion-2",
        projectId: "project-1",
        type: "collection",
        status: "accepted",
        title: "Collection",
        message: "Accepted already",
        candidatePhotoIds: ["p2"],
        acceptedMemoryId: "memory-99",
        createdAt: "2024-01-02T00:00:00.000Z"
      }
    ];
    const rescanned: Suggestion[] = [
      {
        id: "suggestion-1",
        projectId: "project-1",
        type: "event",
        status: "new",
        title: "Fresh title",
        message: "Fresh message",
        candidatePhotoIds: ["p1", "p3"],
        createdAt: "2024-01-03T00:00:00.000Z"
      },
      {
        id: "suggestion-2",
        projectId: "project-1",
        type: "collection",
        status: "new",
        title: "Collection refreshed",
        message: "Still accepted",
        candidatePhotoIds: ["p2", "p4"],
        createdAt: "2024-01-04T00:00:00.000Z"
      }
    ];

    const merged = upsertSuggestionRecords(existing, rescanned);

    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === "suggestion-1")).toMatchObject({
      title: "Fresh title",
      message: "Fresh message",
      status: "snoozed",
      candidatePhotoIds: ["p1", "p3"]
    });
    expect(merged.find((item) => item.id === "suggestion-2")).toMatchObject({
      title: "Collection refreshed",
      status: "accepted",
      acceptedMemoryId: "memory-99"
    });
  });

  it("supports watching and accepted lifecycle transitions without downgrading accepted suggestions", () => {
    const suggestions: Suggestion[] = [
      {
        id: "collection-1",
        projectId: "project-1",
        type: "collection",
        status: "new",
        title: "Pets",
        message: "Watching candidate",
        candidatePhotoIds: [],
        createdAt: "2024-01-01T00:00:00.000Z"
      },
      {
        id: "accepted-1",
        projectId: "project-1",
        type: "event",
        status: "accepted",
        title: "Trip",
        message: "Already accepted",
        candidatePhotoIds: [],
        acceptedMemoryId: "memory-1",
        createdAt: "2024-01-01T00:00:00.000Z"
      }
    ];

    const watching = updateSuggestionStatusRecords(suggestions, "collection-1", "watching");
    const stillAccepted = updateSuggestionStatusRecords(watching, "accepted-1", "dismissed");
    const markedAccepted = markSuggestionAccepted(watching, "collection-1", "memory-2");

    expect(watching.find((item) => item.id === "collection-1")?.status).toBe("watching");
    expect(stillAccepted.find((item) => item.id === "accepted-1")).toMatchObject({
      status: "accepted",
      acceptedMemoryId: "memory-1"
    });
    expect(markedAccepted.find((item) => item.id === "collection-1")).toMatchObject({
      status: "accepted",
      acceptedMemoryId: "memory-2"
    });
  });

  it("builds memory seeds from suggestions and assigns project-pool photos into memories explicitly", () => {
    const project = makeProject({
      id: "project-1",
      name: "Yearbook",
      projectType: "yearbook",
      timelineMode: "ongoing",
      includeFutureProjectPhotos: true,
      assistLevel: "balanced",
      styleIntensity: "warm",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    const memory = makeMemory({
      id: "memory-1",
      projectId: "project-1",
      title: "Hiking",
      kind: "collection",
      status: "watching",
      order: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    const photos: PhotoItem[] = [
      makePhoto({ id: "pool-1", projectId: "project-1", uri: "file:///pool-1.jpg", capturedAt: "2024-01-02T00:00:00.000Z", addedAt: "2024-01-02T00:00:00.000Z" }),
      makePhoto({ id: "pool-2", projectId: "project-1", uri: "file:///pool-2.jpg", capturedAt: "2024-01-03T00:00:00.000Z", addedAt: "2024-01-03T00:00:00.000Z" }),
      makePhoto({ id: "other-project", projectId: "project-2", uri: "file:///other.jpg", capturedAt: "2024-01-04T00:00:00.000Z", addedAt: "2024-01-04T00:00:00.000Z" }),
      makePhoto({ id: "already-assigned", projectId: "project-1", memoryId: "memory-9", uri: "file:///assigned.jpg", capturedAt: "2024-01-05T00:00:00.000Z", addedAt: "2024-01-05T00:00:00.000Z" })
    ];
    const collectionSuggestion: Suggestion = {
      id: "suggestion-collection",
      projectId: "project-1",
      type: "collection",
      status: "new",
      title: "Pets",
      message: "Collection candidate",
      candidatePhotoIds: [],
      createdAt: "2024-01-01T00:00:00.000Z"
    };

    const seed = buildMemorySeedFromSuggestion(collectionSuggestion);
    const nextState = applyPhotoAssignmentToMemory({
      memories: [memory],
      photos,
      projects: [project],
      memoryId: "memory-1",
      photoIds: ["pool-1", "other-project", "already-assigned"],
      now: "2024-02-01T00:00:00.000Z"
    });

    expect(seed).toEqual({
      title: "Pets",
      kind: "collection",
      status: "watching"
    });
    expect(nextState.memories[0]).toMatchObject({
      primaryPhotoId: "pool-1",
      updatedAt: "2024-02-01T00:00:00.000Z"
    });
    expect(nextState.photos.find((photo) => photo.id === "pool-1")?.memoryId).toBe("memory-1");
    expect(nextState.photos.find((photo) => photo.id === "other-project")?.memoryId).toBeUndefined();
    expect(nextState.photos.find((photo) => photo.id === "already-assigned")?.memoryId).toBe("memory-9");
    expect(nextState.projects[0].updatedAt).toBe("2024-02-01T00:00:00.000Z");
  });
});
