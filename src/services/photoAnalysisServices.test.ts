import { describe, expect, it } from "@jest/globals";
import { PhotoItem, Project } from "../types";
import { buildNativeFacePatch, detectPhotoFacesHeuristic } from "./faceDetectionService";
import { analyzePhotoQuality } from "./photoQualityService";
import { analyzePhotoScene, buildNativeLabelPatch, normalizeTagsFromNativeImageLabels } from "./sceneAnalysisService";

function makeProject(overrides: Partial<Project> & Pick<Project, "id" | "name" | "projectType" | "timelineMode" | "includeFutureProjectPhotos" | "assistLevel" | "styleIntensity" | "createdAt" | "updatedAt">): Project {
  return {
    finalizationStatus: "idle",
    ...overrides
  };
}

function makePhoto(overrides: Partial<PhotoItem> & Pick<PhotoItem, "id" | "projectId" | "uri" | "capturedAt" | "addedAt">): PhotoItem {
  return {
    ...overrides
  };
}

describe("photo analysis services", () => {
  it("produces coarse quality signals from lightweight deterministic heuristics", () => {
    const strongPhoto = makePhoto({
      id: "strong",
      projectId: "project-1",
      uri: "file:///strong.jpg",
      width: 2400,
      height: 1600,
      capturedAt: "2024-07-10T12:00:00.000Z",
      addedAt: "2024-07-10T12:00:00.000Z",
      location: { latitude: 34.01, longitude: -118.49 }
    });
    const weakPhoto = makePhoto({
      id: "weak",
      projectId: "project-1",
      uri: "file:///weak.jpg",
      width: 640,
      height: 640,
      capturedAt: "2024-07-10T22:00:00.000Z",
      addedAt: "2024-07-10T22:00:00.000Z"
    });

    const strong = analyzePhotoQuality({
      photo: strongPhoto,
      projectPhotos: [strongPhoto, weakPhoto],
      now: "2024-07-11T00:00:00.000Z"
    });
    const weak = analyzePhotoQuality({
      photo: weakPhoto,
      projectPhotos: [strongPhoto, weakPhoto],
      now: "2024-07-11T00:00:00.000Z"
    });

    expect(strong?.quality?.qualityScore).toBeGreaterThan(weak?.quality?.qualityScore ?? 0);
    expect(strong?.quality?.heroCandidateScore).toBeGreaterThan(weak?.quality?.heroCandidateScore ?? 0);
    expect(strong?.quality?.isBlurry).toBe(false);
    expect(weak?.quality?.isBlurry).toBe(true);
    expect(weak?.quality?.isLowLight).toBe(true);
  });

  it("produces coarse scene and theme tags from aspect, timing, location, and local project context", async () => {
    const project = makeProject({
      id: "project-1",
      name: "Trip",
      projectType: "vacation",
      timelineMode: "past",
      includeFutureProjectPhotos: false,
      assistLevel: "balanced",
      styleIntensity: "warm",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
    const target = makePhoto({
      id: "target",
      projectId: "project-1",
      uri: "file:///target.jpg",
      width: 2200,
      height: 1200,
      capturedAt: "2024-07-10T18:30:00.000Z",
      addedAt: "2024-07-10T18:30:00.000Z",
      location: { latitude: 34.01, longitude: -118.49 },
      analysis: {
        analysisVersion: 2,
        analyzedAt: "2024-07-11T00:00:00.000Z",
        quality: {
          qualityScore: 0.82,
          heroCandidateScore: 0.91,
          isBlurry: false,
          isLowLight: false
        }
      }
    });
    const projectPhotos = [
      target,
      makePhoto({
        id: "cluster-1",
        projectId: "project-1",
        uri: "file:///cluster-1.jpg",
        capturedAt: "2024-07-10T17:00:00.000Z",
        addedAt: "2024-07-10T17:00:00.000Z"
      }),
      makePhoto({
        id: "cluster-2",
        projectId: "project-1",
        uri: "file:///cluster-2.jpg",
        capturedAt: "2024-07-10T17:30:00.000Z",
        addedAt: "2024-07-10T17:30:00.000Z"
      }),
      makePhoto({
        id: "cluster-3",
        projectId: "project-1",
        uri: "file:///cluster-3.jpg",
        capturedAt: "2024-07-10T19:00:00.000Z",
        addedAt: "2024-07-10T19:00:00.000Z"
      }),
      makePhoto({
        id: "cluster-4",
        projectId: "project-1",
        uri: "file:///cluster-4.jpg",
        capturedAt: "2024-07-10T19:45:00.000Z",
        addedAt: "2024-07-10T19:45:00.000Z"
      })
    ];

    const scene = await analyzePhotoScene({
      photo: target,
      project,
      projectPhotos,
      now: "2024-07-11T00:00:00.000Z"
    });

    expect(scene?.sceneTags).toEqual(expect.arrayContaining(["landscape", "outdoor", "scenic"]));
    expect(scene?.themeTags).toEqual(expect.arrayContaining(["nature-like", "party-like", "sunset-like"]));
    expect(scene?.sources?.scene).toBe("heuristic-fallback");
  });

  it("normalizes trusted native image labels into the restrained app tag vocabulary", () => {
    const tags = normalizeTagsFromNativeImageLabels([
      { text: "Beach", confidence: 0.91, index: 1 },
      { text: "Dog", confidence: 0.88, index: 2 },
      { text: "Vehicle", confidence: 0.49, index: 3 }
    ]);

    expect(tags).toEqual(["animal", "beach", "outdoor", "pet-like"]);
  });

  it("builds a native image-label patch with normalized scene/theme tags and raw labels separated", () => {
    const patch = buildNativeLabelPatch([
      { text: "Beach", confidence: 0.91, index: 1 },
      { text: "Sunset", confidence: 0.72, index: 2 },
      { text: "Vehicle", confidence: 0.49, index: 3 }
    ]);

    expect(patch).toMatchObject({
      sources: {
        scene: "android-mlkit-image-labeling"
      },
      sceneTags: ["beach", "outdoor", "scenic"],
      themeTags: ["sunset-like"],
      safeExternalTags: ["beach", "outdoor", "scenic", "sunset-like"],
      nativeLabels: [
        {
          source: "android-mlkit-image-labeling",
          text: "Beach",
          confidence: 0.91,
          index: 1,
          normalizedTag: "beach"
        },
        {
          source: "android-mlkit-image-labeling",
          text: "Sunset",
          confidence: 0.72,
          index: 2,
          normalizedTag: "sunset-like"
        }
      ]
    });
  });

  it("clears stale heuristic scene tags when native labels have no app-level mapping", () => {
    const patch = buildNativeLabelPatch([
      { text: "Fun", confidence: 0.91, index: 386 },
      { text: "Product", confidence: 0.88, index: 78 },
      { text: "Cool", confidence: 0.87, index: 303 }
    ]);

    expect(patch).toMatchObject({
      sources: {
        scene: "android-mlkit-image-labeling"
      },
      sceneTags: [],
      themeTags: [],
      safeExternalTags: [],
      nativeLabels: [
        {
          source: "android-mlkit-image-labeling",
          text: "Fun",
          confidence: 0.91,
          index: 386
        },
        {
          source: "android-mlkit-image-labeling",
          text: "Product",
          confidence: 0.88,
          index: 78
        },
        {
          source: "android-mlkit-image-labeling",
          text: "Cool",
          confidence: 0.87,
          index: 303
        }
      ]
    });
  });

  it("adds privacy-safe face groundwork from portrait/group cues without exposing identity metadata", () => {
    const portraitPhoto = makePhoto({
      id: "portrait",
      projectId: "project-1",
      uri: "file:///portrait.jpg",
      width: 900,
      height: 1500,
      capturedAt: "2024-07-10T10:00:00.000Z",
      addedAt: "2024-07-10T10:00:00.000Z",
      analysis: {
        analysisVersion: 3,
        analyzedAt: "2024-07-11T00:00:00.000Z",
        subjectCues: {
          portraitLike: true
        }
      }
    });
    const groupPhoto = makePhoto({
      id: "group",
      projectId: "project-1",
      uri: "file:///group.jpg",
      width: 1800,
      height: 1200,
      capturedAt: "2024-07-10T18:30:00.000Z",
      addedAt: "2024-07-10T18:30:00.000Z",
      analysis: {
        analysisVersion: 3,
        analyzedAt: "2024-07-11T00:00:00.000Z",
        subjectCues: {
          groupPhotoLike: true
        }
      }
    });

    const portraitFaces = detectPhotoFacesHeuristic({
      photo: portraitPhoto,
      projectPhotos: [portraitPhoto, groupPhoto],
      now: "2024-07-11T00:00:00.000Z"
    });
    const groupFaces = detectPhotoFacesHeuristic({
      photo: groupPhoto,
      projectPhotos: [portraitPhoto, groupPhoto],
      now: "2024-07-11T00:00:00.000Z"
    });

    expect(portraitFaces).toEqual({
      sources: {
        faces: "heuristic-fallback"
      },
      faces: {
        faceCount: 1,
        hasFace: true,
        hasMultipleFaces: false
      }
    });
    expect(groupFaces).toEqual({
      sources: {
        faces: "heuristic-fallback"
      },
      faces: {
        faceCount: 2,
        hasFace: true,
        hasMultipleFaces: true
      }
    });
    expect("localOnly" in (groupFaces ?? {})).toBe(false);
  });

  it("normalizes native face detection into face metadata without identity recognition", () => {
    const photo = makePhoto({
      id: "native-face",
      projectId: "project-1",
      uri: "file:///native-face.jpg",
      width: 1000,
      height: 1000,
      capturedAt: "2024-07-10T10:00:00.000Z",
      addedAt: "2024-07-10T10:00:00.000Z"
    });

    const patch = buildNativeFacePatch(
      [
        {
          bounds: { x: 100, y: 120, width: 260, height: 280 },
          smilingProbability: 0.65
        }
      ],
      {
        photo,
        projectPhotos: [photo],
        now: "2024-07-11T00:00:00.000Z"
      }
    );

    expect(patch).toEqual({
      sources: {
        faces: "android-mlkit-face-detection"
      },
      faces: {
        faceCount: 1,
        hasFace: true,
        hasMultipleFaces: false
      },
      subjectCues: {
        portraitLike: true,
        groupPhotoLike: undefined
      },
      nativeFaces: [
        {
          source: "android-mlkit-face-detection",
          bounds: { x: 100, y: 120, width: 260, height: 280 },
          smilingProbability: 0.65
        }
      ]
    });
  });
});
