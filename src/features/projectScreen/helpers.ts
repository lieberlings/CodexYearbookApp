import type { Ionicons } from "@expo/vector-icons";
import { normalizePhotoLocation } from "../../lib/photoLocation";
import type { ProjectPhotoCluster } from "../../services/projectClusterEngine";
import type { PickedPhotoAsset } from "../../services/photoService";
import type {
  FinalizationSuggestion,
  Memory,
  PhotoItem,
  Project,
  Suggestion,
  SuggestionCandidatePhotoRef
} from "../../types";

export type MemoryComposerMode = "create" | "edit";
export type ProjectAddIntent = "memory" | "collection" | "suggestions";
export type StatusCardTone = "info" | "success" | "error" | "empty";
export type StatusCard = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  tone: StatusCardTone;
};

export type SuggestionScanState = "idle" | "scanning" | "empty" | "error" | "done";

export type SuggestionScanFeedback = {
  generatedCount: number;
  source: "manual" | "intake";
};

export type StagedAsset = {
  key: string;
} & PickedPhotoAsset;

export type ThumbnailChoice =
  | { kind: "existing"; photoId: string }
  | { kind: "staged"; stagedKey: string };

export type MemoryComposerOptions = {
  title?: string;
  photoIds?: string[];
  suggestionId?: string;
  stagedAssets?: StagedAsset[];
  collectionHooks?: string;
  thumbnailChoice?: ThumbnailChoice;
};

export const SUGGESTED_THEME_PAGE_LABELS = ["Pets", "Beach", "Birthdays", "Hiking", "Funny faces"];

export function orderKey(items: { id: string }[]): string {
  return items.map((item) => item.id).join("|");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function prioritizePrimary(photos: PhotoItem[], primaryPhotoId?: string): PhotoItem[] {
  if (!primaryPhotoId) {
    return photos;
  }
  const primary = photos.find((photo) => photo.id === primaryPhotoId);
  if (!primary) {
    return photos;
  }
  return [primary, ...photos.filter((photo) => photo.id !== primaryPhotoId)];
}

export function formatProjectStats(memoryCount: number, photoCount: number, pageCount: number): string {
  return `${pluralize(memoryCount, "Memory")} · ${pluralize(photoCount, "Photo")} · ${pluralize(pageCount, "Page")}`;
}

export function getMemoryKindLabel(kind: Memory["kind"]): string {
  switch (kind) {
    case "collection":
      return "Collection";
    case "hybrid":
      return "Hybrid";
    default:
      return "Event";
  }
}

export function formatSuggestionStatus(status: Suggestion["status"]): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "dismissed":
      return "Dismissed";
    case "watching":
      return "Watching";
    case "snoozed":
      return "Snoozed";
    default:
      return "New";
  }
}

export function getSuggestionTypeLabel(type: Suggestion["type"]): string {
  return type === "collection" ? "Collection" : "Event";
}

export function getSuggestionCandidateRefs(suggestion: Suggestion | null | undefined): SuggestionCandidatePhotoRef[] {
  return suggestion?.candidatePhotoRefs ?? [];
}

export function getSuggestionCandidateCount(suggestion: Suggestion): number {
  const refs = getSuggestionCandidateRefs(suggestion);
  return refs.length > 0 ? refs.length : suggestion.candidatePhotoIds.length;
}

export function getFinalizationTypeLabel(type: FinalizationSuggestion["type"]): string {
  switch (type) {
    case "missing-moment":
      return "Missing Moment";
    case "strongest-unused-photos":
      return "Unused Photos";
    default:
      return "Highlight Collection";
  }
}

export function getClusterTypeLabel(type: ProjectPhotoCluster["type"]): string {
  return type === "collection" ? "Collection-like" : "Event-like";
}

export function formatClusterTimeRange(cluster: ProjectPhotoCluster): string {
  if (!cluster.startTime && !cluster.endTime) {
    return "Unknown time";
  }
  const start = cluster.startTime ? new Date(cluster.startTime) : undefined;
  const end = cluster.endTime ? new Date(cluster.endTime) : undefined;
  if (!start || Number.isNaN(start.getTime())) {
    return "Unknown time";
  }
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!end || Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) {
    return startLabel;
  }
  return `${startLabel} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function formatClusterLocation(cluster: ProjectPhotoCluster): string {
  if (!cluster.locationSummary) {
    return "No GPS cluster cue";
  }
  if (!cluster.locationSummary.center || cluster.locationSummary.bucketCount > 1) {
    return `${cluster.locationSummary.locatedPhotoCount} geotagged photos across ${cluster.locationSummary.bucketCount} area bucket${cluster.locationSummary.bucketCount === 1 ? "" : "s"}`;
  }
  return `${cluster.locationSummary.locatedPhotoCount} geotagged photos in 1 area near ${cluster.locationSummary.center.latitude.toFixed(3)}, ${cluster.locationSummary.center.longitude.toFixed(3)}`;
}

export function buildStagedAssets(assets: PickedPhotoAsset[]): StagedAsset[] {
  return assets.map((asset, index) => ({
    key: `staged-${Date.now()}-${index}-${asset.fileName ?? "photo"}`,
    uri: asset.uri,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
    capturedAt: asset.capturedAt,
    location: normalizePhotoLocation(asset.location),
    importMetadata: asset.importMetadata
  }));
}

export function getThumbnailUri(
  choice: ThumbnailChoice | undefined,
  existingPhotos: PhotoItem[],
  stagedAssets: StagedAsset[],
  projectPhotos: PhotoItem[] = []
): string | undefined {
  if (!choice) {
    return undefined;
  }
  if (choice.kind === "existing") {
    return existingPhotos.find((photo) => photo.id === choice.photoId)?.uri
      ?? projectPhotos.find((photo) => photo.id === choice.photoId)?.uri;
  }
  return stagedAssets.find((asset) => asset.key === choice.stagedKey)?.uri;
}

export function resolveThumbnailPhotoId(
  choice: ThumbnailChoice | undefined,
  stagedAssets: StagedAsset[],
  createdPhotoIds: string[]
): string | undefined {
  if (!choice) {
    return undefined;
  }
  if (choice.kind === "existing") {
    return choice.photoId;
  }
  const stagedIndex = stagedAssets.findIndex((asset) => asset.key === choice.stagedKey);
  if (stagedIndex < 0) {
    return undefined;
  }
  return createdPhotoIds[stagedIndex];
}

export function parseCollectionHooks(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildSuggestionStateCard({
  suggestionScanState,
  suggestionScanError,
  lastSuggestionScanFeedback,
  suggestionCount
}: {
  suggestionScanState: SuggestionScanState;
  suggestionScanError: string | undefined;
  lastSuggestionScanFeedback: SuggestionScanFeedback | undefined;
  suggestionCount: number;
}): StatusCard | undefined {
  if (suggestionScanState === "scanning") {
    return {
      icon: "sync-outline" as const,
      title: "Scanning suggestions",
      message: "Checking on-device library metadata inside this project's date scope.",
      tone: "info" as const
    };
  }
  if (suggestionScanState === "error") {
    return {
      icon: "warning-outline" as const,
      title: "Suggestion scan failed",
      message: suggestionScanError ?? "The project is still usable. You can retry the scan at any time.",
      tone: "error" as const
    };
  }
  if (suggestionScanState === "done" && lastSuggestionScanFeedback) {
    return {
      icon: "checkmark-circle-outline" as const,
      title: "Suggestions updated",
      message:
        lastSuggestionScanFeedback.generatedCount > 0
          ? `${pluralize(lastSuggestionScanFeedback.generatedCount, "suggestion")} generated or refreshed from the current project scope${
              lastSuggestionScanFeedback.source === "intake" ? " after adding project photos." : "."
            }`
          : lastSuggestionScanFeedback.source === "intake"
            ? "Project photos were added and the automatic follow-up scan completed, but nothing strong surfaced yet."
            : "The scan completed, but nothing strong surfaced yet.",
      tone: "success" as const
    };
  }
  if (suggestionCount > 0) {
    return undefined;
  }
  if (suggestionScanState === "empty") {
    return {
      icon: "bulb-outline" as const,
      title: "No project suggestions found",
      message:
        "We scanned the current project scope but did not find a strong event signal yet. Try a wider date range or a library area with closely timed photos.",
      tone: "empty" as const
    };
  }
  return {
      icon: "search-outline" as const,
      title: "Suggestions ready to scan",
      message: "Use Scan Suggestions to find event-like memories from on-device library metadata.",
      tone: "empty" as const
    };
}

export function buildProjectPhotoStateCard({
  projectPhotoFeedback,
  projectPhotoCount,
  unassignedPhotoCount
}: {
  projectPhotoFeedback: StatusCard | undefined;
  projectPhotoCount: number;
  unassignedPhotoCount: number;
}): StatusCard | undefined {
  if (projectPhotoFeedback) {
    return projectPhotoFeedback;
  }
  if (projectPhotoCount === 0) {
    return {
      icon: "images-outline" as const,
      title: "No project photos yet",
      message: "Add photos directly to the project pool when you want them available for scans or later memory use.",
      tone: "empty" as const
    };
  }
  if (unassignedPhotoCount === 0) {
    return {
      icon: "albums-outline" as const,
      title: "Project pool is currently assigned",
      message:
        "This project already has photos, but they are all attached to memories right now. Add more project photos if you want a broader unassigned pool for scans or later memory additions.",
      tone: "info" as const
    };
  }
  return undefined;
}

export function buildFinalizationStateCard(
  project: Project | undefined,
  finalizationSuggestionCount: number
): StatusCard {
  if (!project || project.finalizationStatus === "idle") {
    return {
      icon: "flag-outline" as const,
      title: "Finalization is optional",
      message:
        "Use finalization near the end of a project to review accepted memories and theme pages before finishing the book.",
      tone: "empty" as const
    };
  }

  if (finalizationSuggestionCount === 0) {
    return {
      icon: "checkmark-done-outline" as const,
      title: "No finalization issues found",
      message:
        "This project is ready for a manual review pass. Accepted-memory finalization details are intentionally deferred for the MVP reset.",
      tone: "info" as const
    };
  }

  return {
    icon: project.finalizationStatus === "reviewed" ? "checkmark-circle-outline" as const : "sparkles-outline" as const,
    title:
      project.finalizationStatus === "reviewed"
        ? "Finalization reviewed"
        : "Finalization suggestions ready",
    message:
      project.finalizationStatus === "reviewed"
        ? "The project has been marked reviewed. You can revisit the memories manually before ordering."
        : "Use this as the project wrap-up checkpoint before previewing or ordering.",
    tone: project.finalizationStatus === "reviewed" ? ("success" as const) : ("info" as const)
  };
}
