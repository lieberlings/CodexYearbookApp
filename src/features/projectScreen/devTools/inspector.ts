import { formatPhotoLocation } from "../../../lib/photoLocation";
import type { detectPhotoFacesHeuristic } from "../../../services/faceDetectionService";
import type { NativeFaceDetectionResult } from "../../../services/nativeFaceDetection";
import type { NativeImageLabelingResult } from "../../../services/nativeImageLabeling";
import type { MediaLibraryAssetProbe } from "../../../services/photoService";
import { analyzePhotoSceneHeuristics, normalizeTagsFromNativeImageLabels } from "../../../services/sceneAnalysisService";
import type {
  PhotoAnalysisSignalSource,
  PhotoItem,
  PhotoMetadataResolutionKind,
  PhotoMetadataSource,
  PhotoNativeFaceMetadata,
  PhotoNativeImageLabelMetadata
} from "../../../types";

export type InspectorFieldValue = string | number | boolean | null | undefined;

export type InspectorDebugReportInput = {
  projectId: string;
  photo: PhotoItem;
  mediaLibraryProbe: MediaLibraryAssetProbe | null;
  mediaLibraryProbeBusy: boolean;
  nativeLabelProbe: NativeImageLabelingResult | null;
  nativeLabelProbeBusy: boolean;
  nativeFaceProbe: NativeFaceDetectionResult | null;
  nativeFaceProbeBusy: boolean;
  heuristicScenePreview: ReturnType<typeof analyzePhotoSceneHeuristics>;
  heuristicFacePreview: ReturnType<typeof detectPhotoFacesHeuristic>;
};

export function formatInspectorValue(value: InspectorFieldValue): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

export function formatLocationLabel(photo: PhotoItem): string {
  return formatPhotoLocation(photo.location);
}

export function formatImportMetadataSource(source: PhotoMetadataSource | undefined): string {
  switch (source) {
    case "media-library":
      return "Media Library asset info";
    case "picker":
      return "Picker EXIF";
    default:
      return "—";
  }
}

export function formatResolutionKind(kind: PhotoMetadataResolutionKind | undefined): string {
  switch (kind) {
    case "canonical-direct":
      return "Canonical asset id";
    case "canonical-recovered":
      return "Recovered canonical asset";
    case "picker-fallback":
      return "Picker fallback";
    default:
      return "Unknown";
  }
}

export function getCapturedAtSourceLabel(photo: PhotoItem): string {
  if (photo.importMetadata?.capturedAtSource) {
    return formatImportMetadataSource(photo.importMetadata.capturedAtSource);
  }
  if (photo.capturedAt) {
    return "Legacy stored value";
  }
  return "Unknown";
}

export function getLocationSourceLabel(photo: PhotoItem): string {
  if (photo.importMetadata?.locationSource) {
    return formatImportMetadataSource(photo.importMetadata.locationSource);
  }
  if (photo.location) {
    return "Legacy stored location";
  }
  return "No GPS metadata";
}

export function formatNativeLabels(labels: PhotoNativeImageLabelMetadata[] | undefined): string {
  return Array.isArray(labels) && labels.length > 0
    ? labels
        .map((label) => {
          const confidence = Math.round(label.confidence * 100);
          const normalized = label.normalizedTag ? ` -> ${label.normalizedTag}` : "";
          return `${label.text} (${confidence}%)${normalized}`;
        })
        .join("\n")
    : "—";
}

export function formatNativeLabelProbe(result: NativeImageLabelingResult | null, busy: boolean): string {
  if (busy) {
    return "Checking...";
  }
  if (!result) {
    return "—";
  }
  if (!result.available) {
    return result.error ?? "Native image labeling unavailable.";
  }
  if (result.labels.length === 0) {
    return "No labels returned.";
  }
  return result.labels
    .map((label) => {
      const confidence = Math.round(label.confidence * 100);
      const index = typeof label.index === "number" ? ` #${label.index}` : "";
      return `${label.text} (${confidence}%)${index}`;
    })
    .join("\n");
}

export function formatTagList(tags: string[] | undefined): string {
  return tags && tags.length > 0 ? tags.join(", ") : "—";
}

export function formatAnalysisSource(source: PhotoAnalysisSignalSource | undefined): string {
  switch (source) {
    case "android-mlkit-image-labeling":
      return "Android ML Kit image labeling";
    case "android-mlkit-face-detection":
      return "Android ML Kit face detection";
    case "heuristic-fallback":
      return "Heuristic fallback";
    default:
      return "Unknown";
  }
}

export function formatNativeFaces(faces: PhotoNativeFaceMetadata[] | undefined): string {
  return Array.isArray(faces) && faces.length > 0
    ? faces
        .map((face, index) => {
          const bounds = `${Math.round(face.bounds.width)}x${Math.round(face.bounds.height)} @ ${Math.round(
            face.bounds.x
          )},${Math.round(face.bounds.y)}`;
          const smile =
            typeof face.smilingProbability === "number"
              ? ` smile ${Math.round(face.smilingProbability * 100)}%`
              : "";
          return `Face ${index + 1}: ${bounds}${smile}`;
        })
        .join("\n")
    : "—";
}

export function formatNativeFaceProbe(result: NativeFaceDetectionResult | null, busy: boolean): string {
  if (busy) {
    return "Checking...";
  }
  if (!result) {
    return "—";
  }
  if (!result.available) {
    return result.error ?? "Native face detection unavailable.";
  }
  if (result.faces.length === 0) {
    return "No faces returned.";
  }
  return result.faces
    .map((face, index) => {
      const bounds = `${Math.round(face.bounds.width)}x${Math.round(face.bounds.height)} @ ${Math.round(
        face.bounds.x
      )},${Math.round(face.bounds.y)}`;
      const smile =
        typeof face.smilingProbability === "number" ? ` smile ${Math.round(face.smilingProbability * 100)}%` : "";
      return `Face ${index + 1}: ${bounds}${smile}`;
    })
    .join("\n");
}

export function buildInspectorDebugReport(input: InspectorDebugReportInput): string {
  const {
    projectId,
    photo,
    mediaLibraryProbe,
    mediaLibraryProbeBusy,
    nativeLabelProbe,
    nativeLabelProbeBusy,
    nativeFaceProbe,
    nativeFaceProbeBusy,
    heuristicScenePreview,
    heuristicFacePreview
  } = input;
  const report = {
    generatedAt: new Date().toISOString(),
    projectId,
    photo: {
      id: photo.id,
      memoryId: photo.memoryId,
      uri: photo.uri,
      width: photo.width,
      height: photo.height,
      capturedAt: photo.capturedAt,
      addedAt: photo.addedAt,
      location: photo.location,
      importMetadata: photo.importMetadata
    },
    probes: {
      mediaLibrary: {
        busy: mediaLibraryProbeBusy,
        result: mediaLibraryProbe
      },
      nativeImageLabels: {
        busy: nativeLabelProbeBusy,
        result: nativeLabelProbe,
        normalizedTags:
          nativeLabelProbe?.available === true
            ? normalizeTagsFromNativeImageLabels(nativeLabelProbe.labels)
            : undefined
      },
      nativeFaces: {
        busy: nativeFaceProbeBusy,
        result: nativeFaceProbe
      }
    },
    heuristicPreview: {
      scene: heuristicScenePreview,
      faces: heuristicFacePreview
    },
    persistedAnalysis: photo.analysis
  };

  return [
    "YEARBOOK_IMAGE_ANALYSIS_DEBUG_REPORT_START",
    JSON.stringify(report, null, 2),
    "YEARBOOK_IMAGE_ANALYSIS_DEBUG_REPORT_END"
  ].join("\n");
}
