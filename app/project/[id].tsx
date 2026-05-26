import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaLibrarySelectionModal } from "../../src/components/MediaLibrarySelectionModal";
import { useAppData } from "../../src/context/AppContext";
import { formatPhotoLocation, normalizePhotoLocation } from "../../src/lib/photoLocation";
import { exportProjectToPdf, sharePdf } from "../../src/services/exportService";
import { detectPhotoFacesHeuristic } from "../../src/services/faceDetectionService";
import { detectFacesLocally, NativeFaceDetectionResult } from "../../src/services/nativeFaceDetection";
import {
  generateFinalizationSuggestionsForProject,
  suggestCandidatePhotosForMemory,
  suggestCollectionCandidatePhotos
} from "../../src/services/promptEngine";
import { labelImageLocally, NativeImageLabelingResult } from "../../src/services/nativeImageLabeling";
import { analyzePhotoSceneHeuristics, normalizeTagsFromNativeImageLabels } from "../../src/services/sceneAnalysisService";
import {
  generateProjectPhotoClusters,
  ProjectPhotoCluster
} from "../../src/services/projectClusterEngine";
import {
  MediaLibraryAssetProbe,
  PickedPhotoAsset,
  pickPhotoFromMediaLibraryByAssetId,
  pickPhotosFromMediaLibraryByAssetIds,
  probeMediaLibraryAssetMetadata
} from "../../src/services/photoService";
import { useEditorStore } from "../../src/state/editorStore";
import {
  FinalizationSuggestion,
  Memory,
  PhotoAnalysisSignalSource,
  PhotoItem,
  PhotoNativeFaceMetadata,
  PhotoNativeImageLabelMetadata,
  PhotoMetadataResolutionKind,
  PhotoMetadataSource,
  Suggestion
} from "../../src/types";

type MemoryComposerMode = "create" | "edit";
type ProjectAddIntent = "memory" | "collection" | "suggestions";
type StatusCardTone = "info" | "success" | "error" | "empty";
type StatusCard = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  tone: StatusCardTone;
};

type StagedAsset = {
  key: string;
} & PickedPhotoAsset;

type ThumbnailChoice =
  | { kind: "existing"; photoId: string }
  | { kind: "staged"; stagedKey: string };

type InspectorFieldValue = string | number | boolean | null | undefined;

const DEV_TOOLS_ENABLED = __DEV__;
const INLINE_PROJECT_SECTIONS_ENABLED = false;
const SUGGESTED_THEME_PAGE_LABELS = ["Pets", "Beach", "Birthdays", "Hiking", "Funny faces"];
type InspectorDebugReportInput = {
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

function orderKey(items: { id: string }[]): string {
  return items.map((item) => item.id).join("|");
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function prioritizePrimary(photos: PhotoItem[], primaryPhotoId?: string): PhotoItem[] {
  if (!primaryPhotoId) {
    return photos;
  }
  const primary = photos.find((photo) => photo.id === primaryPhotoId);
  if (!primary) {
    return photos;
  }
  return [primary, ...photos.filter((photo) => photo.id !== primaryPhotoId)];
}

function formatProjectStats(memoryCount: number, photoCount: number, pageCount: number): string {
  return `${pluralize(memoryCount, "Memory")} | ${pluralize(photoCount, "Photo")} | ${pluralize(pageCount, "Page")}`;
}

function getMemoryKindLabel(kind: Memory["kind"]): string {
  switch (kind) {
    case "collection":
      return "Collection";
    case "hybrid":
      return "Hybrid";
    default:
      return "Event";
  }
}

function formatInspectorValue(value: InspectorFieldValue): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function formatLocationLabel(photo: PhotoItem): string {
  return formatPhotoLocation(photo.location);
}

function formatImportMetadataSource(source: PhotoMetadataSource | undefined): string {
  switch (source) {
    case "media-library":
      return "Media Library asset info";
    case "picker":
      return "Picker EXIF";
    default:
      return "—";
  }
}

function formatResolutionKind(kind: PhotoMetadataResolutionKind | undefined): string {
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

function getCapturedAtSourceLabel(photo: PhotoItem): string {
  if (photo.importMetadata?.capturedAtSource) {
    return formatImportMetadataSource(photo.importMetadata.capturedAtSource);
  }
  if (photo.capturedAt) {
    return "Legacy stored value";
  }
  return "Unknown";
}

function getLocationSourceLabel(photo: PhotoItem): string {
  if (photo.importMetadata?.locationSource) {
    return formatImportMetadataSource(photo.importMetadata.locationSource);
  }
  if (photo.location) {
    return "Legacy stored location";
  }
  return "No GPS metadata";
}

function formatNativeLabels(labels: PhotoNativeImageLabelMetadata[] | undefined): string {
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

function formatNativeLabelProbe(result: NativeImageLabelingResult | null, busy: boolean): string {
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

function formatTagList(tags: string[] | undefined): string {
  return tags && tags.length > 0 ? tags.join(", ") : "—";
}

function formatAnalysisSource(source: PhotoAnalysisSignalSource | undefined): string {
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

function formatNativeFaces(faces: PhotoNativeFaceMetadata[] | undefined): string {
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

function formatNativeFaceProbe(result: NativeFaceDetectionResult | null, busy: boolean): string {
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

function buildInspectorDebugReport(input: InspectorDebugReportInput): string {
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

function InspectorField({ label, value }: { label: string; value: InspectorFieldValue }) {
  return (
    <View style={styles.analysisFieldRow}>
      <Text style={styles.analysisFieldLabel}>{label}</Text>
      <Text selectable style={styles.analysisFieldValue}>
        {formatInspectorValue(value)}
      </Text>
    </View>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.analysisSection}>
      <Text style={styles.analysisSectionTitle}>{title}</Text>
      <View style={styles.analysisSectionBody}>{children}</View>
    </View>
  );
}

function formatSuggestionStatus(status: Suggestion["status"]): string {
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

function getSuggestionStatusStyle(status: Suggestion["status"]) {
  switch (status) {
    case "accepted":
      return {
        badge: styles.suggestionStatusAccepted,
        text: styles.suggestionStatusAcceptedText
      };
    case "dismissed":
      return {
        badge: styles.suggestionStatusDismissed,
        text: styles.suggestionStatusDismissedText
      };
    case "watching":
      return {
        badge: styles.suggestionStatusWatching,
        text: styles.suggestionStatusWatchingText
      };
    case "snoozed":
      return {
        badge: styles.suggestionStatusSnoozed,
        text: styles.suggestionStatusSnoozedText
      };
    default:
      return {
        badge: styles.suggestionStatusNew,
        text: styles.suggestionStatusNewText
      };
  }
}

function getSuggestionTypeLabel(type: Suggestion["type"]): string {
  return type === "collection" ? "Collection" : "Event";
}

function getFinalizationTypeLabel(type: FinalizationSuggestion["type"]): string {
  switch (type) {
    case "missing-moment":
      return "Missing Moment";
    case "strongest-unused-photos":
      return "Unused Photos";
    default:
      return "Highlight Collection";
  }
}

function getClusterTypeLabel(type: ProjectPhotoCluster["type"]): string {
  return type === "collection" ? "Collection-like" : "Event-like";
}

function formatClusterTimeRange(cluster: ProjectPhotoCluster): string {
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

function formatClusterLocation(cluster: ProjectPhotoCluster): string {
  if (!cluster.locationSummary) {
    return "No GPS cluster cue";
  }
  if (!cluster.locationSummary.center || cluster.locationSummary.bucketCount > 1) {
    return `${cluster.locationSummary.locatedPhotoCount} geotagged photos across ${cluster.locationSummary.bucketCount} area bucket${cluster.locationSummary.bucketCount === 1 ? "" : "s"}`;
  }
  return `${cluster.locationSummary.locatedPhotoCount} geotagged photos in 1 area near ${cluster.locationSummary.center.latitude.toFixed(3)}, ${cluster.locationSummary.center.longitude.toFixed(3)}`;
}

function buildStagedAssets(assets: PickedPhotoAsset[]): StagedAsset[] {
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

function getThumbnailUri(
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

function resolveThumbnailPhotoId(
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

function parseCollectionHooks(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function MemoryCollagePreview({ photos }: { photos: PhotoItem[] }) {
  if (photos.length === 0) {
    return (
      <View style={[styles.previewPanel, styles.previewEmpty]}>
        <Ionicons name="images-outline" size={34} color="#6b7da7" />
        <Text style={styles.previewEmptyText}>Add photos inside the memory</Text>
      </View>
    );
  }

  if (photos.length === 1) {
    return (
      <View style={styles.previewPanel}>
        <Image source={{ uri: photos[0]?.uri }} style={styles.previewSingle} />
      </View>
    );
  }

  if (photos.length === 2) {
    return (
      <View style={styles.previewPanel}>
        <View style={styles.previewRow}>
          {photos.slice(0, 2).map((photo) => (
            <Image key={photo.id} source={{ uri: photo.uri }} style={styles.previewHalf} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewPanel}>
      <View style={styles.previewRow}>
        {photos.slice(0, 3).map((photo, index) => {
          const remaining = photos.length - 3;
          const isOverflow = index === 2 && remaining > 0;
          return (
            <View key={photo.id} style={styles.previewThirdWrap}>
              <Image source={{ uri: photo.uri }} style={styles.previewThird} />
              {isOverflow ? (
                <View style={styles.previewOverlay}>
                  <Text style={styles.previewOverlayText}>{`+${remaining}`}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ProjectDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const insets = useSafeAreaInsets();
  const {
    getProjectById,
    getMemoriesByProjectId,
    getPhotosByProjectId,
    getUnassignedPhotosByProjectId,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    analyzeProjectPhotos,
    getSuggestionsByProjectId,
    scanProjectSuggestions,
    linkSuggestionToMemory,
    keepWatchingSuggestion,
    dismissSuggestion,
    snoozeSuggestion,
    startProjectFinalization,
    completeProjectFinalization,
    createMemory,
    updateMemory,
    deleteMemory,
    reorderMemory,
    updateProject,
    deleteProject,
    pickProjectThumbnail,
    setMemoryPrimaryPhoto,
    addPhotoAssetsToMemory,
    addPhotoAssetsToProject,
    assignPhotosToMemory
  } = useAppData();
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);

  const [exporting, setExporting] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [projectMenuVisible, setProjectMenuVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<MemoryComposerMode>("create");
  const [composerMemoryId, setComposerMemoryId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerMemoryKind, setComposerMemoryKind] = useState<Memory["kind"]>("event");
  const [composerCollectionHooks, setComposerCollectionHooks] = useState("");
  const [composerSelectedProjectPhotoIds, setComposerSelectedProjectPhotoIds] = useState<string[]>([]);
  const [composerSourceSuggestionId, setComposerSourceSuggestionId] = useState<string | null>(null);
  const [composerStagedAssets, setComposerStagedAssets] = useState<StagedAsset[]>([]);
  const [composerThumbnailChoice, setComposerThumbnailChoice] = useState<ThumbnailChoice | undefined>(undefined);
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerPicking, setComposerPicking] = useState(false);
  const [projectMenuBusy, setProjectMenuBusy] = useState(false);
  const [memoryListData, setMemoryListData] = useState<Memory[]>([]);
  const [pendingMemoryOrderKey, setPendingMemoryOrderKey] = useState<string | undefined>(undefined);
  const [scanningSuggestions, setScanningSuggestions] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [suggestionScanState, setSuggestionScanState] = useState<"idle" | "scanning" | "empty" | "error" | "done">("idle");
  const [suggestionScanError, setSuggestionScanError] = useState<string | undefined>(undefined);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [suggestionReviewId, setSuggestionReviewId] = useState<string | null>(null);
  const [suggestionSelectedPhotoIds, setSuggestionSelectedPhotoIds] = useState<string[]>([]);
  const [devToolsExpanded, setDevToolsExpanded] = useState(false);
  const [clusterInspectorExpanded, setClusterInspectorExpanded] = useState(false);
  const [clusterAnalysisBusy, setClusterAnalysisBusy] = useState(false);
  const [clusterAnalysisFeedback, setClusterAnalysisFeedback] = useState<StatusCard | undefined>(undefined);
  const [showDismissedSuggestions, setShowDismissedSuggestions] = useState(false);
  const [projectPhotoIntakeBusy, setProjectPhotoIntakeBusy] = useState(false);
  const [projectPhotoFeedback, setProjectPhotoFeedback] = useState<StatusCard | undefined>(undefined);
  const [analysisInspectorVisible, setAnalysisInspectorVisible] = useState(false);
  const [analysisInspectorPhotoId, setAnalysisInspectorPhotoId] = useState<string | null>(null);
  const [analysisInspectorBusy, setAnalysisInspectorBusy] = useState(false);
  const [analysisInspectorFeedback, setAnalysisInspectorFeedback] = useState<StatusCard | undefined>(undefined);
  const [analysisInspectorProbe, setAnalysisInspectorProbe] = useState<MediaLibraryAssetProbe | null>(null);
  const [analysisInspectorProbeBusy, setAnalysisInspectorProbeBusy] = useState(false);
  const [nativeLabelProbe, setNativeLabelProbe] = useState<NativeImageLabelingResult | null>(null);
  const [nativeLabelProbeBusy, setNativeLabelProbeBusy] = useState(false);
  const [nativeFaceProbe, setNativeFaceProbe] = useState<NativeFaceDetectionResult | null>(null);
  const [nativeFaceProbeBusy, setNativeFaceProbeBusy] = useState(false);
  const [projectPhotoPickerVisible, setProjectPhotoPickerVisible] = useState(false);
  const [projectPhotoPickerBusy, setProjectPhotoPickerBusy] = useState(false);
  const [composerMediaLibraryVisible, setComposerMediaLibraryVisible] = useState(false);
  const [mediaLibraryPickerVisible, setMediaLibraryPickerVisible] = useState(false);
  const [mediaLibraryProbeBusy, setMediaLibraryProbeBusy] = useState(false);
  const [lastSuggestionScanFeedback, setLastSuggestionScanFeedback] = useState<
    | {
        generatedCount: number;
        source: "manual" | "intake";
      }
    | undefined
  >(undefined);
  const [candidateReviewMemoryId, setCandidateReviewMemoryId] = useState<string | null>(null);
  const [candidateSelectedPhotoIds, setCandidateSelectedPhotoIds] = useState<string[]>([]);
  const [finalizationExpanded, setFinalizationExpanded] = useState(false);
  const [finalizationReviewSuggestion, setFinalizationReviewSuggestion] = useState<FinalizationSuggestion | null>(null);

  const project = getProjectById(projectId);
  const memories = useMemo(() => getMemoriesByProjectId(projectId), [getMemoriesByProjectId, projectId]);
  const projectPhotos = useMemo(() => getPhotosByProjectId(projectId), [getPhotosByProjectId, projectId]);
  const unassignedProjectPhotos = useMemo(
    () => getUnassignedPhotosByProjectId(projectId),
    [getUnassignedPhotosByProjectId, projectId]
  );
  const projectPhotoPreview = useMemo(
    () => [...unassignedProjectPhotos].slice(-6).reverse(),
    [unassignedProjectPhotos]
  );
  const projectClusters = useMemo(
    () => generateProjectPhotoClusters(projectId, projectPhotos),
    [projectId, projectPhotos]
  );
  const topProjectClusters = useMemo(() => projectClusters.slice(0, 8), [projectClusters]);
  const inspectorSelectablePhotos = useMemo(
    () =>
      [...projectPhotos].sort((a, b) => {
        const aDate = a.capturedAt || a.addedAt;
        const bDate = b.capturedAt || b.addedAt;
        return bDate.localeCompare(aDate);
      }),
    [projectPhotos]
  );
  const selectedInspectorPhoto = useMemo(
    () =>
      analysisInspectorPhotoId
        ? inspectorSelectablePhotos.find((photo) => photo.id === analysisInspectorPhotoId) ?? null
        : null,
    [analysisInspectorPhotoId, inspectorSelectablePhotos]
  );
  const heuristicScenePreview = useMemo(
    () =>
      selectedInspectorPhoto
        ? analyzePhotoSceneHeuristics({
            photo: selectedInspectorPhoto,
            project,
            projectPhotos,
            now: new Date().toISOString()
          })
        : undefined,
    [project, projectPhotos, selectedInspectorPhoto]
  );
  const heuristicFacePreview = useMemo(
    () =>
      selectedInspectorPhoto
        ? detectPhotoFacesHeuristic({
            photo: {
              ...selectedInspectorPhoto,
              analysis: {
                ...selectedInspectorPhoto.analysis,
                subjectCues: selectedInspectorPhoto.analysis?.subjectCues ?? heuristicScenePreview?.subjectCues
              }
            },
            project,
            projectPhotos,
            now: new Date().toISOString()
          })
        : undefined,
    [heuristicScenePreview, project, projectPhotos, selectedInspectorPhoto]
  );
  const inspectorDebugReport = useMemo(
    () =>
      selectedInspectorPhoto
        ? buildInspectorDebugReport({
            projectId,
            photo: selectedInspectorPhoto,
            mediaLibraryProbe: analysisInspectorProbe,
            mediaLibraryProbeBusy: analysisInspectorProbeBusy,
            nativeLabelProbe,
            nativeLabelProbeBusy,
            nativeFaceProbe,
            nativeFaceProbeBusy,
            heuristicScenePreview,
            heuristicFacePreview
          })
        : "",
    [
      analysisInspectorProbe,
      analysisInspectorProbeBusy,
      heuristicFacePreview,
      heuristicScenePreview,
      nativeFaceProbe,
      nativeFaceProbeBusy,
      nativeLabelProbe,
      nativeLabelProbeBusy,
      projectId,
      selectedInspectorPhoto
    ]
  );
  const candidatePhotosByMemoryId = useMemo(
    () =>
      new Map(
        memories.map((memory) => [
          memory.id,
          suggestCandidatePhotosForMemory(memory, getPhotosByMemoryId(memory.id), unassignedProjectPhotos)
        ])
      ),
    [getPhotosByMemoryId, memories, unassignedProjectPhotos]
  );

  useEffect(() => {
    setMemoryListData((prev) => (prev.length === 0 ? memories : prev));
  }, [memories]);

  useEffect(() => {
    if (!analysisInspectorVisible) {
      return;
    }

    if (!analysisInspectorPhotoId || !inspectorSelectablePhotos.some((photo) => photo.id === analysisInspectorPhotoId)) {
      setAnalysisInspectorPhotoId(inspectorSelectablePhotos[0]?.id ?? null);
    }
  }, [analysisInspectorPhotoId, analysisInspectorVisible, inspectorSelectablePhotos]);

  useEffect(() => {
    let cancelled = false;

    async function runProbe() {
      if (!analysisInspectorVisible || !selectedInspectorPhoto) {
        if (!cancelled) {
          setAnalysisInspectorProbe(null);
          setAnalysisInspectorProbeBusy(false);
        }
        return;
      }

      setAnalysisInspectorProbeBusy(true);
      const probe = await probeMediaLibraryAssetMetadata(selectedInspectorPhoto.importMetadata?.assetId);
      if (!cancelled) {
        setAnalysisInspectorProbe(probe);
        setAnalysisInspectorProbeBusy(false);
      }
    }

    void runProbe();
    return () => {
      cancelled = true;
    };
  }, [analysisInspectorVisible, selectedInspectorPhoto]);

  useEffect(() => {
    let cancelled = false;

    async function runNativeFaceProbe() {
      if (!analysisInspectorVisible || !selectedInspectorPhoto) {
        if (!cancelled) {
          setNativeFaceProbe(null);
          setNativeFaceProbeBusy(false);
        }
        return;
      }

      setNativeFaceProbeBusy(true);
      const result = await detectFacesLocally(selectedInspectorPhoto.uri);
      if (!cancelled) {
        setNativeFaceProbe(result);
        setNativeFaceProbeBusy(false);
      }
    }

    void runNativeFaceProbe();
    return () => {
      cancelled = true;
    };
  }, [analysisInspectorVisible, selectedInspectorPhoto]);

  useEffect(() => {
    let cancelled = false;

    async function runNativeLabelProbe() {
      if (!analysisInspectorVisible || !selectedInspectorPhoto) {
        if (!cancelled) {
          setNativeLabelProbe(null);
          setNativeLabelProbeBusy(false);
        }
        return;
      }

      setNativeLabelProbeBusy(true);
      const result = await labelImageLocally(selectedInspectorPhoto.uri);
      if (!cancelled) {
        setNativeLabelProbe(result);
        setNativeLabelProbeBusy(false);
      }
    }

    void runNativeLabelProbe();
    return () => {
      cancelled = true;
    };
  }, [analysisInspectorVisible, selectedInspectorPhoto]);

  useEffect(() => {
    const contextOrder = orderKey(memories);
    const localOrder = orderKey(memoryListData);

    if (pendingMemoryOrderKey) {
      if (contextOrder === pendingMemoryOrderKey) {
        setPendingMemoryOrderKey(undefined);
        if (localOrder !== contextOrder) {
          setMemoryListData(memories);
        }
      }
      return;
    }

    if (localOrder !== contextOrder) {
      setMemoryListData(memories);
    }
  }, [memories, memoryListData, pendingMemoryOrderKey]);

  const projectStats = useMemo(() => {
    let pageCount = 0;
    for (const memory of memories) {
      pageCount += getPageSectionsByMemoryId(memory.id).length;
    }
    return {
      memoryCount: memories.length,
      photoCount: projectPhotos.length,
      pageCount,
      text: formatProjectStats(memories.length, projectPhotos.length, pageCount)
    };
  }, [getPageSectionsByMemoryId, memories, projectPhotos.length]);

  useEffect(() => {
    if (project?.finalizationStatus && project.finalizationStatus !== "idle") {
      setFinalizationExpanded(true);
    }
  }, [project?.finalizationStatus]);

  const finalizationSuggestions = useMemo(
    () => generateFinalizationSuggestionsForProject(projectId, memories, projectPhotos),
    [memories, projectId, projectPhotos]
  );
  const missingMomentFinalizationSuggestions = useMemo(
    () => finalizationSuggestions.filter((suggestion) => suggestion.type === "missing-moment"),
    [finalizationSuggestions]
  );
  const strongestUnusedFinalizationSuggestions = useMemo(
    () => finalizationSuggestions.filter((suggestion) => suggestion.type === "strongest-unused-photos"),
    [finalizationSuggestions]
  );
  const highlightFinalizationSuggestions = useMemo(
    () => finalizationSuggestions.filter((suggestion) => suggestion.type === "highlight-collection"),
    [finalizationSuggestions]
  );
  const finalizationSummary = useMemo(() => {
    if (project?.finalizationStatus === "reviewed") {
      return "Reviewed";
    }
    if (project?.finalizationStatus === "in-progress") {
      return "In progress";
    }
    return "Optional end-stage review";
  }, [project?.finalizationStatus]);
  const finalizationReviewPhotos = useMemo(
    () =>
      finalizationReviewSuggestion
        ? finalizationReviewSuggestion.candidatePhotoIds
            .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
            .filter((photo): photo is PhotoItem => Boolean(photo))
        : [],
    [finalizationReviewSuggestion, projectPhotos]
  );

  const projectSuggestions = useMemo(
    () =>
      getSuggestionsByProjectId(projectId)
        .sort((a, b) => {
          const statusWeight = { new: 0, watching: 1, snoozed: 2, accepted: 3, dismissed: 4 } as const;
          const statusDelta = statusWeight[a.status] - statusWeight[b.status];
          if (statusDelta !== 0) {
            return statusDelta;
          }
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [getSuggestionsByProjectId, projectId]
  );

  const newSuggestions = useMemo(
    () => projectSuggestions.filter((suggestion) => suggestion.status === "new"),
    [projectSuggestions]
  );
  const snoozedSuggestions = useMemo(
    () => projectSuggestions.filter((suggestion) => suggestion.status === "snoozed"),
    [projectSuggestions]
  );
  const watchingSuggestions = useMemo(
    () => projectSuggestions.filter((suggestion) => suggestion.status === "watching"),
    [projectSuggestions]
  );
  const acceptedSuggestions = useMemo(
    () => projectSuggestions.filter((suggestion) => suggestion.status === "accepted"),
    [projectSuggestions]
  );
  const dismissedSuggestions = useMemo(
    () => projectSuggestions.filter((suggestion) => suggestion.status === "dismissed"),
    [projectSuggestions]
  );

  const suggestionSummary = useMemo(() => {
    const parts: string[] = [];
    if (newSuggestions.length > 0) {
      parts.push(`${pluralize(newSuggestions.length, "new suggestion")}`);
    }
    if (watchingSuggestions.length > 0) {
      parts.push(`${pluralize(watchingSuggestions.length, "watching suggestion")}`);
    }
    if (snoozedSuggestions.length > 0) {
      parts.push(`${pluralize(snoozedSuggestions.length, "snoozed suggestion")}`);
    }
    if (acceptedSuggestions.length > 0) {
      parts.push(`${pluralize(acceptedSuggestions.length, "accepted suggestion")}`);
    }
    if (dismissedSuggestions.length > 0) {
      parts.push(`${pluralize(dismissedSuggestions.length, "dismissed suggestion")}`);
    }
    return parts.join(" | ");
  }, [
    acceptedSuggestions.length,
    dismissedSuggestions.length,
    newSuggestions.length,
    snoozedSuggestions.length,
    watchingSuggestions.length
  ]);
  const suggestionReview = useMemo(
    () => projectSuggestions.find((suggestion) => suggestion.id === suggestionReviewId) ?? null,
    [projectSuggestions, suggestionReviewId]
  );
  const suggestionReviewPhotos = useMemo(
    () =>
      suggestionReview
        ? suggestionReview.candidatePhotoIds
            .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
            .filter((photo): photo is PhotoItem => Boolean(photo))
        : [],
    [projectPhotos, suggestionReview]
  );

  const suggestionStateCard = useMemo(() => {
    if (suggestionScanState === "scanning") {
      return {
        icon: "sync-outline" as const,
        title: "Scanning suggestions",
        message: "Checking this project's photo scope for event and collection ideas.",
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
    if (projectSuggestions.length > 0) {
      return undefined;
    }
    if (suggestionScanState === "empty") {
      return {
        icon: "bulb-outline" as const,
        title: "No project suggestions found",
        message:
          "We scanned the current project scope but did not find a strong event or collection signal yet. Try closely timed photos, geotagged photos, or a wider project pool.",
        tone: "empty" as const
      };
    }
    if (projectStats.photoCount === 0) {
      return {
        icon: "images-outline" as const,
        title: "Suggestions need photos",
        message: "Add photos to the project or to memories, then run Scan Suggestions to test project-scoped event detection.",
        tone: "empty" as const
      };
    }
    return {
        icon: "search-outline" as const,
        title: "Suggestions ready to scan",
        message: "Use Scan Suggestions to generate project-scoped event and collection suggestions.",
        tone: "empty" as const
      };
  }, [lastSuggestionScanFeedback, projectStats.photoCount, projectSuggestions.length, suggestionScanError, suggestionScanState]);

  const projectPhotoStateCard = useMemo(() => {
    if (projectPhotoFeedback) {
      return projectPhotoFeedback;
    }
    if (projectPhotos.length === 0) {
      return {
        icon: "images-outline" as const,
        title: "No project photos yet",
        message: "Add photos directly to the project pool when you want them available for scans or later memory use.",
        tone: "empty" as const
      };
    }
    if (unassignedProjectPhotos.length === 0) {
      return {
        icon: "albums-outline" as const,
        title: "Project pool is currently assigned",
        message:
          "This project already has photos, but they are all attached to memories right now. Add more project photos if you want a broader unassigned pool for scans or later memory additions.",
        tone: "info" as const
      };
    }
    return undefined;
  }, [projectPhotoFeedback, projectPhotos.length, unassignedProjectPhotos.length]);

  const finalizationStateCard = useMemo<StatusCard>(() => {
    if (!project || project.finalizationStatus === "idle") {
      return {
        icon: "flag-outline" as const,
        title: "Finalization is optional",
        message:
          "Use finalization near the end of a project to review accepted memories and theme pages before finishing the book.",
        tone: "empty" as const
      };
    }

    if (finalizationSuggestions.length === 0) {
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
  }, [finalizationSuggestions.length, project]);

  const composerMemory = useMemo(
    () => (composerMemoryId ? memories.find((memory) => memory.id === composerMemoryId) : undefined),
    [composerMemoryId, memories]
  );

  const composerExistingPhotos = useMemo(() => {
    if (!composerMemory) {
      return [];
    }
    return prioritizePrimary(getPhotosByMemoryId(composerMemory.id), composerMemory.primaryPhotoId);
  }, [composerMemory, getPhotosByMemoryId]);
  const composerSelectableProjectPhotos = useMemo(
    () =>
      composerSelectedProjectPhotoIds
        .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
        .filter((photo): photo is PhotoItem => Boolean(photo)),
    [composerSelectedProjectPhotoIds, projectPhotos]
  );
  const composerCollectionTags = useMemo(
    () => parseCollectionHooks(composerCollectionHooks),
    [composerCollectionHooks]
  );
  const composerCandidateProjectPhotos = useMemo(() => {
    if (composerMemoryKind !== "collection") {
      return [];
    }
    return suggestCollectionCandidatePhotos(unassignedProjectPhotos, [composerTitle, ...composerCollectionTags]);
  }, [composerCollectionTags, composerMemoryKind, composerTitle, unassignedProjectPhotos]);

  const composerThumbnailUri = useMemo(
    () => getThumbnailUri(composerThumbnailChoice, composerExistingPhotos, composerStagedAssets, projectPhotos),
    [composerExistingPhotos, composerStagedAssets, composerThumbnailChoice, projectPhotos]
  );
  const candidateReviewMemory = useMemo(
    () => (candidateReviewMemoryId ? memories.find((memory) => memory.id === candidateReviewMemoryId) : undefined),
    [candidateReviewMemoryId, memories]
  );
  const candidateReviewPhotos = useMemo(
    () => (candidateReviewMemoryId ? candidatePhotosByMemoryId.get(candidateReviewMemoryId) ?? [] : []),
    [candidatePhotosByMemoryId, candidateReviewMemoryId]
  );

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle("");
    setComposerMemoryKind("event");
    setComposerCollectionHooks("");
    setComposerSelectedProjectPhotoIds([]);
    setComposerSourceSuggestionId(null);
    setComposerStagedAssets([]);
    setComposerThumbnailChoice(undefined);
    setComposerSaving(false);
    setComposerPicking(false);
  }, []);

  const closeCandidateReview = useCallback(() => {
    setCandidateReviewMemoryId(null);
    setCandidateSelectedPhotoIds([]);
  }, []);

  const closeFinalizationReview = useCallback(() => {
    setFinalizationReviewSuggestion(null);
  }, []);

  const openCreateComposer = useCallback((kind: Memory["kind"] = "event", options?: { title?: string; photoIds?: string[]; suggestionId?: string }) => {
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle(options?.title ?? "");
    setComposerMemoryKind(kind);
    setComposerCollectionHooks("");
    setComposerSelectedProjectPhotoIds(options?.photoIds ?? []);
    setComposerSourceSuggestionId(options?.suggestionId ?? null);
    setComposerStagedAssets([]);
    setComposerThumbnailChoice(options?.photoIds?.[0] ? { kind: "existing", photoId: options.photoIds[0] } : undefined);
    setComposerVisible(true);
  }, []);

  const openEditComposer = useCallback(
    (memoryId: string) => {
      const memory = memories.find((item) => item.id === memoryId);
      if (!memory) {
        return;
      }
      const existingPhotos = prioritizePrimary(getPhotosByMemoryId(memory.id), memory.primaryPhotoId);
      setComposerMode("edit");
      setComposerMemoryId(memory.id);
      setComposerTitle(memory.title);
      setComposerMemoryKind(memory.kind);
      setComposerCollectionHooks((memory.themeTags ?? []).join(", "));
      setComposerSelectedProjectPhotoIds([]);
      setComposerSourceSuggestionId(null);
      setComposerStagedAssets([]);
      if (memory.primaryPhotoId && existingPhotos.some((photo) => photo.id === memory.primaryPhotoId)) {
        setComposerThumbnailChoice({ kind: "existing", photoId: memory.primaryPhotoId });
      } else if (existingPhotos[0]) {
        setComposerThumbnailChoice({ kind: "existing", photoId: existingPhotos[0].id });
      } else {
        setComposerThumbnailChoice(undefined);
      }
      setComposerVisible(true);
    },
    [getPhotosByMemoryId, memories]
  );

  const onPickComposerPhotos = useCallback(async () => {
    if (composerPicking) {
      return;
    }
    setComposerMediaLibraryVisible(true);
  }, [composerPicking]);

  const onImportComposerPhotos = useCallback(async (assetIds: string[]) => {
    try {
      setComposerPicking(true);
      const selected = await pickPhotosFromMediaLibraryByAssetIds(assetIds);
      if (selected.length === 0) {
        setComposerMediaLibraryVisible(false);
        return;
      }
      const nextAssets = buildStagedAssets(selected);
      setComposerStagedAssets((prev) => [...prev, ...nextAssets]);
      setComposerThumbnailChoice((prev) => {
        if (prev) {
          return prev;
        }
        const first = nextAssets[0];
        return first ? { kind: "staged", stagedKey: first.key } : undefined;
      });
      setComposerMediaLibraryVisible(false);
    } catch (error) {
      Alert.alert("Unable to add photos", (error as Error).message);
    } finally {
      setComposerPicking(false);
    }
  }, []);

  const onSaveComposer = useCallback(async () => {
    const trimmedTitle = composerTitle.trim();
    if (!trimmedTitle || composerSaving) {
      return;
    }

    try {
      setComposerSaving(true);

      if (composerMode === "create") {
        const createdMemoryId = await createMemory(projectId, trimmedTitle, {
          kind: composerMemoryKind,
          themeTags: composerMemoryKind === "collection" ? composerCollectionTags : undefined
        });
        if (composerSelectedProjectPhotoIds.length > 0) {
          assignPhotosToMemory(createdMemoryId, composerSelectedProjectPhotoIds);
        }
        const createdPhotoIds = await addPhotoAssetsToMemory(createdMemoryId, composerStagedAssets);
        const selectedPhotoId = resolveThumbnailPhotoId(
          composerThumbnailChoice,
          composerStagedAssets,
          createdPhotoIds
        );
        if (selectedPhotoId) {
          setMemoryPrimaryPhoto(createdMemoryId, selectedPhotoId);
        }
        if (composerSourceSuggestionId) {
          linkSuggestionToMemory(composerSourceSuggestionId, createdMemoryId);
        }
      } else if (composerMemoryId) {
        updateMemory(composerMemoryId, {
          title: trimmedTitle,
          kind: composerMemoryKind,
          themeTags: composerMemoryKind === "collection" ? composerCollectionTags : undefined
        });
        if (composerSelectedProjectPhotoIds.length > 0) {
          assignPhotosToMemory(composerMemoryId, composerSelectedProjectPhotoIds);
        }
        const createdPhotoIds = await addPhotoAssetsToMemory(composerMemoryId, composerStagedAssets);
        const selectedPhotoId = resolveThumbnailPhotoId(
          composerThumbnailChoice,
          composerStagedAssets,
          createdPhotoIds
        );
        if (selectedPhotoId) {
          setMemoryPrimaryPhoto(composerMemoryId, selectedPhotoId);
        }
      }

      closeComposer();
    } catch (error) {
      Alert.alert("Unable to save memory", (error as Error).message);
      setComposerSaving(false);
    }
  }, [
    addPhotoAssetsToMemory,
    assignPhotosToMemory,
    closeComposer,
    composerCollectionTags,
    composerMemoryId,
    composerMemoryKind,
    composerMode,
    composerSaving,
    composerStagedAssets,
    composerThumbnailChoice,
    composerTitle,
    createMemory,
    linkSuggestionToMemory,
    projectId,
    composerSelectedProjectPhotoIds,
    composerSourceSuggestionId,
    setMemoryPrimaryPhoto,
    updateMemory
  ]);

  const onDeleteComposerMemory = useCallback(() => {
    if (!composerMemoryId) {
      return;
    }
    Alert.alert("Delete memory", "Delete this memory and all its photos?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMemory(composerMemoryId);
          closeComposer();
        }
      }
    ]);
  }, [closeComposer, composerMemoryId, deleteMemory]);

  const onOpenCandidateReview = useCallback((memoryId: string) => {
    setCandidateReviewMemoryId(memoryId);
    setCandidateSelectedPhotoIds([]);
  }, []);

  const onApplyCandidatePhotos = useCallback(() => {
    if (!candidateReviewMemoryId || candidateSelectedPhotoIds.length === 0) {
      return;
    }
    assignPhotosToMemory(candidateReviewMemoryId, candidateSelectedPhotoIds);
    closeCandidateReview();
  }, [assignPhotosToMemory, candidateReviewMemoryId, candidateSelectedPhotoIds, closeCandidateReview]);

  const onOpenProjectMenu = useCallback(() => {
    setProjectMenuVisible(true);
  }, []);

  const onChangeProjectCover = useCallback(async () => {
    if (!project || projectMenuBusy) {
      return;
    }
    try {
      setProjectMenuBusy(true);
      const uri = await pickProjectThumbnail();
      if (uri) {
        updateProject(project.id, { thumbnailUri: uri });
      }
      setProjectMenuVisible(false);
    } catch (error) {
      Alert.alert("Unable to change project cover", (error as Error).message);
    } finally {
      setProjectMenuBusy(false);
    }
  }, [pickProjectThumbnail, project, projectMenuBusy, updateProject]);

  const onDeleteProjectFromMenu = useCallback(() => {
    if (!project) {
      return;
    }
    setProjectMenuVisible(false);
    Alert.alert("Delete project", "Delete this project, all memories, and all photos inside it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProject(project.id);
          router.replace("/");
        }
      }
    ]);
  }, [deleteProject, project]);

  const onOrderProject = useCallback(async () => {
    if (!project || exporting) {
      return;
    }
    try {
      setExporting(true);
      const photosByMemoryId = Object.fromEntries(memories.map((memory) => [memory.id, getPhotosByMemoryId(memory.id)]));
      const pageSectionsByMemoryId = Object.fromEntries(
        memories.map((memory) => [memory.id, getPageSectionsByMemoryId(memory.id)])
      );
      const pdfUri = await exportProjectToPdf(
        project,
        memories,
        photosByMemoryId,
        pageSectionsByMemoryId,
        slotOverridesByPage
      );
      await sharePdf(pdfUri);
    } catch (error) {
      Alert.alert("Unable to prepare order", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }, [exporting, getPageSectionsByMemoryId, getPhotosByMemoryId, memories, project, slotOverridesByPage]);

  const openProjectAddMenu = useCallback(() => {
    setAddMenuVisible(true);
  }, []);

  const openProjectAddIntent = useCallback((intent: ProjectAddIntent) => {
    setAddMenuVisible(false);
    if (intent === "memory") {
      openCreateComposer("event");
      return;
    }
    if (intent === "collection") {
      openCreateComposer("collection");
      return;
    }
    setSuggestionsModalVisible(true);
    setSuggestionsExpanded(true);
  }, [openCreateComposer]);

  const onAddProjectPhotos = useCallback(() => {
    if (!DEV_TOOLS_ENABLED || !project || projectPhotoIntakeBusy || projectPhotoPickerBusy) {
      return;
    }
    setProjectPhotoPickerVisible(true);
  }, [project, projectPhotoIntakeBusy, projectPhotoPickerBusy]);

  const importProjectPoolPhotos = useCallback(
    async (assetIds: string[]) => {
      if (!DEV_TOOLS_ENABLED || !project || projectPhotoIntakeBusy) {
        return;
      }
      try {
        setProjectPhotoIntakeBusy(true);
        setProjectPhotoPickerBusy(true);
        setProjectPhotoFeedback(undefined);
        const selected = await pickPhotosFromMediaLibraryByAssetIds(assetIds);
        if (selected.length === 0) {
          setProjectPhotoPickerVisible(false);
          return;
        }
        const createdPhotoIds = await addPhotoAssetsToProject(project.id, selected);
        const addedCount = createdPhotoIds.length;
        if (addedCount > 0) {
          let feedbackCard: StatusCard = {
            icon: "checkmark-circle-outline",
            title: `${pluralize(addedCount, "photo")} added`,
            message: "They stay in this project's photo pool and remain unassigned until you use them in a memory.",
            tone: "success"
          };
          if (project.timelineMode !== "past" && project.includeFutureProjectPhotos) {
            try {
              setSuggestionScanError(undefined);
              setLastSuggestionScanFeedback(undefined);
              setSuggestionScanState("scanning");
              const generated = await scanProjectSuggestions(project.id);
              if (generated.length > 0) {
                setSuggestionsExpanded(true);
              }
              setLastSuggestionScanFeedback({ generatedCount: generated.length, source: "intake" });
              setSuggestionScanState(generated.length > 0 ? "done" : "empty");
              feedbackCard = {
                icon: generated.length > 0 ? "sparkles-outline" : "checkmark-circle-outline",
                title: `${pluralize(addedCount, "photo")} added`,
                message:
                  generated.length > 0
                    ? `They are in the project pool now, and the automatic follow-up scan generated or refreshed ${pluralize(
                        generated.length,
                        "suggestion"
                      )}.`
                    : "They are in the project pool now. Future intake is on, so this project was rescanned automatically even though no strong suggestions surfaced yet.",
                tone: "success"
              };
            } catch (error) {
              setSuggestionScanState("error");
              setSuggestionScanError((error as Error).message || "Suggestion generation failed.");
              setLastSuggestionScanFeedback(undefined);
              feedbackCard = {
                icon: "warning-outline",
                title: `${pluralize(addedCount, "photo")} added`,
                message:
                  "The photos are safely in the project pool, but the automatic follow-up scan failed. You can retry from Scan Suggestions at any time.",
                tone: "error"
              };
            }
          } else {
            feedbackCard = {
              icon: "checkmark-circle-outline",
              title: `${pluralize(addedCount, "photo")} added`,
              message:
                "They are now available in the project pool. Run Scan Suggestions whenever you want to refresh event or collection ideas.",
              tone: "success"
            };
          }
          setProjectPhotoFeedback(feedbackCard);
          setProjectPhotoPickerVisible(false);
        }
      } catch (error) {
        setProjectPhotoFeedback({
          icon: "warning-outline",
          title: "Unable to add project photos",
          message: (error as Error).message || "The project is still usable. Try again when you're ready.",
          tone: "error"
        });
        Alert.alert("Unable to add project photos", (error as Error).message);
      } finally {
        setProjectPhotoPickerBusy(false);
        setProjectPhotoIntakeBusy(false);
      }
    },
    [addPhotoAssetsToProject, project, projectPhotoIntakeBusy, scanProjectSuggestions]
  );

  const onScanSuggestions = useCallback(async () => {
    if (scanningSuggestions) {
      return;
    }
    try {
      setScanningSuggestions(true);
      setSuggestionScanError(undefined);
      setLastSuggestionScanFeedback(undefined);
      setSuggestionScanState("scanning");
      const generated = await scanProjectSuggestions(projectId);
      if (generated.length > 0) {
        setSuggestionsExpanded(true);
      }
      setLastSuggestionScanFeedback({ generatedCount: generated.length, source: "manual" });
      setSuggestionScanState(generated.length > 0 ? "done" : "empty");
    } catch (error) {
      setSuggestionScanState("error");
      setSuggestionScanError((error as Error).message || "Suggestion generation failed.");
      setLastSuggestionScanFeedback(undefined);
    } finally {
      setScanningSuggestions(false);
    }
  }, [projectId, scanProjectSuggestions, scanningSuggestions]);

  const openAnalysisInspector = useCallback(
    (photoId?: string) => {
      if (!DEV_TOOLS_ENABLED) {
        return;
      }
      if (inspectorSelectablePhotos.length === 0) {
        Alert.alert("No project photos", "Add project photos first so there is an image available to inspect.");
        return;
      }

      setAnalysisInspectorPhotoId(photoId ?? inspectorSelectablePhotos[0]?.id ?? null);
      setAnalysisInspectorFeedback(undefined);
      setAnalysisInspectorVisible(true);
    },
    [inspectorSelectablePhotos]
  );

  const closeAnalysisInspector = useCallback(() => {
    if (analysisInspectorBusy) {
      return;
    }
    setAnalysisInspectorVisible(false);
    setAnalysisInspectorFeedback(undefined);
    setAnalysisInspectorProbe(null);
    setNativeLabelProbe(null);
    setNativeFaceProbe(null);
  }, [analysisInspectorBusy]);

  const closeMediaLibraryPicker = useCallback(() => {
    if (mediaLibraryProbeBusy) {
      return;
    }
    setMediaLibraryPickerVisible(false);
  }, [mediaLibraryProbeBusy]);

  const openMediaLibraryPicker = useCallback(() => {
    if (!DEV_TOOLS_ENABLED) {
      return;
    }
    setMediaLibraryPickerVisible(true);
  }, []);

  const importMediaLibraryProbePhoto = useCallback(
    async (assetIds: string[]) => {
      if (!DEV_TOOLS_ENABLED || !project) {
        return;
      }
      const assetId = assetIds[0];
      if (!assetId) {
        return;
      }

      try {
        setMediaLibraryProbeBusy(true);
        setProjectPhotoFeedback(undefined);
        const pickedAsset = await pickPhotoFromMediaLibraryByAssetId(assetId);
        if (!pickedAsset) {
          Alert.alert(
            "Media Library import unavailable",
            "We could not resolve a picked photo asset from this Media Library item."
          );
          return;
        }

        const createdPhotoIds = await addPhotoAssetsToProject(project.id, [pickedAsset]);
        const createdPhotoId = createdPhotoIds[0];

        if (!createdPhotoId) {
          Alert.alert("Import failed", "The Media Library asset did not produce a new project photo.");
          return;
        }

        setProjectPhotoFeedback({
          icon: "checkmark-circle-outline",
          title: "Media Library probe photo imported",
          message:
            "This photo came through the Media Library asset path, so the inspector can now compare asset-id-preserving imports against picker-based imports.",
          tone: "success"
        });
        setMediaLibraryPickerVisible(false);
        openAnalysisInspector(createdPhotoId);
      } catch (error) {
        Alert.alert(
          "Import failed",
          error instanceof Error ? error.message : "The Media Library probe photo could not be imported."
        );
      } finally {
        setMediaLibraryProbeBusy(false);
      }
    },
    [addPhotoAssetsToProject, openAnalysisInspector, project]
  );

  const runInspectorAnalysis = useCallback(
    async (force: boolean) => {
      if (!DEV_TOOLS_ENABLED || !project || !selectedInspectorPhoto) {
        return;
      }

      try {
        setAnalysisInspectorBusy(true);
        setAnalysisInspectorFeedback(undefined);
        const result = await analyzeProjectPhotos(project.id, {
          photoIds: [selectedInspectorPhoto.id],
          force
        });

        if (result.analyzedPhotoIds.includes(selectedInspectorPhoto.id)) {
          setAnalysisInspectorFeedback({
            icon: force ? "refresh-outline" : "analytics-outline",
            title: force ? "Photo reanalyzed" : "Photo analyzed",
            message:
              "The live project photo record was updated using the current local analysis pipeline. Scroll below to inspect the refreshed metadata.",
            tone: "success"
          });
          return;
        }

        if (result.skippedPhotoIds.includes(selectedInspectorPhoto.id)) {
          setAnalysisInspectorFeedback({
            icon: "checkmark-done-outline",
            title: "Analysis already current",
            message:
              "This photo already has the latest analysis version. Use Force Reanalyze if you want to run the pipeline again anyway.",
            tone: "info"
          });
          return;
        }

        setAnalysisInspectorFeedback({
          icon: "help-circle-outline",
          title: "No analysis result",
          message: "The orchestrator did not return a result for this photo. Try selecting it again or forcing a rerun.",
          tone: "info"
        });
      } catch (error) {
        setAnalysisInspectorFeedback({
          icon: "alert-circle-outline",
          title: "Analysis failed",
          message: error instanceof Error ? error.message : "The single-image analysis run did not complete.",
          tone: "error"
        });
      } finally {
        setAnalysisInspectorBusy(false);
      }
    },
    [analyzeProjectPhotos, project, selectedInspectorPhoto]
  );

  const analyzeAllProjectPhotosForClusters = useCallback(async () => {
    if (!DEV_TOOLS_ENABLED || !project || clusterAnalysisBusy) {
      return;
    }
    if (projectPhotos.length === 0) {
      setClusterAnalysisFeedback({
        icon: "images-outline",
        title: "No project photos",
        message: "Add photos to the project pool before running full project analysis.",
        tone: "empty"
      });
      return;
    }

    try {
      setClusterAnalysisBusy(true);
      setClusterAnalysisFeedback({
        icon: "analytics-outline",
        title: "Analyzing project photos",
        message: `Running local analysis for ${pluralize(projectPhotos.length, "project photo")}.`,
        tone: "info"
      });
      const result = await analyzeProjectPhotos(project.id, { force: true });
      setClusterInspectorExpanded(true);
      setClusterAnalysisFeedback({
        icon: "checkmark-circle-outline",
        title: "Project analysis complete",
        message: `${pluralize(result.analyzedPhotoIds.length, "photo")} analyzed. ${pluralize(
          result.skippedPhotoIds.length,
          "photo"
        )} skipped.`,
        tone: "success"
      });
    } catch (error) {
      setClusterAnalysisFeedback({
        icon: "warning-outline",
        title: "Project analysis failed",
        message: error instanceof Error ? error.message : "The project-level analysis run did not complete.",
        tone: "error"
      });
    } finally {
      setClusterAnalysisBusy(false);
    }
  }, [analyzeProjectPhotos, clusterAnalysisBusy, project, projectPhotos.length]);

  const logInspectorDebugReport = useCallback(() => {
    if (!DEV_TOOLS_ENABLED || !inspectorDebugReport) {
      return;
    }
    console.log(inspectorDebugReport);
    setAnalysisInspectorFeedback({
      icon: "terminal-outline",
      title: "Debug report logged",
      message: "The full inspector report was printed to the Metro terminal and is also selectable below.",
      tone: "info"
    });
  }, [inspectorDebugReport]);

  const onStartFinalization = useCallback(() => {
    if (!project) {
      return;
    }
    startProjectFinalization(project.id);
    setFinalizationExpanded(true);
  }, [project, startProjectFinalization]);

  const onCompleteFinalization = useCallback(() => {
    if (!project) {
      return;
    }
    completeProjectFinalization(project.id);
  }, [completeProjectFinalization, project]);

  const onDismissSuggestion = useCallback(
    (suggestionId: string) => {
      setActiveSuggestionId(suggestionId);
      dismissSuggestion(suggestionId);
      setActiveSuggestionId(null);
    },
    [dismissSuggestion]
  );

  const onSnoozeSuggestion = useCallback(
    (suggestionId: string) => {
      setActiveSuggestionId(suggestionId);
      snoozeSuggestion(suggestionId);
      setActiveSuggestionId(null);
    },
    [snoozeSuggestion]
  );

  const onKeepWatchingSuggestion = useCallback(
    (suggestionId: string) => {
      setActiveSuggestionId(suggestionId);
      keepWatchingSuggestion(suggestionId);
      setActiveSuggestionId(null);
    },
    [keepWatchingSuggestion]
  );

  const openSuggestionReview = useCallback((suggestionId: string) => {
    const suggestion = projectSuggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      return;
    }
    setSuggestionReviewId(suggestion.id);
    setSuggestionSelectedPhotoIds(suggestion.candidatePhotoIds);
  }, [projectSuggestions]);

  const closeSuggestionReview = useCallback(() => {
    setSuggestionReviewId(null);
    setSuggestionSelectedPhotoIds([]);
  }, []);

  const createMemoryFromReviewedSuggestion = useCallback(() => {
    const suggestion = projectSuggestions.find((item) => item.id === suggestionReviewId);
    if (!suggestion || suggestionSelectedPhotoIds.length === 0) {
      return;
    }
    closeSuggestionReview();
    setSuggestionsModalVisible(false);
    openCreateComposer(suggestion.type === "collection" ? "collection" : "event", {
      title: suggestion.title,
      photoIds: suggestionSelectedPhotoIds,
      suggestionId: suggestion.id
    });
  }, [closeSuggestionReview, openCreateComposer, projectSuggestions, suggestionReviewId, suggestionSelectedPhotoIds]);

  const renderSuggestionCard = useCallback(
    (suggestion: Suggestion) => {
      const statusStyles = getSuggestionStatusStyle(suggestion.status);
      const isBusy = activeSuggestionId === suggestion.id;
      const candidateCount = suggestion.candidatePhotoIds.length;
      const candidatePreviewPhotos = suggestion.candidatePhotoIds
        .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
        .filter((photo): photo is PhotoItem => Boolean(photo))
        .slice(0, 4);
      const lifecycleNote =
        suggestion.status === "accepted"
          ? suggestion.acceptedMemoryId
            ? "Accepted. A memory was created from this suggestion and linked below for testing."
            : "Accepted. This suggestion is kept visible during Milestone 1 for traceability."
          : suggestion.status === "watching"
            ? "Watching. This collection idea is staged so it can accumulate value before becoming a full memory."
          : suggestion.status === "snoozed"
            ? "Snoozed. This suggestion is parked for later review."
            : suggestion.status === "dismissed"
              ? "Dismissed. Hidden by default to keep the scaffold readable during testing."
              : "New. Ready to review and accept into a memory.";

      return (
        <View key={suggestion.id} style={styles.suggestionCard}>
          <View style={styles.suggestionCardHeader}>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <View style={[styles.suggestionStatusBadge, statusStyles.badge]}>
              <Text style={[styles.suggestionStatusText, statusStyles.text]}>
                {formatSuggestionStatus(suggestion.status)}
              </Text>
            </View>
          </View>
          <Text style={styles.suggestionMessage}>{suggestion.message}</Text>
          <Text style={styles.suggestionMeta}>
            {getSuggestionTypeLabel(suggestion.type)} |{" "}
            {candidateCount > 0 ? `${pluralize(candidateCount, "candidate photo")}` : "No candidate photos attached"}
          </Text>
          <Text style={styles.suggestionLifecycleNote}>{lifecycleNote}</Text>
          {candidatePreviewPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionPreviewRow}>
              {candidatePreviewPhotos.map((photo) => (
                <Image key={photo.id} source={{ uri: photo.uri }} style={styles.suggestionPreviewThumb} />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.suggestionActionRow}>
            {suggestion.status === "accepted" && suggestion.acceptedMemoryId ? (
              <Pressable
                style={[styles.suggestionActionButton, styles.suggestionPrimaryAction]}
                onPress={() => router.push({ pathname: "/memory/[id]", params: { id: suggestion.acceptedMemoryId! } })}
                >
                  <Text style={styles.suggestionPrimaryActionText}>Open Memory</Text>
                </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.suggestionActionButton,
                  styles.suggestionPrimaryAction,
                  isBusy || suggestion.status === "accepted" || candidateCount === 0 ? styles.suggestionActionDisabled : null
                ]}
                onPress={() => openSuggestionReview(suggestion.id)}
                disabled={isBusy || suggestion.status === "accepted" || candidateCount === 0}
              >
                <Text style={styles.suggestionPrimaryActionText}>{isBusy ? "Working..." : "Review"}</Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.suggestionActionButton,
                styles.suggestionSecondaryAction,
                suggestion.type === "collection"
                  ? suggestion.status === "watching" || suggestion.status === "accepted"
                    ? styles.suggestionActionDisabled
                    : null
                  : suggestion.status === "snoozed" || suggestion.status === "accepted"
                  ? styles.suggestionActionDisabled
                  : null
              ]}
              onPress={() =>
                suggestion.type === "collection"
                  ? onKeepWatchingSuggestion(suggestion.id)
                  : onSnoozeSuggestion(suggestion.id)
              }
              disabled={
                suggestion.type === "collection"
                  ? suggestion.status === "watching" || suggestion.status === "accepted"
                  : suggestion.status === "snoozed" || suggestion.status === "accepted"
              }
            >
              <Text style={styles.suggestionSecondaryActionText}>
                {suggestion.type === "collection" ? "Keep Watching" : "Snooze"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.suggestionActionButton,
                styles.suggestionDangerAction,
                suggestion.status === "dismissed" || suggestion.status === "accepted"
                  ? styles.suggestionActionDisabled
                  : null
              ]}
              onPress={() => onDismissSuggestion(suggestion.id)}
              disabled={suggestion.status === "dismissed" || suggestion.status === "accepted"}
            >
              <Text style={styles.suggestionDangerActionText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [activeSuggestionId, onDismissSuggestion, onKeepWatchingSuggestion, onSnoozeSuggestion, openSuggestionReview, projectPhotos]
  );

  const renderFinalizationSuggestionCard = useCallback((suggestion: FinalizationSuggestion) => {
    const candidateCount = suggestion.candidatePhotoIds.length;

    return (
      <View key={suggestion.id} style={styles.suggestionCard}>
        <View style={styles.suggestionCardHeader}>
          <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          <View style={[styles.suggestionStatusBadge, styles.finalizationStatusBadge]}>
            <Text style={[styles.suggestionStatusText, styles.finalizationStatusText]}>
              {getFinalizationTypeLabel(suggestion.type)}
            </Text>
          </View>
        </View>
        <Text style={styles.suggestionMessage}>{suggestion.message}</Text>
        <Text style={styles.suggestionMeta}>
          {candidateCount > 0 ? `${pluralize(candidateCount, "candidate photo")}` : "No candidate photos attached"}
          {suggestion.highlightTag ? ` | ${suggestion.highlightTag}` : ""}
        </Text>
        <Text style={styles.suggestionLifecycleNote}>
          Finalization stays optional. Review the photos here, then decide whether they belong in a new or expanded memory.
        </Text>
        <View style={styles.suggestionActionRow}>
          <Pressable
            style={[styles.suggestionActionButton, styles.suggestionPrimaryAction]}
            onPress={() => setFinalizationReviewSuggestion(suggestion)}
          >
            <Text style={styles.suggestionPrimaryActionText}>Review Photos</Text>
          </Pressable>
        </View>
      </View>
    );
  }, []);

  const renderClusterCard = useCallback(
    (cluster: ProjectPhotoCluster) => {
      const bestPhotos = cluster.bestPhotoIds
        .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
        .filter((photo): photo is PhotoItem => Boolean(photo))
        .slice(0, 4);

      return (
        <View key={cluster.id} style={styles.clusterCard}>
          <View style={styles.suggestionCardHeader}>
            <Text style={styles.suggestionTitle}>{getClusterTypeLabel(cluster.type)}</Text>
            <View style={[styles.suggestionStatusBadge, styles.clusterScoreBadge]}>
              <Text style={[styles.suggestionStatusText, styles.clusterScoreText]}>{cluster.score}</Text>
            </View>
          </View>
          <Text style={styles.suggestionMessage}>{cluster.explanation}</Text>
          <Text style={styles.suggestionMeta}>
            {formatClusterTimeRange(cluster)} | {pluralize(cluster.photoCount, "photo")} |{" "}
            {pluralize(cluster.bestPhotoIds.length, "best pick")}
          </Text>
          <Text style={styles.suggestionLifecycleNote}>{formatClusterLocation(cluster)}</Text>
          <Text style={styles.suggestionLifecycleNote}>
            Quality avg {cluster.qualitySummary.averageQuality} / best {cluster.qualitySummary.bestQuality} |{" "}
            {cluster.faceSummary.facePhotoCount} face photos, {cluster.faceSummary.groupPhotoCount} group photos
          </Text>
          <Text style={styles.suggestionMeta}>
            Cues: {cluster.cues.length > 0 ? cluster.cues.join(", ") : "none"}{"\n"}
            Tags: {cluster.supportingTags.length > 0 ? cluster.supportingTags.join(", ") : "none"}
          </Text>
          {cluster.recurrence ? (
            <Text style={styles.suggestionLifecycleNote}>
              Recurs across {cluster.recurrence.distinctDays} days over {cluster.recurrence.spanDays} days.
            </Text>
          ) : null}
          {bestPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clusterBestPhotoRow}>
              {bestPhotos.map((photo) => (
                <Pressable key={photo.id} style={styles.clusterBestPhoto} onPress={() => openAnalysisInspector(photo.id)}>
                  <Image source={{ uri: photo.uri }} style={styles.clusterBestPhotoImage} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      );
    },
    [openAnalysisInspector, projectPhotos]
  );

  const toolbarBottom = insets.bottom + 24;
  const bottomToolbarHeight = insets.bottom + 102;
  const composerCanSave = composerTitle.trim().length > 0 && !composerSaving;

  if (!project) {
    return (
      <View style={[styles.missingScreen, { paddingTop: insets.top + 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <Text style={styles.missingTitle}>Project not found</Text>
        <Pressable style={styles.primaryAction} onPress={() => router.replace("/")}>
          <Text style={styles.primaryActionText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topIconButton} onPress={() => router.replace("/")}>
          <Ionicons name="chevron-back" size={28} color="#f8fbff" />
        </Pressable>
        <View style={styles.topBarTextWrap}>
          <Text numberOfLines={1} style={styles.projectTitle}>
            {project.name}
          </Text>
          <Text style={styles.projectStats}>{projectStats.text}</Text>
        </View>
        <Pressable style={styles.topIconButton} onPress={onOpenProjectMenu}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#f8fbff" />
        </Pressable>
      </View>

      <View style={styles.contentArea}>
        <DraggableFlatList
          data={memoryListData}
          keyExtractor={(item) => item.id}
          activationDistance={12}
          autoscrollThreshold={96}
          autoscrollSpeed={180}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: bottomToolbarHeight + 72
          }}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {DEV_TOOLS_ENABLED && devToolsExpanded ? (
                <View style={styles.devToolsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={styles.sectionHeading}>Developer Tools</Text>
                      <Text style={styles.sectionSubheading}>
                        Internal photo-pool, analysis, and clustering tools are hidden from the normal MVP flow.
                      </Text>
                    </View>
                  </View>
                  <>
              <View style={[styles.sectionHeaderRow, styles.sectionHeaderRowStack]}>
                <Text style={styles.sectionHeading}>Project Photos</Text>
                <View style={[styles.sectionHeaderActions, styles.sectionHeaderActionsFullWidth]}>
                  <Pressable style={styles.dismissedToggle} onPress={() => openAnalysisInspector()}>
                    <Ionicons name="bug-outline" size={15} color="#9ab2dd" />
                    <Text style={styles.dismissedToggleText}>Analysis Inspector</Text>
                  </Pressable>
                  <Pressable style={styles.dismissedToggle} onPress={openMediaLibraryPicker}>
                    <Ionicons name="albums-outline" size={15} color="#9ab2dd" />
                    <Text style={styles.dismissedToggleText}>Probe Media Asset</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.scanButton, projectPhotoIntakeBusy ? styles.scanButtonDisabled : null]}
                    onPress={onAddProjectPhotos}
                    disabled={projectPhotoIntakeBusy}
                  >
                    {projectPhotoIntakeBusy ? (
                      <ActivityIndicator color="#eef4ff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="images-outline" size={15} color="#eef4ff" />
                        <Text style={styles.scanButtonText}>Add Photos to Project</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
              <Text style={styles.sectionSubheading}>
                Photos added here stay in the project pool without being assigned to a memory until you use them.
              </Text>
              <Text style={styles.suggestionSummary}>
                {pluralize(projectPhotos.length, "project photo")} | {pluralize(unassignedProjectPhotos.length, "unassigned photo")}
              </Text>
              {project && project.timelineMode !== "past" ? (
                <View style={styles.projectPoolControlRow}>
                  <Text style={styles.projectPoolControlText}>
                    Future intake is {project.includeFutureProjectPhotos ? "on" : "paused"} for this {project.timelineMode} project.
                  </Text>
                  <Pressable
                    style={styles.dismissedToggle}
                    onPress={() =>
                      updateProject(project.id, {
                        includeFutureProjectPhotos: !project.includeFutureProjectPhotos
                      })
                    }
                  >
                    <Ionicons
                      name={project.includeFutureProjectPhotos ? "flash-outline" : "pause-outline"}
                      size={15}
                      color="#9ab2dd"
                    />
                    <Text style={styles.dismissedToggleText}>
                      {project.includeFutureProjectPhotos ? "Pause Future Intake" : "Include Future Photos"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {projectPhotoStateCard ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    projectPhotoStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
                    projectPhotoStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    projectPhotoStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  <Ionicons
                    name={projectPhotoStateCard.icon}
                    size={24}
                    color={projectPhotoStateCard.tone === "error" ? "#ff9aae" : projectPhotoStateCard.tone === "success" ? "#82efb4" : "#7fa7ff"}
                  />
                  <Text style={styles.emptyTitle}>{projectPhotoStateCard.title}</Text>
                  <Text style={styles.emptyText}>{projectPhotoStateCard.message}</Text>
                </View>
              ) : null}
              {projectPhotoPreview.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.projectPhotoStrip}
                >
                  {projectPhotoPreview.map((photo) => (
                    <Pressable key={photo.id} style={styles.projectPhotoThumbWrap} onPress={() => openAnalysisInspector(photo.id)}>
                      <Image source={{ uri: photo.uri }} style={styles.projectPhotoThumb} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Cluster Inspector</Text>
                <View style={styles.sectionControlRow}>
                  <Pressable
                    style={[styles.dismissedToggle, clusterAnalysisBusy ? styles.scanButtonDisabled : null]}
                    onPress={() => void analyzeAllProjectPhotosForClusters()}
                    disabled={clusterAnalysisBusy}
                  >
                    {clusterAnalysisBusy ? (
                      <ActivityIndicator color="#9ab2dd" size="small" />
                    ) : (
                      <Ionicons name="analytics-outline" size={15} color="#9ab2dd" />
                    )}
                    <Text style={styles.dismissedToggleText}>
                      {clusterAnalysisBusy ? "Analyzing..." : "Analyze All"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.dismissedToggle} onPress={() => setClusterInspectorExpanded((prev) => !prev)}>
                    <Ionicons
                      name={clusterInspectorExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                      size={15}
                      color="#9ab2dd"
                    />
                    <Text style={styles.dismissedToggleText}>
                      {clusterInspectorExpanded
                        ? `Collapse clusters (${projectClusters.length})`
                        : `Expand clusters (${projectClusters.length})`}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.sectionSubheading}>
                Developer-only grouping preview for event-like moments and recurring collection candidates. This does not create memories or suggestions.
              </Text>
              <Text style={styles.suggestionSummary}>
                Vocabulary: time-burst, same-day, multi-day, location, faces, quality, scenic, food, pet, travel, recurring-theme.
              </Text>
              {clusterAnalysisFeedback ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    clusterAnalysisFeedback.tone === "error" ? styles.suggestionsStateCardError : null,
                    clusterAnalysisFeedback.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    clusterAnalysisFeedback.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  {clusterAnalysisBusy ? (
                    <ActivityIndicator color="#dbe8ff" />
                  ) : (
                    <Ionicons
                      name={clusterAnalysisFeedback.icon}
                      size={24}
                      color={
                        clusterAnalysisFeedback.tone === "error"
                          ? "#ff9aae"
                          : clusterAnalysisFeedback.tone === "success"
                            ? "#82efb4"
                            : "#7fa7ff"
                      }
                    />
                  )}
                  <Text style={styles.emptyTitle}>{clusterAnalysisFeedback.title}</Text>
                  <Text style={styles.emptyText}>{clusterAnalysisFeedback.message}</Text>
                </View>
              ) : null}
              {clusterInspectorExpanded && projectClusters.length === 0 ? (
                <View style={styles.suggestionsEmptyCard}>
                  <Ionicons name="git-branch-outline" size={28} color="#5d7097" />
                  <Text style={styles.emptyTitle}>No strong clusters yet</Text>
                  <Text style={styles.emptyText}>
                    Add or analyze more project photos. The first pass needs close time groups or repeated themes across days.
                  </Text>
                </View>
              ) : null}
              {clusterInspectorExpanded && topProjectClusters.length > 0 ? (
                <View style={styles.suggestionList}>{topProjectClusters.map(renderClusterCard)}</View>
              ) : null}
                  </>
                </View>
              ) : null}

              {INLINE_PROJECT_SECTIONS_ENABLED ? (
                <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Suggested Memories</Text>
                <Pressable
                  style={[styles.scanButton, scanningSuggestions ? styles.scanButtonDisabled : null]}
                  onPress={onScanSuggestions}
                  disabled={scanningSuggestions}
                >
                  {scanningSuggestions ? (
                    <ActivityIndicator color="#eef4ff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="search-outline" size={15} color="#eef4ff" />
                      <Text style={styles.scanButtonText}>Scan Memories</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={styles.sectionSubheading}>
                Review suggested event memories for this project. Actions stay local and will not create pages automatically.
              </Text>

              {suggestionSummary ? <Text style={styles.suggestionSummary}>{suggestionSummary}</Text> : null}

              {projectSuggestions.length > 0 ? (
                <View style={styles.sectionControlRow}>
                  <Pressable style={styles.dismissedToggle} onPress={() => setSuggestionsExpanded((prev) => !prev)}>
                    <Ionicons
                      name={suggestionsExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                      size={15}
                      color="#9ab2dd"
                    />
                    <Text style={styles.dismissedToggleText}>
                      {suggestionsExpanded
                        ? `Collapse suggestions (${projectSuggestions.length})`
                        : `Expand suggestions (${projectSuggestions.length})`}
                    </Text>
                  </Pressable>

                  {suggestionsExpanded && dismissedSuggestions.length > 0 ? (
                    <Pressable
                      style={styles.dismissedToggle}
                      onPress={() => setShowDismissedSuggestions((prev) => !prev)}
                    >
                      <Ionicons
                        name={showDismissedSuggestions ? "eye-off-outline" : "eye-outline"}
                        size={15}
                        color="#9ab2dd"
                      />
                      <Text style={styles.dismissedToggleText}>
                        {showDismissedSuggestions
                          ? `Hide dismissed (${dismissedSuggestions.length})`
                          : `Show dismissed (${dismissedSuggestions.length})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {suggestionStateCard ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    suggestionStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
                    suggestionStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    suggestionStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  {suggestionScanState === "scanning" ? (
                    <ActivityIndicator color="#dbe8ff" />
                  ) : (
                    <Ionicons
                      name={suggestionStateCard.icon}
                      size={24}
                      color={
                        suggestionStateCard.tone === "error"
                          ? "#ff9aae"
                          : suggestionStateCard.tone === "success"
                            ? "#82efb4"
                            : "#7fa7ff"
                      }
                    />
                  )}
                  <Text style={styles.emptyTitle}>{suggestionStateCard.title}</Text>
                  <Text style={styles.emptyText}>{suggestionStateCard.message}</Text>
                </View>
              ) : null}

              {!suggestionsExpanded && projectSuggestions.length > 0 ? (
                <Text style={styles.suggestionCollapsedHint}>
                  Suggestion cards are hidden to keep this screen lighter. Expand them when you want to review or act on them.
                </Text>
              ) : null}

              {suggestionsExpanded && newSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>New</Text>
                    <Text style={styles.suggestionGroupHint}>Ready to review and accept.</Text>
                  </View>
                  <View style={styles.suggestionList}>{newSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}

              {suggestionsExpanded && watchingSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Watching</Text>
                    <Text style={styles.suggestionGroupHint}>
                      Collection ideas that are staged for later growth without becoming full memories yet.
                    </Text>
                  </View>
                  <View style={styles.suggestionList}>{watchingSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}

              {suggestionsExpanded && snoozedSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Snoozed</Text>
                    <Text style={styles.suggestionGroupHint}>Parked for later so they stay visible during testing.</Text>
                  </View>
                  <View style={styles.suggestionList}>{snoozedSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}

              {suggestionsExpanded && acceptedSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Accepted</Text>
                    <Text style={styles.suggestionGroupHint}>
                      Kept visible in Milestone 1 so you can verify created memories.
                    </Text>
                  </View>
                  <View style={styles.suggestionList}>{acceptedSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}

              {suggestionsExpanded && showDismissedSuggestions && dismissedSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Dismissed</Text>
                    <Text style={styles.suggestionGroupHint}>Hidden by default to reduce clutter during testing.</Text>
                  </View>
                  <View style={styles.suggestionList}>{dismissedSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Suggested Theme Pages</Text>
              </View>
              <Text style={styles.sectionSubheading}>
                Theme pages are user-led in the MVP. Pick a theme later, then choose the exact photos before anything is imported.
              </Text>
              <View style={styles.themeSuggestionCard}>
                <View style={styles.themeSuggestionHeader}>
                  <Ionicons name="albums-outline" size={24} color="#7fa7ff" />
                  <View style={styles.themeSuggestionTextBlock}>
                    <Text style={styles.emptyTitle}>Theme picker scaffold</Text>
                    <Text style={styles.emptyText}>
                      The next slice will connect these themes to a picker/search flow. No full-library theme import runs here.
                    </Text>
                  </View>
                </View>
                <View style={styles.themeChipRow}>
                  {SUGGESTED_THEME_PAGE_LABELS.map((label) => (
                    <View key={label} style={styles.themeChip}>
                      <Text style={styles.themeChipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Finalization</Text>
                {project?.finalizationStatus === "idle" ? (
                  <Pressable style={styles.scanButton} onPress={onStartFinalization}>
                    <Ionicons name="flag-outline" size={15} color="#eef4ff" />
                    <Text style={styles.scanButtonText}>Start Finalization</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.scanButton} onPress={onCompleteFinalization}>
                    <Ionicons name="checkmark-done-outline" size={15} color="#eef4ff" />
                    <Text style={styles.scanButtonText}>
                      {project?.finalizationStatus === "reviewed" ? "Reviewed" : "Mark Reviewed"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.sectionSubheading}>
                A lightweight end-stage entry for reviewing accepted memories and theme pages before finishing the book.
              </Text>
              <Text style={styles.suggestionSummary}>{finalizationSummary}</Text>

              {DEV_TOOLS_ENABLED && devToolsExpanded ? (
                <View style={styles.sectionControlRow}>
                <Pressable style={styles.dismissedToggle} onPress={() => setFinalizationExpanded((prev) => !prev)}>
                  <Ionicons
                    name={finalizationExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                    size={15}
                    color="#9ab2dd"
                  />
                  <Text style={styles.dismissedToggleText}>
                    {finalizationExpanded
                      ? `Collapse finalization (${finalizationSuggestions.length})`
                      : `Expand finalization (${finalizationSuggestions.length})`}
                  </Text>
                </Pressable>
                </View>
              ) : (
                <Text style={styles.suggestionCollapsedHint}>
                  Detailed finalization review is deferred until accepted-memory and theme-page inputs are wired for the MVP.
                </Text>
              )}

              {finalizationStateCard ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    finalizationStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
                    finalizationStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    finalizationStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  <Ionicons
                    name={finalizationStateCard.icon}
                    size={24}
                    color={
                      finalizationStateCard.tone === "error"
                        ? "#ff9aae"
                        : finalizationStateCard.tone === "success"
                          ? "#82efb4"
                          : "#7fa7ff"
                    }
                  />
                  <Text style={styles.emptyTitle}>{finalizationStateCard.title}</Text>
                  <Text style={styles.emptyText}>{finalizationStateCard.message}</Text>
                </View>
              ) : null}

              {DEV_TOOLS_ENABLED && devToolsExpanded && !finalizationExpanded && finalizationSuggestions.length > 0 ? (
                <Text style={styles.suggestionCollapsedHint}>
                  Finalization ideas are hidden until you expand them, so the main project workflow stays uncluttered.
                </Text>
              ) : null}

              {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && missingMomentFinalizationSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Missing Moments</Text>
                    <Text style={styles.suggestionGroupHint}>
                      Unassigned time clusters that may deserve a final event memory or recap page.
                    </Text>
                  </View>
                  <View style={styles.suggestionList}>
                    {missingMomentFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
                  </View>
                </View>
              ) : null}

              {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && strongestUnusedFinalizationSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Strongest Unused Photos</Text>
                    <Text style={styles.suggestionGroupHint}>
                      High-value photos still outside memories near the end of the project.
                    </Text>
                  </View>
                  <View style={styles.suggestionList}>
                    {strongestUnusedFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
                  </View>
                </View>
              ) : null}

              {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && highlightFinalizationSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <View style={styles.suggestionGroupHeader}>
                    <Text style={styles.suggestionGroupTitle}>Recurring Highlights</Text>
                    <Text style={styles.suggestionGroupHint}>
                      Repeating themes across the project that may work better as closing highlight collections.
                    </Text>
                  </View>
                  <View style={styles.suggestionList}>
                    {highlightFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
                  </View>
                </View>
              ) : null}
                </>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Memories</Text>
              </View>
            </View>
          }
          onDragEnd={({ data, from, to }) => {
            setMemoryListData(data);
            if (from === to) {
              return;
            }
            const movedId = data[to]?.id;
            if (!movedId) {
              return;
            }
            const nextKey = orderKey(data);
            setPendingMemoryOrderKey(nextKey);
            reorderMemory(projectId, movedId, to);
          }}
          renderItem={({ item, drag, isActive }) => {
            const memoryPhotos = prioritizePrimary(getPhotosByMemoryId(item.id), item.primaryPhotoId);
            const pageCount = getPageSectionsByMemoryId(item.id).length;
            const photoCount = memoryPhotos.length;
            const candidatePhotos = candidatePhotosByMemoryId.get(item.id) ?? [];

            return (
              <ScaleDecorator>
                <View style={[styles.memoryCardShell, isActive ? styles.memoryCardShellActive : null]}>
                  <Pressable
                    delayLongPress={180}
                    onLongPress={drag}
                    onPress={() => {
                      if (!isActive) {
                        router.push({ pathname: "/memory/[id]", params: { id: item.id } });
                      }
                    }}
                    style={styles.memoryCard}
                  >
                    <MemoryCollagePreview photos={memoryPhotos} />
                    <View style={styles.memoryBody}>
                      <View style={styles.memoryMetaRow}>
                        <View
                          style={
                            item.kind === "collection" ? styles.memoryKindBadgeCollection : styles.memoryKindBadgeEvent
                          }
                        >
                          <Text
                            style={
                              item.kind === "collection"
                                ? styles.memoryKindBadgeCollectionText
                                : styles.memoryKindBadgeEventText
                            }
                          >
                            {getMemoryKindLabel(item.kind)}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.memoryName}>
                        {item.title}
                      </Text>
                      <Text style={styles.memorySummary}>
                        {pluralize(photoCount, "photo")} | {pluralize(pageCount, "page")}
                      </Text>
                      {item.kind === "collection" && item.themeTags && item.themeTags.length > 0 ? (
                        <Text style={styles.memoryTagsSummary}>{item.themeTags.join(" | ")}</Text>
                      ) : null}
                      {DEV_TOOLS_ENABLED && devToolsExpanded && candidatePhotos.length > 0 ? (
                        <Pressable
                          style={styles.memoryCandidateButton}
                          onPress={() => onOpenCandidateReview(item.id)}
                        >
                          <Ionicons name="sparkles-outline" size={14} color="#9bc2ff" />
                          <Text style={styles.memoryCandidateButtonText}>
                            Review {pluralize(candidatePhotos.length, "suggested addition")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => openEditComposer(item.id)} style={styles.memoryMenuButton}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#d7e2ff" />
                  </Pressable>
                </View>
              </ScaleDecorator>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="images-outline" size={34} color="#5d7097" />
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>Create the first memory with the add button below.</Text>
            </View>
          }
        />
      </View>

      <Pressable onPress={openProjectAddMenu} style={[styles.addButton, { bottom: toolbarBottom + 22 }]}>
        <Ionicons name="add" size={34} color="#ffffff" />
      </Pressable>

      <View style={[styles.bottomToolbar, { height: bottomToolbarHeight, paddingBottom: insets.bottom + 18 }]}>
        <Pressable style={styles.toolbarItem} onPress={() => router.replace("/")}>
          <Ionicons name="home-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => router.push({ pathname: "/project/[id]/preview", params: { id: project.id } })}
        >
          <Ionicons name="book-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Preview</Text>
        </Pressable>
        <View style={styles.toolbarCenterSpacer} />
        <Pressable style={styles.toolbarItem} onPress={onOrderProject} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#d2def5" /> : <Ionicons name="cart-outline" size={22} color="#d2def5" />}
          <Text style={styles.toolbarLabel}>Order</Text>
        </Pressable>
        <Pressable style={styles.toolbarItem} onPress={() => router.push("/prompts")}>
          <Ionicons name="notifications-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Notifications</Text>
        </Pressable>
      </View>

      <Modal transparent animationType="fade" visible={projectMenuVisible} onRequestClose={() => setProjectMenuVisible(false)}>
        <View style={styles.centerModalBackdrop}>
          <View style={styles.actionMenuCard}>
            <Text style={styles.modalTitle}>{project.name}</Text>
            <Text style={styles.modalSubtitle}>Project options</Text>
            {DEV_TOOLS_ENABLED ? (
              <Pressable
                style={styles.actionMenuButton}
                onPress={() => {
                  setDevToolsExpanded((prev) => !prev);
                  setProjectMenuVisible(false);
                }}
              >
                <Ionicons name="construct-outline" size={20} color="#d7e2ff" />
                <Text style={styles.actionMenuButtonText}>
                  {devToolsExpanded ? "Hide Developer Tools" : "Show Developer Tools"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.actionMenuButton} onPress={onChangeProjectCover} disabled={projectMenuBusy}>
              {projectMenuBusy ? (
                <ActivityIndicator color="#d7e2ff" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#d7e2ff" />
              )}
              <Text style={styles.actionMenuButtonText}>Change Cover Photo</Text>
            </Pressable>
            <Pressable style={[styles.actionMenuButton, styles.actionMenuDanger]} onPress={onDeleteProjectFromMenu}>
              <Ionicons name="trash-outline" size={20} color="#ff9aae" />
              <Text style={styles.actionMenuDangerText}>Delete Project</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonLike} onPress={() => setProjectMenuVisible(false)}>
              <Text style={styles.secondaryButtonLikeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={addMenuVisible} onRequestClose={() => setAddMenuVisible(false)}>
        <View style={styles.centerModalBackdrop}>
          <View style={styles.actionMenuCard}>
            <Text style={styles.modalTitle}>Add to Project</Text>
            <Text style={styles.modalSubtitle}>Choose what you want to create or review.</Text>
            <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("memory")}>
              <Ionicons name="images-outline" size={20} color="#d7e2ff" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Memory</Text>
                <Text style={styles.actionMenuHint}>Create an event memory and add photos.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("collection")}>
              <Ionicons name="albums-outline" size={20} color="#d7e2ff" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Collection</Text>
                <Text style={styles.actionMenuHint}>Create a theme collection with selected photos.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("suggestions")}>
              <Ionicons name="sparkles-outline" size={20} color="#d7e2ff" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Review Suggestions</Text>
                <Text style={styles.actionMenuHint}>Scan, review, snooze, or dismiss suggested memories.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.secondaryButtonLike} onPress={() => setAddMenuVisible(false)}>
              <Text style={styles.secondaryButtonLikeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={suggestionsModalVisible} onRequestClose={() => setSuggestionsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Suggested Memories</Text>
                  <Text style={styles.modalSubtitle}>
                    Scan for local suggestions, then review photos before creating a memory or collection.
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={() => setSuggestionsModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Suggestions</Text>
                  <Pressable
                    style={[styles.scanButton, scanningSuggestions ? styles.scanButtonDisabled : null]}
                    onPress={onScanSuggestions}
                    disabled={scanningSuggestions}
                  >
                    {scanningSuggestions ? (
                      <ActivityIndicator color="#eef4ff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="search-outline" size={15} color="#eef4ff" />
                        <Text style={styles.scanButtonText}>Scan</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {suggestionStateCard ? (
                  <View
                    style={[
                      styles.suggestionsStateCard,
                      suggestionStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
                      suggestionStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
                      suggestionStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
                    ]}
                  >
                    {suggestionScanState === "scanning" ? (
                      <ActivityIndicator color="#dbe8ff" />
                    ) : (
                      <Ionicons
                        name={suggestionStateCard.icon}
                        size={24}
                        color={
                          suggestionStateCard.tone === "error"
                            ? "#ff9aae"
                            : suggestionStateCard.tone === "success"
                              ? "#82efb4"
                              : "#7fa7ff"
                        }
                      />
                    )}
                    <Text style={styles.emptyTitle}>{suggestionStateCard.title}</Text>
                    <Text style={styles.emptyText}>{suggestionStateCard.message}</Text>
                  </View>
                ) : null}

                {newSuggestions.length > 0 ? (
                  <View style={styles.suggestionGroup}>
                    <Text style={styles.suggestionGroupTitle}>New</Text>
                    <View style={styles.suggestionList}>{newSuggestions.map(renderSuggestionCard)}</View>
                  </View>
                ) : null}
                {watchingSuggestions.length > 0 ? (
                  <View style={styles.suggestionGroup}>
                    <Text style={styles.suggestionGroupTitle}>Watching</Text>
                    <View style={styles.suggestionList}>{watchingSuggestions.map(renderSuggestionCard)}</View>
                  </View>
                ) : null}
                {snoozedSuggestions.length > 0 ? (
                  <View style={styles.suggestionGroup}>
                    <Text style={styles.suggestionGroupTitle}>Snoozed</Text>
                    <View style={styles.suggestionList}>{snoozedSuggestions.map(renderSuggestionCard)}</View>
                  </View>
                ) : null}
                {acceptedSuggestions.length > 0 ? (
                  <View style={styles.suggestionGroup}>
                    <Text style={styles.suggestionGroupTitle}>Accepted</Text>
                    <View style={styles.suggestionList}>{acceptedSuggestions.map(renderSuggestionCard)}</View>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={Boolean(suggestionReview)} onRequestClose={closeSuggestionReview}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{suggestionReview?.title ?? "Review Suggestion"}</Text>
                  <Text style={styles.modalSubtitle}>
                    Select the photos you want, then create a memory or collection with your own title.
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeSuggestionReview}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {suggestionReview ? (
                  <Text style={styles.suggestionMessage}>{suggestionReview.message}</Text>
                ) : null}

                {suggestionReviewPhotos.length > 0 ? (
                  <View style={styles.candidateGrid}>
                    {suggestionReviewPhotos.map((photo) => {
                      const selected = suggestionSelectedPhotoIds.includes(photo.id);
                      return (
                        <Pressable
                          key={photo.id}
                          style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                          onPress={() =>
                            setSuggestionSelectedPhotoIds((prev) =>
                              prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                            )
                          }
                        >
                          <Image source={{ uri: photo.uri }} style={styles.candidateGridImage} />
                          <View style={[styles.candidateGridCheck, selected ? styles.candidateGridCheckSelected : null]}>
                            <Ionicons
                              name={selected ? "checkmark" : "add"}
                              size={16}
                              color={selected ? "#ffffff" : "#d9e6ff"}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="images-outline" size={30} color="#5d7097" />
                    <Text style={styles.emptyTitle}>No preview photos</Text>
                    <Text style={styles.emptyText}>This suggestion does not currently have candidate photos attached.</Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable style={styles.deleteMemoryButton} onPress={closeSuggestionReview}>
                    <Text style={styles.deleteMemoryButtonText}>Close</Text>
                  </Pressable>
                  {suggestionReview ? (
                    <>
                      <Pressable style={[styles.suggestionActionButton, styles.suggestionSecondaryAction]} onPress={() => {
                        onSnoozeSuggestion(suggestionReview.id);
                        closeSuggestionReview();
                      }}>
                        <Text style={styles.suggestionSecondaryActionText}>Snooze</Text>
                      </Pressable>
                      <Pressable style={[styles.suggestionActionButton, styles.suggestionDangerAction]} onPress={() => {
                        onDismissSuggestion(suggestionReview.id);
                        closeSuggestionReview();
                      }}>
                        <Text style={styles.suggestionDangerActionText}>Dismiss</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable
                    style={[
                      styles.primaryAction,
                      suggestionSelectedPhotoIds.length === 0 ? styles.primaryActionDisabled : null
                    ]}
                    onPress={createMemoryFromReviewedSuggestion}
                    disabled={suggestionSelectedPhotoIds.length === 0}
                  >
                    <Text style={styles.primaryActionText}>
                      {suggestionSelectedPhotoIds.length === 0 ? "Select Photos" : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={Boolean(candidateReviewMemory)} onRequestClose={closeCandidateReview}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Suggested Photos</Text>
                  <Text style={styles.modalSubtitle}>
                    {candidateReviewMemory
                      ? `Review project-pool photos that may belong to "${candidateReviewMemory.title}".`
                      : "Review project-pool photos for this memory."}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeCandidateReview}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {candidateReviewPhotos.length > 0 ? (
                  <View style={styles.candidateGrid}>
                    {candidateReviewPhotos.map((photo) => {
                      const selected = candidateSelectedPhotoIds.includes(photo.id);
                      return (
                        <Pressable
                          key={photo.id}
                          style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                          onPress={() =>
                            setCandidateSelectedPhotoIds((prev) =>
                              prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                            )
                          }
                        >
                          <Image source={{ uri: photo.uri }} style={styles.candidateGridImage} />
                          <View style={[styles.candidateGridCheck, selected ? styles.candidateGridCheckSelected : null]}>
                            <Ionicons
                              name={selected ? "checkmark" : "add"}
                              size={16}
                              color={selected ? "#ffffff" : "#d9e6ff"}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="sparkles-outline" size={30} color="#5d7097" />
                    <Text style={styles.emptyTitle}>No candidate photos right now</Text>
                    <Text style={styles.emptyText}>
                      Add more project photos or widen the project pool to get stronger photo-addition suggestions.
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable style={styles.deleteMemoryButton} onPress={closeCandidateReview}>
                    <Text style={styles.deleteMemoryButtonText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primaryAction,
                      candidateSelectedPhotoIds.length === 0 ? styles.primaryActionDisabled : null
                    ]}
                    onPress={onApplyCandidatePhotos}
                    disabled={candidateSelectedPhotoIds.length === 0}
                  >
                    <Text style={styles.primaryActionText}>
                      {candidateSelectedPhotoIds.length === 0
                        ? "Select Photos"
                        : `Add ${pluralize(candidateSelectedPhotoIds.length, "photo")}`}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={Boolean(finalizationReviewSuggestion)}
        onRequestClose={closeFinalizationReview}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{finalizationReviewSuggestion?.title ?? "Finalization Review"}</Text>
                  <Text style={styles.modalSubtitle}>
                    {finalizationReviewSuggestion?.message ??
                      "Review these project photos before deciding whether they belong in a final memory or collection."}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeFinalizationReview}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {finalizationReviewPhotos.length > 0 ? (
                  <View style={styles.candidateGrid}>
                    {finalizationReviewPhotos.map((photo) => (
                      <View key={photo.id} style={styles.finalizationGridItem}>
                        <Image source={{ uri: photo.uri }} style={styles.candidateGridImage} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="albums-outline" size={30} color="#5d7097" />
                    <Text style={styles.emptyTitle}>No review photos right now</Text>
                    <Text style={styles.emptyText}>
                      This finalization idea does not currently have a stable candidate set attached.
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable style={styles.deleteMemoryButton} onPress={closeFinalizationReview}>
                    <Text style={styles.deleteMemoryButtonText}>Close</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={DEV_TOOLS_ENABLED && analysisInspectorVisible}
        onRequestClose={closeAnalysisInspector}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Image Analysis Inspector</Text>
                  <Text style={styles.modalSubtitle}>
                    Developer-facing view of one photo’s persisted analysis metadata. It uses the current orchestrator
                    and updates the live project photo record.
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeAnalysisInspector} disabled={analysisInspectorBusy}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {inspectorSelectablePhotos.length > 0 ? (
                  <View style={styles.analysisPickerSection}>
                    <Text style={styles.fieldLabel}>Target Photo</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.analysisPickerRow}
                    >
                      {inspectorSelectablePhotos.map((photo) => {
                        const selected = selectedInspectorPhoto?.id === photo.id;
                        return (
                          <Pressable
                            key={photo.id}
                            style={[styles.analysisPickerCard, selected ? styles.analysisPickerCardSelected : null]}
                            onPress={() => {
                              setAnalysisInspectorPhotoId(photo.id);
                              setAnalysisInspectorFeedback(undefined);
                            }}
                          >
                            <Image source={{ uri: photo.uri }} style={styles.analysisPickerImage} />
                            <View style={styles.analysisPickerMeta}>
                              <Text style={styles.analysisPickerMetaText}>
                                {photo.memoryId ? "Assigned" : "Project pool"}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="images-outline" size={30} color="#5d7097" />
                    <Text style={styles.emptyTitle}>No project photos to inspect</Text>
                    <Text style={styles.emptyText}>
                      Add project photos or memory photos in this project first, then reopen the inspector.
                    </Text>
                  </View>
                )}

                {analysisInspectorFeedback ? (
                  <View
                    style={[
                      styles.suggestionsStateCard,
                      analysisInspectorFeedback.tone === "error" ? styles.suggestionsStateCardError : null,
                      analysisInspectorFeedback.tone === "info" ? styles.suggestionsStateCardInfo : null,
                      analysisInspectorFeedback.tone === "success" ? styles.suggestionsStateCardSuccess : null
                    ]}
                  >
                    {analysisInspectorBusy ? (
                      <ActivityIndicator color="#dbe8ff" />
                    ) : (
                      <Ionicons
                        name={analysisInspectorFeedback.icon}
                        size={24}
                        color={
                          analysisInspectorFeedback.tone === "error"
                            ? "#ff9aae"
                            : analysisInspectorFeedback.tone === "success"
                              ? "#82efb4"
                              : "#7fa7ff"
                        }
                      />
                    )}
                    <Text style={styles.emptyTitle}>{analysisInspectorFeedback.title}</Text>
                    <Text style={styles.emptyText}>{analysisInspectorFeedback.message}</Text>
                  </View>
                ) : null}

                {selectedInspectorPhoto ? (
                  <>
                    <View style={styles.analysisPreviewCard}>
                      <Image source={{ uri: selectedInspectorPhoto.uri }} style={styles.analysisPreviewImage} />
                    </View>

                    <View style={styles.analysisActionRow}>
                      <Pressable
                        style={[styles.scanButton, analysisInspectorBusy ? styles.scanButtonDisabled : null]}
                        onPress={() => runInspectorAnalysis(false)}
                        disabled={analysisInspectorBusy}
                      >
                        {analysisInspectorBusy ? (
                          <ActivityIndicator color="#eef4ff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="analytics-outline" size={15} color="#eef4ff" />
                            <Text style={styles.scanButtonText}>Analyze Selected</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.dismissedToggle, analysisInspectorBusy ? styles.scanButtonDisabled : null]}
                        onPress={() => runInspectorAnalysis(true)}
                        disabled={analysisInspectorBusy}
                      >
                        <Ionicons name="refresh-outline" size={15} color="#9ab2dd" />
                        <Text style={styles.dismissedToggleText}>Force Reanalyze</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.dismissedToggle, !inspectorDebugReport ? styles.scanButtonDisabled : null]}
                        onPress={logInspectorDebugReport}
                        disabled={!inspectorDebugReport}
                      >
                        <Ionicons name="terminal-outline" size={15} color="#9ab2dd" />
                        <Text style={styles.dismissedToggleText}>Log Report</Text>
                      </Pressable>
                    </View>

                    <InspectorSection title="Base Metadata">
                      <InspectorField label="Photo ID" value={selectedInspectorPhoto.id} />
                      <InspectorField label="Project ID" value={selectedInspectorPhoto.projectId} />
                      <InspectorField label="Memory ID" value={selectedInspectorPhoto.memoryId} />
                      <InspectorField label="Source Asset ID" value={selectedInspectorPhoto.importMetadata?.assetId} />
                      <InspectorField label="URI" value={selectedInspectorPhoto.uri} />
                      <InspectorField label="Width" value={selectedInspectorPhoto.width} />
                      <InspectorField label="Height" value={selectedInspectorPhoto.height} />
                      <InspectorField label="Captured At" value={selectedInspectorPhoto.capturedAt} />
                      <InspectorField label="Added At" value={selectedInspectorPhoto.addedAt} />
                      <InspectorField label="Location" value={formatLocationLabel(selectedInspectorPhoto)} />
                    </InspectorSection>

                    <InspectorSection title="Import Metadata Sources">
                      <InspectorField
                        label="Resolution Path"
                        value={formatResolutionKind(selectedInspectorPhoto.importMetadata?.resolutionKind)}
                      />
                      <InspectorField
                        label="Picker Asset ID Present"
                        value={selectedInspectorPhoto.importMetadata?.pickerAssetIdPresent}
                      />
                      <InspectorField
                        label="Picker EXIF Present"
                        value={selectedInspectorPhoto.importMetadata?.pickerExifPresent}
                      />
                      <InspectorField
                        label="Picker Key Sample"
                        value={selectedInspectorPhoto.importMetadata?.pickerKeySample?.join(", ")}
                      />
                      <InspectorField
                        label="Captured At Source"
                        value={getCapturedAtSourceLabel(selectedInspectorPhoto)}
                      />
                      <InspectorField
                        label="Location Source"
                        value={getLocationSourceLabel(selectedInspectorPhoto)}
                      />
                    </InspectorSection>

                    <InspectorSection title="Media Library Probe">
                      <InspectorField
                        label="Picker Asset ID"
                        value={selectedInspectorPhoto.importMetadata?.assetId ?? "No assetId on picker result"}
                      />
                      <InspectorField
                        label="Media Library Lookup"
                        value={
                          analysisInspectorProbeBusy
                            ? "Checking..."
                            : analysisInspectorProbe?.lookupAttempted
                              ? "Called getAssetInfoAsync"
                              : analysisInspectorProbe?.assetIdPresent
                                ? analysisInspectorProbe?.permissionGranted
                                  ? "Asset ID present, lookup not completed"
                                  : "Permission unavailable"
                                : "Skipped (no assetId)"
                        }
                      />
                      <InspectorField
                        label="AssetInfo Location Present"
                        value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.hasLocation}
                      />
                      <InspectorField
                        label="AssetInfo EXIF Present"
                        value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.hasExif}
                      />
                      <InspectorField
                        label="Final Stored Location"
                        value={formatLocationLabel(selectedInspectorPhoto)}
                      />
                      <InspectorField
                        label="Location Source Used"
                        value={getLocationSourceLabel(selectedInspectorPhoto)}
                      />
                      <InspectorField
                        label="Raw Location Preview"
                        value={analysisInspectorProbeBusy ? "Checking..." : analysisInspectorProbe?.rawLocationPreview}
                      />
                      <InspectorField
                        label="EXIF Key Sample"
                        value={analysisInspectorProbe?.exifKeySample?.join(", ")}
                      />
                      <InspectorField label="Probe Error" value={analysisInspectorProbe?.error} />
                    </InspectorSection>

                    <InspectorSection title="Analysis">
                      <InspectorField label="Analysis Version" value={selectedInspectorPhoto.analysis?.analysisVersion} />
                      <InspectorField label="Analyzed At" value={selectedInspectorPhoto.analysis?.analyzedAt} />
                    </InspectorSection>

                    <InspectorSection title="Quality">
                      <InspectorField label="Quality Score" value={selectedInspectorPhoto.analysis?.quality?.qualityScore} />
                      <InspectorField
                        label="Hero Candidate Score"
                        value={selectedInspectorPhoto.analysis?.quality?.heroCandidateScore}
                      />
                      <InspectorField label="Is Blurry" value={selectedInspectorPhoto.analysis?.quality?.isBlurry} />
                      <InspectorField label="Is Low Light" value={selectedInspectorPhoto.analysis?.quality?.isLowLight} />
                    </InspectorSection>

                    <InspectorSection title="Scene and Theme">
                      <InspectorField
                        label="Persisted Source"
                        value={formatAnalysisSource(selectedInspectorPhoto.analysis?.sources?.scene)}
                      />
                      <InspectorField
                        label="Scene Tags"
                        value={formatTagList(selectedInspectorPhoto.analysis?.sceneTags)}
                      />
                      <InspectorField
                        label="Theme Tags"
                        value={formatTagList(selectedInspectorPhoto.analysis?.themeTags)}
                      />
                    </InspectorSection>

                    <InspectorSection title="Heuristic Scene/Face Preview">
                      <InspectorField label="Debug-only Field" value="Live fallback preview is not persisted here" />
                      <InspectorField label="Heuristic Scene Tags" value={formatTagList(heuristicScenePreview?.sceneTags)} />
                      <InspectorField label="Heuristic Theme Tags" value={formatTagList(heuristicScenePreview?.themeTags)} />
                      <InspectorField
                        label="Heuristic Portrait-like"
                        value={heuristicScenePreview?.subjectCues?.portraitLike}
                      />
                      <InspectorField
                        label="Heuristic Group-photo-like"
                        value={heuristicScenePreview?.subjectCues?.groupPhotoLike}
                      />
                      <InspectorField label="Heuristic Face Count" value={heuristicFacePreview?.faces?.faceCount} />
                      <InspectorField label="Heuristic Has Face" value={heuristicFacePreview?.faces?.hasFace} />
                      <InspectorField
                        label="Heuristic Has Multiple Faces"
                        value={heuristicFacePreview?.faces?.hasMultipleFaces}
                      />
                    </InspectorSection>

                    <InspectorSection title="Native Image Labels">
                      <InspectorField
                        label="Persisted Fields"
                        value="analysis.nativeLabels, analysis.sceneTags, analysis.themeTags, analysis.safeExternalTags"
                      />
                      <InspectorField
                        label="Product Behavior"
                        value="Raw labels are inspector-first; broader behavior consumes only normalized app tags"
                      />
                      <InspectorField
                        label="Persisted Native Labels"
                        value={formatNativeLabels(selectedInspectorPhoto.analysis?.nativeLabels)}
                      />
                      <InspectorField
                        label="Persisted Normalized Tags"
                        value={formatTagList(selectedInspectorPhoto.analysis?.safeExternalTags)}
                      />
                    </InspectorSection>

                    <InspectorSection title="ML Kit Live Probe">
                      <InspectorField label="Debug-only Field" value="Native label probe result is not persisted" />
                      <InspectorField
                        label="Native Source"
                        value={nativeLabelProbeBusy ? "Checking..." : nativeLabelProbe?.source}
                      />
                      <InspectorField
                        label="Native Module Available"
                        value={nativeLabelProbeBusy ? "Checking..." : nativeLabelProbe?.available}
                      />
                      <InspectorField
                        label="Raw Native Labels"
                        value={formatNativeLabelProbe(nativeLabelProbe, nativeLabelProbeBusy)}
                      />
                      <InspectorField
                        label="Live Normalized Tags"
                        value={
                          nativeLabelProbe?.available
                            ? formatTagList(normalizeTagsFromNativeImageLabels(nativeLabelProbe.labels))
                            : "—"
                        }
                      />
                    </InspectorSection>

                    <InspectorSection title="Subject Cues">
                      <InspectorField
                        label="Portrait-like"
                        value={selectedInspectorPhoto.analysis?.subjectCues?.portraitLike}
                      />
                      <InspectorField
                        label="Group-photo-like"
                        value={selectedInspectorPhoto.analysis?.subjectCues?.groupPhotoLike}
                      />
                    </InspectorSection>

                    <InspectorSection title="Face Metadata">
                      <InspectorField
                        label="Persisted Source"
                        value={formatAnalysisSource(selectedInspectorPhoto.analysis?.sources?.faces)}
                      />
                      <InspectorField label="Face Count" value={selectedInspectorPhoto.analysis?.faces?.faceCount} />
                      <InspectorField label="Has Face" value={selectedInspectorPhoto.analysis?.faces?.hasFace} />
                      <InspectorField
                        label="Has Multiple Faces"
                        value={selectedInspectorPhoto.analysis?.faces?.hasMultipleFaces}
                      />
                    </InspectorSection>

                    <InspectorSection title="Native Face Detection">
                      <InspectorField
                        label="Persisted Fields"
                        value="analysis.nativeFaces, analysis.faces, analysis.subjectCues"
                      />
                      <InspectorField
                        label="Product Behavior"
                        value="No person recognition; raw face boxes stay local/debug-facing"
                      />
                      <InspectorField
                        label="Persisted Native Faces"
                        value={formatNativeFaces(selectedInspectorPhoto.analysis?.nativeFaces)}
                      />
                    </InspectorSection>

                    <InspectorSection title="ML Kit Face Live Probe">
                      <InspectorField label="Debug-only Field" value="Native face probe result is not persisted" />
                      <InspectorField
                        label="Native Source"
                        value={nativeFaceProbeBusy ? "Checking..." : nativeFaceProbe?.source}
                      />
                      <InspectorField
                        label="Native Module Available"
                        value={nativeFaceProbeBusy ? "Checking..." : nativeFaceProbe?.available}
                      />
                      <InspectorField
                        label="Raw Native Faces"
                        value={formatNativeFaceProbe(nativeFaceProbe, nativeFaceProbeBusy)}
                      />
                    </InspectorSection>

                    <InspectorSection title="Similarity">
                      <InspectorField
                        label="Duplicate Cluster ID"
                        value={selectedInspectorPhoto.analysis?.similarity?.duplicateClusterId}
                      />
                      <InspectorField
                        label="Similarity Cluster ID"
                        value={selectedInspectorPhoto.analysis?.similarity?.similarityClusterId}
                      />
                      <InspectorField
                        label="Representative Score"
                        value={selectedInspectorPhoto.analysis?.similarity?.representativeScore}
                      />
                    </InspectorSection>

                    <InspectorSection title="External and Local-Only">
                      <InspectorField
                        label="Safe External Tags"
                        value={selectedInspectorPhoto.analysis?.safeExternalTags?.join(", ")}
                      />
                      <InspectorField
                        label="Private Face Data Ref"
                        value={selectedInspectorPhoto.analysis?.localOnly?.privateFaceDataRef}
                      />
                      <InspectorField
                        label="Local Embedding Ref"
                        value={selectedInspectorPhoto.analysis?.localOnly?.localEmbeddingRef}
                      />
                    </InspectorSection>

                    <InspectorSection title="Copyable Debug Report">
                      <Text selectable style={styles.analysisCodeBlock}>
                        {inspectorDebugReport}
                      </Text>
                    </InspectorSection>

                    <InspectorSection title="Raw Analysis Snapshot">
                      <Text selectable style={styles.analysisCodeBlock}>
                        {JSON.stringify(selectedInspectorPhoto.analysis ?? {}, null, 2)}
                      </Text>
                    </InspectorSection>
                  </>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable style={styles.deleteMemoryButton} onPress={closeAnalysisInspector} disabled={analysisInspectorBusy}>
                    <Text style={styles.deleteMemoryButtonText}>Close Inspector</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <MediaLibrarySelectionModal
        visible={DEV_TOOLS_ENABLED && projectPhotoPickerVisible}
        title="Add Project Photos"
        subtitle="Choose photos directly from Media Library so the app can preserve canonical asset ids and richer GPS/EXIF metadata."
        confirmLabel="Add to Project"
        selectionMode="multiple"
        confirming={projectPhotoPickerBusy}
        bottomInset={insets.bottom}
        onClose={() => {
          if (!projectPhotoPickerBusy) {
            setProjectPhotoPickerVisible(false);
          }
        }}
        onConfirm={importProjectPoolPhotos}
      />

      <MediaLibrarySelectionModal
        visible={composerMediaLibraryVisible}
        title="Add Memory Photos"
        subtitle="Choose Media Library assets to stage inside this memory composer while preserving the canonical asset metadata path."
        confirmLabel="Add to Memory"
        selectionMode="multiple"
        confirming={composerPicking}
        bottomInset={insets.bottom}
        onClose={() => {
          if (!composerPicking) {
            setComposerMediaLibraryVisible(false);
          }
        }}
        onConfirm={onImportComposerPhotos}
      />

      <MediaLibrarySelectionModal
        visible={DEV_TOOLS_ENABLED && mediaLibraryPickerVisible}
        title="Media Library Probe Import"
        subtitle="Pick one recent Media Library photo asset to import through a path that preserves the canonical asset id before opening the analysis inspector."
        selectionMode="single"
        confirming={mediaLibraryProbeBusy}
        showDiagnostics
        bottomInset={insets.bottom}
        onClose={closeMediaLibraryPicker}
        onConfirm={importMediaLibraryProbePhoto}
      />

      <Modal transparent animationType="slide" visible={composerVisible} onRequestClose={closeComposer}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalAvoider}
          >
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{composerMode === "create" ? "New Memory" : "Edit Memory"}</Text>
                  <Text style={styles.modalSubtitle}>
                    Set a title, pick starting photos, and choose the memory thumbnail.
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeComposer}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Memory Title</Text>
                <TextInput
                  value={composerTitle}
                  onChangeText={setComposerTitle}
                  placeholder="Memory title"
                  placeholderTextColor="#6f7f9f"
                  style={styles.modalInput}
                />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Memory Type</Text>
                  <View style={styles.choiceGrid}>
                    {[
                      { label: "Event", value: "event" as const },
                      { label: "Collection", value: "collection" as const }
                    ].map((option) => {
                      const selected = composerMemoryKind === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
                          onPress={() => setComposerMemoryKind(option.value)}
                        >
                          <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldHelperText}>
                    Collections are recurring themes that can grow over time. Events keep the current memory flow.
                  </Text>
                </View>

                {composerMemoryKind === "collection" ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Collection Hooks</Text>
                    <TextInput
                      value={composerCollectionHooks}
                      onChangeText={setComposerCollectionHooks}
                      placeholder="Examples: hiking, family, sunsets"
                      placeholderTextColor="#6f7f9f"
                      style={styles.modalInput}
                    />
                    <Text style={styles.fieldHelperText}>
                      Use simple comma-separated cues. They are stored with the collection and used to propose project
                      photos without auto-adding them.
                    </Text>
                  </View>
                ) : null}

                {DEV_TOOLS_ENABLED && devToolsExpanded && composerMemoryKind === "collection" ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Suggested Project Photos</Text>
                    <Text style={styles.fieldHelperText}>
                      Tap any suggested photo to include it when you save this collection. Nothing is auto-added.
                    </Text>
                    {composerCandidateProjectPhotos.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.collectionCandidateRow}
                      >
                        {composerCandidateProjectPhotos.map((photo) => {
                          const selected = composerSelectedProjectPhotoIds.includes(photo.id);
                          return (
                            <Pressable
                              key={photo.id}
                              style={[
                                styles.collectionCandidateCard,
                                selected ? styles.collectionCandidateCardSelected : null
                              ]}
                              onPress={() =>
                                setComposerSelectedProjectPhotoIds((prev) =>
                                  prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                                )
                              }
                            >
                              <Image source={{ uri: photo.uri }} style={styles.collectionCandidateImage} />
                              <View
                                style={[
                                  styles.collectionCandidateBadge,
                                  selected ? styles.collectionCandidateBadgeSelected : null
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.collectionCandidateBadgeText,
                                    selected ? styles.collectionCandidateBadgeTextSelected : null
                                  ]}
                                >
                                  {selected ? "Include" : "Suggest"}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <View style={styles.thumbnailOptionEmpty}>
                        <Ionicons name="sparkles-outline" size={24} color="#607296" />
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={styles.inlineActionRow}>
                  <Text style={styles.fieldLabel}>Photos</Text>
                  <Pressable style={styles.inlineButton} onPress={onPickComposerPhotos} disabled={composerPicking}>
                    {composerPicking ? (
                      <ActivityIndicator color="#eef4ff" />
                    ) : (
                      <Text style={styles.inlineButtonText}>Add Photos</Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.thumbnailPreviewCard}>
                  {composerThumbnailUri ? (
                    <Image source={{ uri: composerThumbnailUri }} style={styles.thumbnailPreviewImage} />
                  ) : (
                    <View style={styles.thumbnailPreviewPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#6c7c9d" />
                      <Text style={styles.thumbnailPreviewPlaceholderText}>Select a thumbnail</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Thumbnail</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailPickerRow}
                >
                  {composerExistingPhotos.map((photo) => {
                    const selected =
                      composerThumbnailChoice?.kind === "existing" && composerThumbnailChoice.photoId === photo.id;
                    return (
                      <Pressable
                        key={photo.id}
                        onPress={() => setComposerThumbnailChoice({ kind: "existing", photoId: photo.id })}
                        style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                      >
                        <Image source={{ uri: photo.uri }} style={styles.thumbnailOptionImage} />
                        <View style={styles.thumbTagExisting}>
                          <Text style={styles.thumbTagText}>Current</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  {composerSelectableProjectPhotos
                    .filter((photo) => !composerExistingPhotos.some((existing) => existing.id === photo.id))
                    .map((photo) => {
                      const selected =
                        composerThumbnailChoice?.kind === "existing" && composerThumbnailChoice.photoId === photo.id;
                      return (
                        <Pressable
                          key={photo.id}
                          onPress={() => setComposerThumbnailChoice({ kind: "existing", photoId: photo.id })}
                          style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                        >
                          <Image source={{ uri: photo.uri }} style={styles.thumbnailOptionImage} />
                          <View style={styles.thumbTagNew}>
                            <Text style={styles.thumbTagText}>Selected</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  {composerStagedAssets.map((asset) => {
                    const selected =
                      composerThumbnailChoice?.kind === "staged" &&
                      composerThumbnailChoice.stagedKey === asset.key;
                    return (
                      <Pressable
                        key={asset.key}
                        onPress={() => setComposerThumbnailChoice({ kind: "staged", stagedKey: asset.key })}
                        style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                      >
                        <Image source={{ uri: asset.uri }} style={styles.thumbnailOptionImage} />
                        <View style={styles.thumbTagNew}>
                          <Text style={styles.thumbTagText}>New</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  {composerExistingPhotos.length === 0 && composerSelectableProjectPhotos.length === 0 && composerStagedAssets.length === 0 ? (
                    <View style={[styles.thumbnailOption, styles.thumbnailOptionEmpty]}>
                      <Ionicons name="images-outline" size={28} color="#607296" />
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.modalActions}>
                  {composerMode === "edit" ? (
                    <Pressable style={styles.deleteMemoryButton} onPress={onDeleteComposerMemory}>
                      <Text style={styles.deleteMemoryButtonText}>Delete Memory</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.primaryAction, !composerCanSave ? styles.primaryActionDisabled : null]}
                    onPress={onSaveComposer}
                    disabled={!composerCanSave}
                  >
                    <Text style={styles.primaryActionText}>
                      {composerSaving ? "Saving..." : composerMode === "create" ? "Create Memory" : "Save Changes"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a1220"
  },
  missingScreen: {
    flex: 1,
    backgroundColor: "#0a1220",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16
  },
  missingTitle: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "700"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#20304d"
  },
  topIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTextWrap: {
    flex: 1,
    alignItems: "center"
  },
  projectTitle: {
    color: "#f8fbff",
    fontSize: 20,
    fontWeight: "800"
  },
  projectStats: {
    marginTop: 4,
    color: "#9fb2d9",
    fontSize: 13
  },
  contentArea: {
    flex: 1
  },
  listHeader: {
    gap: 14,
    paddingTop: 10,
    paddingBottom: 18
  },
  devToolsSection: {
    gap: 14,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#263958",
    borderStyle: "dashed",
    backgroundColor: "#0e1728"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeaderRowStack: {
    flexWrap: "wrap",
    alignItems: "flex-start"
  },
  sectionHeaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  sectionHeaderActionsFullWidth: {
    width: "100%",
    justifyContent: "flex-start"
  },
  sectionHeading: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "800",
    flexShrink: 1
  },
  sectionSubheading: {
    color: "#90a4cc",
    fontSize: 13,
    lineHeight: 18
  },
  scanButton: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1b2c49",
    borderWidth: 1,
    borderColor: "#2d4f82",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  scanButtonDisabled: {
    opacity: 0.6
  },
  scanButtonText: {
    color: "#eef4ff",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionSummary: {
    color: "#7f97c4",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionCollapsedHint: {
    color: "#9ab2dd",
    fontSize: 12,
    lineHeight: 18
  },
  projectPhotoStrip: {
    gap: 10,
    paddingRight: 12
  },
  sectionControlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center"
  },
  projectPoolControlRow: {
    gap: 10
  },
  projectPoolControlText: {
    color: "#9eb0d3",
    fontSize: 12,
    lineHeight: 18
  },
  projectPhotoThumbWrap: {
    width: 78,
    height: 78,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#24385f",
    backgroundColor: "#14223a"
  },
  projectPhotoThumb: {
    width: "100%",
    height: "100%"
  },
  analysisPickerSection: {
    gap: 10
  },
  analysisPickerRow: {
    gap: 10,
    paddingRight: 12
  },
  analysisPickerCard: {
    width: 92,
    height: 110,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#24385f",
    backgroundColor: "#14223a"
  },
  analysisPickerCardSelected: {
    borderWidth: 2,
    borderColor: "#2f80ff"
  },
  analysisPickerImage: {
    width: "100%",
    height: 78
  },
  analysisPickerMeta: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  analysisPickerMetaText: {
    color: "#c8d7f7",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  analysisPreviewCard: {
    height: 220,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#14223a"
  },
  analysisPreviewImage: {
    width: "100%",
    height: "100%"
  },
  analysisActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  analysisSection: {
    gap: 10
  },
  analysisSectionTitle: {
    color: "#dfe8fb",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  analysisSectionBody: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#101a2d",
    overflow: "hidden"
  },
  analysisFieldRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#223456",
    gap: 6
  },
  analysisFieldLabel: {
    color: "#88a0cb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  analysisFieldValue: {
    color: "#eef4ff",
    fontSize: 14,
    lineHeight: 20
  },
  analysisCodeBlock: {
    color: "#dbe8ff",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  dismissedToggle: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111d31",
    borderWidth: 1,
    borderColor: "#24385f",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  dismissedToggleText: {
    color: "#9ab2dd",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionsStateCard: {
    marginBottom: 4,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#10192c",
    alignItems: "center",
    gap: 10
  },
  suggestionsStateCardInfo: {
    borderColor: "#294266",
    backgroundColor: "#101b2f"
  },
  suggestionsStateCardSuccess: {
    borderColor: "#27563e",
    backgroundColor: "#0f2018"
  },
  suggestionsStateCardError: {
    borderColor: "#6d3345",
    backgroundColor: "#1f1018"
  },
  suggestionGroup: {
    gap: 10
  },
  suggestionGroupHeader: {
    gap: 4
  },
  suggestionGroupTitle: {
    color: "#dfe8fb",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  suggestionGroupHint: {
    color: "#8ea2ca",
    fontSize: 12,
    lineHeight: 17
  },
  suggestionList: {
    gap: 12,
    marginBottom: 4
  },
  suggestionCard: {
    borderRadius: 20,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#20304d",
    padding: 16,
    gap: 10
  },
  clusterCard: {
    borderRadius: 20,
    backgroundColor: "#0f1b2f",
    borderWidth: 1,
    borderColor: "#294266",
    padding: 16,
    gap: 10
  },
  clusterScoreBadge: {
    backgroundColor: "#10213f",
    borderColor: "#2f80ff"
  },
  clusterScoreText: {
    color: "#8fc2ff"
  },
  clusterBestPhotoRow: {
    gap: 10,
    paddingRight: 12
  },
  clusterBestPhoto: {
    width: 74,
    height: 74,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2d4f82",
    backgroundColor: "#14223a"
  },
  clusterBestPhotoImage: {
    width: "100%",
    height: "100%"
  },
  suggestionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  suggestionTitle: {
    flex: 1,
    color: "#f8fbff",
    fontSize: 17,
    fontWeight: "800"
  },
  suggestionMessage: {
    color: "#c2d0ee",
    fontSize: 14,
    lineHeight: 20
  },
  suggestionMeta: {
    color: "#84a0d5",
    fontSize: 12,
    fontWeight: "600"
  },
  suggestionLifecycleNote: {
    color: "#9eb0d3",
    fontSize: 12,
    lineHeight: 18
  },
  suggestionPreviewRow: {
    gap: 10,
    paddingRight: 12
  },
  suggestionPreviewThumb: {
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2d4f82",
    backgroundColor: "#14223a"
  },
  suggestionStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1
  },
  suggestionStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  suggestionStatusNew: {
    backgroundColor: "#10213f",
    borderColor: "#2f80ff"
  },
  suggestionStatusNewText: {
    color: "#8fc2ff"
  },
  suggestionStatusWatching: {
    backgroundColor: "#1e1a2b",
    borderColor: "#7d59d1"
  },
  suggestionStatusWatchingText: {
    color: "#ceb4ff"
  },
  suggestionStatusSnoozed: {
    backgroundColor: "#2a2211",
    borderColor: "#8a6d1d"
  },
  suggestionStatusSnoozedText: {
    color: "#ffd57a"
  },
  suggestionStatusAccepted: {
    backgroundColor: "#11291c",
    borderColor: "#2b8f5a"
  },
  suggestionStatusAcceptedText: {
    color: "#82efb4"
  },
  suggestionStatusDismissed: {
    backgroundColor: "#2a151c",
    borderColor: "#854357"
  },
  suggestionStatusDismissedText: {
    color: "#ff9aae"
  },
  finalizationStatusBadge: {
    backgroundColor: "#15243d",
    borderColor: "#3f6ab2"
  },
  finalizationStatusText: {
    color: "#a7c8ff"
  },
  suggestionActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2
  },
  suggestionActionButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  suggestionPrimaryAction: {
    backgroundColor: "#2f80ff",
    borderColor: "#2f80ff"
  },
  suggestionPrimaryActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  suggestionSecondaryAction: {
    backgroundColor: "#132239",
    borderColor: "#294266"
  },
  suggestionSecondaryActionText: {
    color: "#d7e2ff",
    fontSize: 13,
    fontWeight: "700"
  },
  suggestionDangerAction: {
    backgroundColor: "#24131a",
    borderColor: "#6d3345"
  },
  suggestionDangerActionText: {
    color: "#ff9aae",
    fontSize: 13,
    fontWeight: "700"
  },
  suggestionActionDisabled: {
    opacity: 0.45
  },
  suggestionsEmptyCard: {
    marginBottom: 6,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#223456",
    borderStyle: "dashed",
    backgroundColor: "#10192c",
    alignItems: "center",
    gap: 10
  },
  themeSuggestionCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#10192c",
    gap: 16
  },
  themeSuggestionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  themeSuggestionTextBlock: {
    flex: 1,
    gap: 6
  },
  themeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  themeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#12233f",
    borderWidth: 1,
    borderColor: "#2c5aa0"
  },
  themeChipText: {
    color: "#9bc2ff",
    fontSize: 12,
    fontWeight: "800"
  },
  memoryCardShell: {
    borderRadius: 24,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#20304d",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  memoryCardShellActive: {
    opacity: 0.92
  },
  memoryCard: {
    padding: 12,
    gap: 14
  },
  memoryMenuButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(12, 20, 36, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#223456"
  },
  previewPanel: {
    height: 196,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1a2843"
  },
  previewEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#233556",
    borderStyle: "dashed"
  },
  previewEmptyText: {
    color: "#9badcf",
    fontSize: 14
  },
  previewSingle: {
    width: "100%",
    height: "100%"
  },
  previewRow: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    padding: 3
  },
  previewHalf: {
    flex: 1,
    height: "100%",
    borderRadius: 14
  },
  previewThirdWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden"
  },
  previewThird: {
    width: "100%",
    height: "100%"
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 10, 20, 0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  previewOverlayText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800"
  },
  memoryBody: {
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 4
  },
  memoryMetaRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  memoryKindBadgeEvent: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#12233f",
    borderWidth: 1,
    borderColor: "#2c5aa0"
  },
  memoryKindBadgeEventText: {
    color: "#9bc2ff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  memoryKindBadgeCollection: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#1d1b0f",
    borderWidth: 1,
    borderColor: "#8d7a31"
  },
  memoryKindBadgeCollectionText: {
    color: "#ffe48b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  memoryName: {
    color: "#f8fbff",
    fontSize: 19,
    fontWeight: "800",
    paddingRight: 36
  },
  memorySummary: {
    color: "#9fb2d9",
    fontSize: 14
  },
  memoryTagsSummary: {
    color: "#c6d4ee",
    fontSize: 12,
    lineHeight: 17
  },
  memoryCandidateButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#11213a",
    borderWidth: 1,
    borderColor: "#294266",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  memoryCandidateButtonText: {
    color: "#d7e2ff",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyCard: {
    marginTop: 12,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#223456",
    borderStyle: "dashed",
    backgroundColor: "#10192c",
    alignItems: "center",
    gap: 10
  },
  emptyTitle: {
    color: "#f3f7ff",
    fontWeight: "700",
    fontSize: 18
  },
  emptyText: {
    color: "#8ea4cf",
    textAlign: "center"
  },
  addButton: {
    position: "absolute",
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2f80ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2f80ff",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    zIndex: 20
  },
  bottomToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: "#0d1729",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#223456",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12
  },
  toolbarItem: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  toolbarCenterSpacer: {
    width: 76
  },
  toolbarLabel: {
    color: "#d2def5",
    fontSize: 12,
    fontWeight: "600"
  },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 14, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22
  },
  actionMenuCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#0f182a",
    padding: 20,
    gap: 12
  },
  actionMenuButton: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263958",
    backgroundColor: "#111d31",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  actionMenuTextBlock: {
    flex: 1,
    gap: 4
  },
  actionMenuButtonText: {
    color: "#eef4ff",
    fontSize: 15,
    fontWeight: "800"
  },
  actionMenuHint: {
    color: "#8ea4cf",
    fontSize: 12,
    lineHeight: 16
  },
  actionMenuDanger: {
    backgroundColor: "#24131a",
    borderColor: "#6d3345"
  },
  actionMenuDangerText: {
    color: "#ff9aae",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButtonLike: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#263958",
    backgroundColor: "#0c1424",
    paddingHorizontal: 16
  },
  secondaryButtonLikeText: {
    color: "#d7e2ff",
    fontSize: 14,
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 14, 0.76)",
    justifyContent: "flex-end"
  },
  modalAvoider: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: "#0f182a",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: "#223456",
    paddingHorizontal: 20,
    paddingTop: 18
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14
  },
  modalTitle: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "800"
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#8ea4cf",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#17223a",
    alignItems: "center",
    justifyContent: "center"
  },
  modalContent: {
    paddingBottom: 12,
    gap: 16
  },
  fieldGroup: {
    gap: 10
  },
  fieldLabel: {
    color: "#dce7ff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  fieldHelperText: {
    color: "#7f93bb",
    fontSize: 12,
    lineHeight: 17
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#233456",
    backgroundColor: "#111d31",
    color: "#f8fbff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  choiceChip: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#111d31",
    alignItems: "center",
    justifyContent: "center"
  },
  choiceChipSelected: {
    backgroundColor: "#1f3f76",
    borderColor: "#2f80ff"
  },
  choiceChipText: {
    color: "#c9d7f5",
    fontSize: 14,
    fontWeight: "700"
  },
  choiceChipTextSelected: {
    color: "#f8fbff"
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  inlineButton: {
    minWidth: 108,
    borderRadius: 14,
    backgroundColor: "#2f80ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inlineButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  thumbnailPreviewCard: {
    height: 190,
    borderRadius: 22,
    backgroundColor: "#14223a",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#223456"
  },
  thumbnailPreviewImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailPreviewPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  thumbnailPreviewPlaceholderText: {
    color: "#8ea4cf"
  },
  thumbnailPickerRow: {
    gap: 10,
    paddingRight: 12
  },
  thumbnailOption: {
    width: 92,
    height: 92,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#20304d",
    overflow: "hidden",
    backgroundColor: "#14223a"
  },
  thumbnailOptionSelected: {
    borderColor: "#2f80ff"
  },
  thumbnailOptionImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailOptionEmpty: {
    alignItems: "center",
    justifyContent: "center"
  },
  collectionCandidateRow: {
    gap: 10,
    paddingRight: 12
  },
  collectionCandidateCard: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#24385f",
    backgroundColor: "#14223a"
  },
  collectionCandidateCardSelected: {
    borderColor: "#2f80ff",
    borderWidth: 2
  },
  collectionCandidateImage: {
    width: "100%",
    height: "100%"
  },
  collectionCandidateBadge: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 999,
    paddingVertical: 4,
    backgroundColor: "rgba(12, 20, 36, 0.84)",
    borderWidth: 1,
    borderColor: "#223456",
    alignItems: "center"
  },
  collectionCandidateBadgeSelected: {
    backgroundColor: "rgba(47, 128, 255, 0.95)",
    borderColor: "#2f80ff"
  },
  collectionCandidateBadgeText: {
    color: "#d9e6ff",
    fontSize: 11,
    fontWeight: "800"
  },
  collectionCandidateBadgeTextSelected: {
    color: "#ffffff"
  },
  candidateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  candidateGridItem: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#14223a"
  },
  candidateGridItemSelected: {
    borderColor: "#2f80ff",
    borderWidth: 2
  },
  finalizationGridItem: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#223456",
    backgroundColor: "#14223a"
  },
  candidateGridImage: {
    width: "100%",
    height: "100%"
  },
  candidateGridCheck: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(12, 20, 36, 0.88)",
    borderWidth: 1,
    borderColor: "#223456",
    alignItems: "center",
    justifyContent: "center"
  },
  candidateGridCheckSelected: {
    backgroundColor: "#2f80ff",
    borderColor: "#2f80ff"
  },
  mediaLibraryProbeBadge: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(47, 128, 255, 0.92)",
    borderWidth: 1,
    borderColor: "#2f80ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  mediaLibraryProbeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  thumbTagExisting: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(16, 35, 61, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  thumbTagNew: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(47, 128, 255, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  thumbTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#2f80ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryActionDisabled: {
    opacity: 0.5
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  deleteMemoryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6f2432",
    backgroundColor: "#28131a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  deleteMemoryButtonText: {
    color: "#ff8ea2",
    fontSize: 14,
    fontWeight: "700"
  }
});

