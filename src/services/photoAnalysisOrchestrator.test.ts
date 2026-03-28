import { describe, expect, it } from "@jest/globals";
import { PhotoItem, Project } from "../types";
import { runPhotoAnalysisOrchestrator } from "./photoAnalysisOrchestrator";
import { PHOTO_ANALYSIS_VERSION } from "./photoAnalysisTypes";

function makeProject(overrides: Partial<Project> & Pick<Project, "id" | "name" | "projectType" | "timelineMode" | "includeFutureProjectPhotos" | "assistLevel" | "styleIntensity" | "createdAt" | "updatedAt">): Project {
  return {
    ...overrides
  };
}

function makePhoto(overrides: Partial<PhotoItem> & Pick<PhotoItem, "id" | "projectId" | "uri" | "capturedAt" | "addedAt">): PhotoItem {
  return {
    ...overrides
  };
}

describe("photoAnalysisOrchestrator", () => {
  it("skips photos already analyzed at the current version and only merges new metadata for pending photos", async () => {
    const project = makeProject({
      id: "project-1",
      name: "Trip",
      projectType: "vacation",
      timelineMode: "ongoing",
      includeFutureProjectPhotos: true,
      assistLevel: "balanced",
      styleIntensity: "warm",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    const photos: PhotoItem[] = [
      makePhoto({
        id: "photo-current",
        projectId: "project-1",
        uri: "file:///current.jpg",
        capturedAt: "2024-01-02T00:00:00.000Z",
        addedAt: "2024-01-02T00:00:00.000Z",
        analysis: {
          analysisVersion: PHOTO_ANALYSIS_VERSION,
          analyzedAt: "2024-01-03T00:00:00.000Z",
          quality: {
            qualityScore: 0.66
          }
        }
      }),
      makePhoto({
        id: "photo-pending",
        projectId: "project-1",
        uri: "file:///pending.jpg",
        capturedAt: "2024-01-04T00:00:00.000Z",
        addedAt: "2024-01-04T00:00:00.000Z"
      })
    ];

    const result = await runPhotoAnalysisOrchestrator({
      project,
      photos,
      now: "2024-02-01T10:00:00.000Z",
      services: [
        ({ photo }) =>
          photo.id === "photo-pending"
            ? {
                quality: { qualityScore: 0.88 },
                sceneTags: [" outdoor ", "travel"],
                safeExternalTags: [" featured "]
              }
            : undefined
      ]
    });

    expect(result.skippedPhotoIds).toEqual(["photo-current"]);
    expect(result.analyzedPhotoIds).toEqual(["photo-pending"]);
    expect(result.photos.find((photo) => photo.id === "photo-current")?.analysis?.quality?.qualityScore).toBe(0.66);
    expect(result.photos.find((photo) => photo.id === "photo-pending")?.analysis).toEqual({
      analysisVersion: PHOTO_ANALYSIS_VERSION,
      analyzedAt: "2024-02-01T10:00:00.000Z",
      quality: {
        qualityScore: 0.88
      },
      sceneTags: ["outdoor", "travel"],
      safeExternalTags: ["featured"]
    });
  });

  it("can force reprocessing and preserves existing sensitive/local metadata while merging patches", async () => {
    const project = makeProject({
      id: "project-1",
      name: "Yearbook",
      projectType: "yearbook",
      timelineMode: "past",
      includeFutureProjectPhotos: false,
      assistLevel: "balanced",
      styleIntensity: "warm",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    const photos: PhotoItem[] = [
      makePhoto({
        id: "photo-1",
        projectId: "project-1",
        uri: "file:///photo-1.jpg",
        capturedAt: "2024-01-02T00:00:00.000Z",
        addedAt: "2024-01-02T00:00:00.000Z",
        analysis: {
          analysisVersion: PHOTO_ANALYSIS_VERSION,
          analyzedAt: "2024-01-03T00:00:00.000Z",
          quality: {
            qualityScore: 0.51
          },
          localOnly: {
            privateFaceDataRef: "face-ref-1"
          }
        }
      })
    ];

    const result = await runPhotoAnalysisOrchestrator({
      project,
      photos,
      force: true,
      now: "2024-02-10T08:00:00.000Z",
      services: [
        () => ({
          quality: { heroCandidateScore: 0.92 },
          subjectCues: { groupPhotoLike: true }
        })
      ]
    });

    expect(result.skippedPhotoIds).toEqual([]);
    expect(result.analyzedPhotoIds).toEqual(["photo-1"]);
    expect(result.photos[0]?.analysis).toEqual({
      analysisVersion: PHOTO_ANALYSIS_VERSION,
      analyzedAt: "2024-02-10T08:00:00.000Z",
      quality: {
        qualityScore: 0.51,
        heroCandidateScore: 0.92
      },
      subjectCues: {
        groupPhotoLike: true
      },
      localOnly: {
        privateFaceDataRef: "face-ref-1"
      }
    });
  });
});
