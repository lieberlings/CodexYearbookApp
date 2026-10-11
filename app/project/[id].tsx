import { ProjectCoverCard } from "../../src/components/ProjectCoverCard";
import { BookPartPreview } from "../../src/components/BookPartPreview";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaLibrarySelectionModal } from "../../src/components/MediaLibrarySelectionModal";
import { useAppData } from "../../src/context/AppContext";
import { exportProjectPhotosToZip, sharePhotoZip } from "../../src/services/photoZipExportService";
import { exportProjectToPdf, sharePdf } from "../../src/services/exportService";
import { detectPhotoFacesHeuristic } from "../../src/services/faceDetectionService";
import { detectFacesLocally, NativeFaceDetectionResult } from "../../src/services/nativeFaceDetection";
import { pickImagesWithAndroidPhotoPicker } from "../../src/services/androidPhotoPicker";
import {
  generateFinalizationSuggestionsForProject,
  suggestCandidatePhotosForMemory,
  suggestCollectionCandidatePhotos
} from "../../src/services/promptEngine";
import { labelImageLocally, NativeImageLabelingResult } from "../../src/services/nativeImageLabeling";
import { analyzePhotoSceneHeuristics } from "../../src/services/sceneAnalysisService";
import {
  generateProjectPhotoClusters,
  ProjectPhotoCluster
} from "../../src/services/projectClusterEngine";
import {
  MediaLibraryAssetProbe,
  pickPhotoFromMediaLibraryByAssetId,
  pickPhotosFromMediaLibraryByAssetIds,
  probeMediaLibraryAssetMetadata
} from "../../src/services/photoService";
import { useEditorStore } from "../../src/state/editorStore";
import { FinalizationSuggestion, Memory, PhotoItem, Suggestion } from "../../src/types";
import { FinalizationSuggestionCard } from "../../src/features/projectScreen/components/FinalizationSuggestionCard";
import { InlineProjectSections } from "../../src/features/projectScreen/components/InlineProjectSections";
import { MemoryCollagePreview } from "../../src/features/projectScreen/components/MemoryCollagePreview";
import { SuggestionCard } from "../../src/features/projectScreen/components/SuggestionCard";
import { AnalysisInspectorModal } from "../../src/features/projectScreen/devTools/AnalysisInspectorModal";
import { ClusterCard } from "../../src/features/projectScreen/devTools/ClusterCard";
import { DevToolsSection } from "../../src/features/projectScreen/devTools/DevToolsSection";
import { DEV_TOOLS_ENABLED } from "../../src/features/projectScreen/devTools/flags";
import { buildInspectorDebugReport } from "../../src/features/projectScreen/devTools/inspector";
import {
  buildFinalizationStateCard,
  buildProjectPhotoStateCard,
  buildStagedAssets,
  buildSuggestionStateCard,
  formatProjectStats,
  getMemoryKindLabel,
  getSuggestionCandidateRefs,
  getThumbnailUri,
  MemoryComposerMode,
  MemoryComposerOptions,
  orderKey,
  parseCollectionHooks,
  pluralize,
  prioritizePrimary,
  ProjectAddIntent,
  resolveThumbnailPhotoId,
  StagedAsset,
  StatusCard,
  SUGGESTED_THEME_PAGE_LABELS,
  ThumbnailChoice
} from "../../src/features/projectScreen/helpers";
import { styles } from "../../src/features/projectScreen/styles";

const INLINE_PROJECT_SECTIONS_ENABLED = false;
const PHOTO_PICKER_SELECTION_LIMIT = 50;
const ANDROID_PHOTO_PICKER_IMPORTS_ENABLED = true;

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
  const [zipProgress, setZipProgress] = useState<string | undefined>(undefined);
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
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [customThemeLabel, setCustomThemeLabel] = useState("");
  const [themePhotoPickerVisible, setThemePhotoPickerVisible] = useState(false);
  const [themeSelectionLabel, setThemeSelectionLabel] = useState<string | null>(null);
  const [themeSelectionBusy, setThemeSelectionBusy] = useState(false);
  const [themeStagedAssets, setThemeStagedAssets] = useState<StagedAsset[]>([]);
  const [themeTargetVisible, setThemeTargetVisible] = useState(false);
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
  const regularMemories = useMemo(() => memories.filter(memory => !memory.bookRole), [memories]);
  const openingBookPart = useRef(false);
  async function openBookPart(role: NonNullable<Memory["bookRole"]>) {
    if (openingBookPart.current) return;
    openingBookPart.current = true;
    try {
      const existing = memories.find(memory => memory.bookRole === role);
      const id = existing?.id ?? await createMemory(projectId, role === "front-cover" ? "Front cover" : role === "back-cover" ? "Back cover" : "Dedication", { bookRole: role });
      router.push({ pathname: "/memory/[id]", params: { id } });
    } finally { openingBookPart.current = false; }
  }
  function bookPartCard(role: NonNullable<Memory["bookRole"]>) {
    const part = memories.find(memory => memory.bookRole === role);
    const photos = part ? getPhotosByMemoryId(part.id) : [];
    const populated = part && (photos.length > 0 || getPageSectionsByMemoryId(part.id).some(page => page.backgroundAssetId || page.backgroundColor || page.textBoxes?.some(box => box.text)));
    const title = role === "front-cover" ? "Front cover" : role === "back-cover" ? "Back cover" : "Dedication";
    return <Pressable key={role} onPress={() => void openBookPart(role)} onLongPress={() => { if (part) Alert.alert(`Remove ${title.toLowerCase()}?`, "This removes this book section and its imported photos.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => deleteMemory(part.id) }]); }} style={{ borderWidth: 1, borderStyle: populated ? "solid" : "dashed", borderColor: "#D8CFC2", backgroundColor: "#FBF6EE", borderRadius: 16, padding: 14, marginVertical: 8, gap: 8 }}>
      {populated && part && getPageSectionsByMemoryId(part.id)[0] && <BookPartPreview memory={part} section={getPageSectionsByMemoryId(part.id)[0]} photos={photos} overrides={slotOverridesByPage[getPageSectionsByMemoryId(part.id)[0].id]} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="book-outline" size={20} color="#6B5BD2" /><Text style={{ flex: 1, color: "#6B6156", fontWeight: "600" }}>{populated ? title : `Add ${title.toLowerCase()}`}</Text><Ionicons name="chevron-forward" size={18} color="#6B6156" /></View>
    </Pressable>;
  }
  const collectionMemories = useMemo(
    () => memories.filter((memory) => memory.kind === "collection"),
    [memories]
  );
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
    const contextOrder = orderKey(regularMemories);
    const localOrder = orderKey(memoryListData);

    if (pendingMemoryOrderKey) {
      if (contextOrder === pendingMemoryOrderKey) {
        setPendingMemoryOrderKey(undefined);
        if (localOrder !== contextOrder) {
          setMemoryListData(regularMemories);
        }
      }
      return;
    }

    if (localOrder !== contextOrder) {
      setMemoryListData(regularMemories);
    }
  }, [regularMemories, memoryListData, pendingMemoryOrderKey]);

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
  const suggestionReviewCandidateRefs = useMemo(
    () => getSuggestionCandidateRefs(suggestionReview),
    [suggestionReview]
  );
  const suggestionReviewPhotos = useMemo(
    () =>
      suggestionReview && suggestionReviewCandidateRefs.length === 0
        ? suggestionReview.candidatePhotoIds
            .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
            .filter((photo): photo is PhotoItem => Boolean(photo))
        : [],
    [projectPhotos, suggestionReview, suggestionReviewCandidateRefs.length]
  );

  const suggestionStateCard = useMemo(
    () =>
      buildSuggestionStateCard({
        suggestionScanState,
        suggestionScanError,
        lastSuggestionScanFeedback,
        suggestionCount: projectSuggestions.length
      }),
    [lastSuggestionScanFeedback, projectSuggestions.length, suggestionScanError, suggestionScanState]
  );

  const projectPhotoStateCard = useMemo(
    () =>
      buildProjectPhotoStateCard({
        projectPhotoFeedback,
        projectPhotoCount: projectPhotos.length,
        unassignedPhotoCount: unassignedProjectPhotos.length
      }),
    [projectPhotoFeedback, projectPhotos.length, unassignedProjectPhotos.length]
  );

  const finalizationStateCard = useMemo<StatusCard>(
    () => buildFinalizationStateCard(project, finalizationSuggestions.length),
    [finalizationSuggestions.length, project]
  );

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

  const openCreateComposer = useCallback((kind: Memory["kind"] = "event", options?: MemoryComposerOptions) => {
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle(options?.title ?? "");
    setComposerMemoryKind(kind);
    setComposerCollectionHooks(options?.collectionHooks ?? "");
    setComposerSelectedProjectPhotoIds(options?.photoIds ?? []);
    setComposerSourceSuggestionId(options?.suggestionId ?? null);
    setComposerStagedAssets(options?.stagedAssets ?? []);
    setComposerThumbnailChoice(
      options?.thumbnailChoice ??
        (options?.photoIds?.[0] ? { kind: "existing", photoId: options.photoIds[0] } : undefined) ??
        (options?.stagedAssets?.[0] ? { kind: "staged", stagedKey: options.stagedAssets[0].key } : undefined)
    );
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

    if (Platform.OS === "android" && ANDROID_PHOTO_PICKER_IMPORTS_ENABLED) {
      try {
        setComposerPicking(true);
        const result = await pickImagesWithAndroidPhotoPicker({
          selectionLimit: PHOTO_PICKER_SELECTION_LIMIT
        });
        if (result.available) {
          if (result.assets.length > 0) {
            const nextAssets = buildStagedAssets(result.assets);
            setComposerStagedAssets((prev) => [...prev, ...nextAssets]);
            setComposerThumbnailChoice((prev) => {
              if (prev) {
                return prev;
              }
              const first = nextAssets[0];
              return first ? { kind: "staged", stagedKey: first.key } : undefined;
            });
          }
          return;
        }
      } finally {
        setComposerPicking(false);
      }
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
          themeLabel: composerMemoryKind === "collection" ? trimmedTitle : undefined,
          themeTags: composerMemoryKind === "collection" ? composerCollectionTags : undefined
        });
        if (composerSelectedProjectPhotoIds.length > 0) {
          assignPhotosToMemory(createdMemoryId, composerSelectedProjectPhotoIds);
        }
        const createdPhotoIds = await addPhotoAssetsToMemory(createdMemoryId, composerStagedAssets, { projectId });
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
          themeLabel: composerMemoryKind === "collection" ? trimmedTitle : undefined,
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

  const onExportPhotos = useCallback(async (includeUnplacedPhotos: boolean) => {
    if (!project || exporting) return;
    try {
      setExporting(true);
      setZipProgress("Preparing photos...");
      const result = await exportProjectPhotosToZip(project, memories, getPhotosByProjectId(project.id),
        memories.flatMap((memory) => getPageSectionsByMemoryId(memory.id)), slotOverridesByPage,
        ({ completed, total }) => setZipProgress(`Packing ${completed} of ${total}...`), includeUnplacedPhotos);
      setZipProgress("Opening share sheet...");
      await sharePhotoZip(result.uri);
      Alert.alert("Photo ZIP prepared", `${result.exported} photo files packed. ${result.storedCopies} used stored copies; ${result.missing} were unavailable. See export-report.json inside the ZIP for details.`);
    } catch (error) {
      Alert.alert("Unable to export photos", (error as Error).message);
    } finally {
      setZipProgress(undefined);
      setExporting(false);
    }
  }, [exporting, getPageSectionsByMemoryId, getPhotosByProjectId, memories, project, slotOverridesByPage]);

  const choosePhotoExportScope = useCallback(() => {
    if (exporting) return;
    Alert.alert("Export project photos", "Include all photos, or only the photos currently shown on book pages?", [
      { text: "Cancel", style: "cancel" },
      { text: "Only photos on pages", onPress: () => void onExportPhotos(false) },
      { text: "All photos", onPress: () => void onExportPhotos(true) }
    ]);
  }, [exporting, onExportPhotos]);

  const onExportPdf = useCallback(async () => {
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
      Alert.alert("Unable to export PDF", (error as Error).message);
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
      setThemePickerVisible(true);
      return;
    }
    setSuggestionsModalVisible(true);
    setSuggestionsExpanded(true);
  }, [openCreateComposer]);

  const resetThemeFlow = useCallback(() => {
    setThemePickerVisible(false);
    setCustomThemeLabel("");
    setThemePhotoPickerVisible(false);
    setThemeSelectionLabel(null);
    setThemeStagedAssets([]);
    setThemeTargetVisible(false);
    setThemeSelectionBusy(false);
  }, []);

  const openThemePhotoPicker = useCallback(async (label: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }
    setThemePickerVisible(false);
    setThemeSelectionLabel(trimmedLabel);

    if (Platform.OS === "android" && ANDROID_PHOTO_PICKER_IMPORTS_ENABLED) {
      try {
        setThemeSelectionBusy(true);
        const result = await pickImagesWithAndroidPhotoPicker({
          searchQuery: trimmedLabel,
          selectionLimit: PHOTO_PICKER_SELECTION_LIMIT
        });
        if (result.available) {
          if (result.assets.length > 0) {
            setThemeStagedAssets(buildStagedAssets(result.assets));
            setThemeTargetVisible(true);
          } else {
            setThemeSelectionLabel(null);
          }
          return;
        }
      } finally {
        setThemeSelectionBusy(false);
      }
    }

    setThemePhotoPickerVisible(true);
  }, []);

  const onImportThemePhotos = useCallback(async (assetIds: string[]) => {
    if (!themeSelectionLabel || themeSelectionBusy) {
      return;
    }
    try {
      setThemeSelectionBusy(true);
      const selected = await pickPhotosFromMediaLibraryByAssetIds(assetIds);
      if (selected.length === 0) {
        setThemePhotoPickerVisible(false);
        return;
      }
      setThemeStagedAssets(buildStagedAssets(selected));
      setThemePhotoPickerVisible(false);
      setThemeTargetVisible(true);
    } catch (error) {
      Alert.alert("Unable to add theme photos", (error as Error).message);
    } finally {
      setThemeSelectionBusy(false);
    }
  }, [themeSelectionBusy, themeSelectionLabel]);

  const createNewThemeCollection = useCallback(() => {
    if (!themeSelectionLabel || themeStagedAssets.length === 0) {
      return;
    }
    const stagedAssets = themeStagedAssets;
    const first = stagedAssets[0];
    openCreateComposer("collection", {
      title: themeSelectionLabel,
      collectionHooks: themeSelectionLabel,
      stagedAssets,
      thumbnailChoice: first ? { kind: "staged", stagedKey: first.key } : undefined
    });
    setThemeTargetVisible(false);
    setThemeSelectionLabel(null);
    setThemeStagedAssets([]);
    setCustomThemeLabel("");
  }, [openCreateComposer, themeSelectionLabel, themeStagedAssets]);

  const addThemePhotosToCollection = useCallback(
    async (memoryId: string) => {
      if (themeStagedAssets.length === 0 || themeSelectionBusy) {
        return;
      }
      try {
        setThemeSelectionBusy(true);
        const createdPhotoIds = await addPhotoAssetsToMemory(memoryId, themeStagedAssets);
        const targetMemory = memories.find((memory) => memory.id === memoryId);
        if (!targetMemory?.primaryPhotoId && createdPhotoIds[0]) {
          setMemoryPrimaryPhoto(memoryId, createdPhotoIds[0]);
        }
        resetThemeFlow();
      } catch (error) {
        Alert.alert("Unable to add to collection", (error as Error).message);
        setThemeSelectionBusy(false);
      }
    },
    [addPhotoAssetsToMemory, memories, resetThemeFlow, setMemoryPrimaryPhoto, themeSelectionBusy, themeStagedAssets]
  );

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
    const candidateRefs = getSuggestionCandidateRefs(suggestion);
    setSuggestionReviewId(suggestion.id);
    setSuggestionSelectedPhotoIds(
      candidateRefs.length > 0 ? candidateRefs.map((ref) => ref.id) : suggestion.candidatePhotoIds
    );
  }, [projectSuggestions]);

  const closeSuggestionReview = useCallback(() => {
    setSuggestionReviewId(null);
    setSuggestionSelectedPhotoIds([]);
  }, []);

  const createMemoryFromReviewedSuggestion = useCallback(async () => {
    const suggestion = projectSuggestions.find((item) => item.id === suggestionReviewId);
    if (!suggestion || suggestionSelectedPhotoIds.length === 0) {
      return;
    }
    const candidateRefs = getSuggestionCandidateRefs(suggestion);
    const selectedCandidateRefs = candidateRefs.filter((ref) => suggestionSelectedPhotoIds.includes(ref.id));

    if (selectedCandidateRefs.length > 0) {
      try {
        setActiveSuggestionId(suggestion.id);
        const selected = await pickPhotosFromMediaLibraryByAssetIds(
          selectedCandidateRefs.map((ref) => ref.assetId)
        );
        if (selected.length === 0) {
          Alert.alert("Unable to import photos", "The selected library photos could not be opened.");
          return;
        }
        const stagedAssets = buildStagedAssets(selected);
        closeSuggestionReview();
        setSuggestionsModalVisible(false);
        openCreateComposer(suggestion.type === "collection" ? "collection" : "event", {
          title: suggestion.title,
          stagedAssets,
          suggestionId: suggestion.id
        });
      } catch (error) {
        Alert.alert("Unable to import photos", (error as Error).message);
      } finally {
        setActiveSuggestionId(null);
      }
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
    (suggestion: Suggestion) => (
      <SuggestionCard
        key={suggestion.id}
        suggestion={suggestion}
        activeSuggestionId={activeSuggestionId}
        projectPhotos={projectPhotos}
        openSuggestionReview={openSuggestionReview}
        onKeepWatchingSuggestion={onKeepWatchingSuggestion}
        onSnoozeSuggestion={onSnoozeSuggestion}
        onDismissSuggestion={onDismissSuggestion}
      />
    ),
    [activeSuggestionId, onDismissSuggestion, onKeepWatchingSuggestion, onSnoozeSuggestion, openSuggestionReview, projectPhotos]
  );

  const renderFinalizationSuggestionCard = useCallback((suggestion: FinalizationSuggestion) => (
    <FinalizationSuggestionCard
      key={suggestion.id}
      suggestion={suggestion}
      setFinalizationReviewSuggestion={setFinalizationReviewSuggestion}
    />
  ), []);

  const renderClusterCard = useCallback(
    (cluster: ProjectPhotoCluster) => (
      <ClusterCard
        key={cluster.id}
        cluster={cluster}
        projectPhotos={projectPhotos}
        openAnalysisInspector={openAnalysisInspector}
      />
    ),
    [openAnalysisInspector, projectPhotos]
  );

  const bottomToolbarHeight = insets.bottom + 76;
  const composerCanSave = composerTitle.trim().length > 0 && !composerSaving;

  if (!project) {
    return (
      <View style={[styles.missingScreen, { paddingTop: insets.top + 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
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
      <StatusBar style="dark" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topIconButton} onPress={() => router.replace("/")}>
          <Ionicons name="chevron-back" size={28} color="#241F1B" />
        </Pressable>
        <View style={styles.topBarTextWrap}>
          <Text numberOfLines={1} style={styles.projectTitle}>
            {project.name}
          </Text>
          <Text style={styles.projectStats}>{projectStats.text}</Text>
        </View>
        <Pressable style={styles.topIconButton} onPress={onOpenProjectMenu}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#241F1B" />
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
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: bottomToolbarHeight + 72
          }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListFooterComponent={
            <View><Pressable style={styles.suggestionEntry} onPress={() => openProjectAddIntent("suggestions")}>
              <Ionicons name="sparkles-outline" size={26} color="#6B5BD2" />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.suggestionTitle}>
                  {newSuggestions.length > 0 ? `${newSuggestions.length} suggested memories` : "Ideas from your photos"}
                </Text>
                <Text style={styles.suggestionMessage}>Find a few more stories for your book.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B5BD2" />
            </Pressable></View>
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <ProjectCoverCard projectId={project.id} />
              {memories.some(memory => memory.bookRole === "dedication") && bookPartCard("dedication")}
              {DEV_TOOLS_ENABLED && devToolsExpanded ? (
                <DevToolsSection
                  openAnalysisInspector={openAnalysisInspector}
                  openMediaLibraryPicker={openMediaLibraryPicker}
                  projectPhotoIntakeBusy={projectPhotoIntakeBusy}
                  onAddProjectPhotos={onAddProjectPhotos}
                  project={project}
                  projectPhotos={projectPhotos}
                  unassignedProjectPhotos={unassignedProjectPhotos}
                  updateProject={updateProject}
                  projectPhotoStateCard={projectPhotoStateCard}
                  projectPhotoPreview={projectPhotoPreview}
                  clusterAnalysisBusy={clusterAnalysisBusy}
                  analyzeAllProjectPhotosForClusters={analyzeAllProjectPhotosForClusters}
                  setClusterInspectorExpanded={setClusterInspectorExpanded}
                  clusterInspectorExpanded={clusterInspectorExpanded}
                  projectClusters={projectClusters}
                  clusterAnalysisFeedback={clusterAnalysisFeedback}
                  topProjectClusters={topProjectClusters}
                  renderClusterCard={renderClusterCard}
                />
              ) : null}

              {INLINE_PROJECT_SECTIONS_ENABLED ? (
                <InlineProjectSections
                  scanningSuggestions={scanningSuggestions}
                  onScanSuggestions={onScanSuggestions}
                  project={project}
                  suggestionSummary={suggestionSummary}
                  projectSuggestions={projectSuggestions}
                  setSuggestionsExpanded={setSuggestionsExpanded}
                  suggestionsExpanded={suggestionsExpanded}
                  dismissedSuggestions={dismissedSuggestions}
                  setShowDismissedSuggestions={setShowDismissedSuggestions}
                  showDismissedSuggestions={showDismissedSuggestions}
                  suggestionStateCard={suggestionStateCard}
                  suggestionScanState={suggestionScanState}
                  newSuggestions={newSuggestions}
                  renderSuggestionCard={renderSuggestionCard}
                  watchingSuggestions={watchingSuggestions}
                  snoozedSuggestions={snoozedSuggestions}
                  acceptedSuggestions={acceptedSuggestions}
                  setThemePickerVisible={setThemePickerVisible}
                  openThemePhotoPicker={openThemePhotoPicker}
                  onStartFinalization={onStartFinalization}
                  onCompleteFinalization={onCompleteFinalization}
                  finalizationSummary={finalizationSummary}
                  devToolsExpanded={devToolsExpanded}
                  setFinalizationExpanded={setFinalizationExpanded}
                  finalizationExpanded={finalizationExpanded}
                  finalizationSuggestions={finalizationSuggestions}
                  finalizationStateCard={finalizationStateCard}
                  missingMomentFinalizationSuggestions={missingMomentFinalizationSuggestions}
                  renderFinalizationSuggestionCard={renderFinalizationSuggestionCard}
                  strongestUnusedFinalizationSuggestions={strongestUnusedFinalizationSuggestions}
                  highlightFinalizationSuggestions={highlightFinalizationSuggestions}
                />
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
            const memoryThumbnailUri = item.primaryPhotoId
              ? memoryPhotos.find((photo) => photo.id === item.primaryPhotoId)?.uri
              : undefined;
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
                    <MemoryCollagePreview photos={memoryPhotos} thumbnailUri={memoryThumbnailUri ?? memoryPhotos[0]?.uri} />
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
                        {pluralize(photoCount, "photo")} · {pluralize(pageCount, "page")}
                      </Text>
                      {item.kind === "collection" && item.themeTags && item.themeTags.length > 0 ? (
                        <Text style={styles.memoryTagsSummary}>{item.themeTags.join(" | ")}</Text>
                      ) : null}
                      {DEV_TOOLS_ENABLED && devToolsExpanded && candidatePhotos.length > 0 ? (
                        <Pressable
                          style={styles.memoryCandidateButton}
                          onPress={() => onOpenCandidateReview(item.id)}
                        >
                          <Ionicons name="sparkles-outline" size={14} color="#6B5BD2" />
                          <Text style={styles.memoryCandidateButtonText}>
                            Review {pluralize(candidatePhotos.length, "suggested addition")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => openEditComposer(item.id)} style={styles.memoryMenuButton}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#4A4239" />
                  </Pressable>
                </View>
              </ScaleDecorator>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="images-outline" size={34} color="#6B6156" />
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>Create the first memory with the add button below.</Text>
            </View>
          }
        />
      </View>

      <Pressable onPress={openProjectAddMenu} style={[styles.addButton, { bottom: bottomToolbarHeight + 12 }]}>
        <Ionicons name="add" size={22} color="#ffffff" />
        <Text style={styles.addButtonLabel}>Add memory</Text>
      </Pressable>

      <View style={[styles.bottomToolbar, { height: bottomToolbarHeight, paddingBottom: insets.bottom + 18 }]}>
        <Pressable style={styles.toolbarItem} onPress={() => router.replace("/")}>
          <Ionicons name="home-outline" size={22} color="#4A4239" />
          <Text style={styles.toolbarLabel}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => router.push({ pathname: "/project/[id]/preview", params: { id: project.id } })}
        >
          <Ionicons name="book-outline" size={22} color="#4A4239" />
          <Text style={styles.toolbarLabel}>Preview</Text>
        </Pressable>
        <Pressable style={styles.toolbarItem} onPress={onExportPdf} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#4A4239" /> : <Ionicons name="document-text-outline" size={22} color="#4A4239" />}
          <Text style={styles.toolbarLabel}>Export PDF</Text>
        </Pressable>
        <Pressable style={styles.toolbarItem} onPress={() => router.push("/prompts")}>
          <Ionicons name="notifications-outline" size={22} color="#4A4239" />
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
                <Ionicons name="construct-outline" size={20} color="#4A4239" />
                <Text style={styles.actionMenuButtonText}>
                  {devToolsExpanded ? "Hide Developer Tools" : "Show Developer Tools"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.actionMenuButton, exporting ? styles.suggestionActionDisabled : null]}
              onPress={onExportPdf}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export PDF"
            >
              {exporting && !zipProgress ? <ActivityIndicator color="#6B5BD2" /> : <Ionicons name="document-text-outline" size={20} color="#4A4239" />}
              <Text style={styles.actionMenuButtonText}>{exporting && !zipProgress ? "Preparing PDF..." : "Export PDF"}</Text>
            </Pressable>
            <Pressable style={[styles.actionMenuButton, exporting ? styles.suggestionActionDisabled : null]} onPress={choosePhotoExportScope} disabled={exporting}>
              {zipProgress ? <ActivityIndicator color="#6B5BD2" /> : <Ionicons name="download-outline" size={20} color="#4A4239" />}
              <Text style={styles.actionMenuButtonText}>{zipProgress ?? "Export photos (ZIP)"}</Text>
            </Pressable>
            <Pressable style={styles.actionMenuButton} onPress={onChangeProjectCover} disabled={projectMenuBusy}>
              {projectMenuBusy ? (
                <ActivityIndicator color="#4A4239" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#4A4239" />
              )}
              <Text style={styles.actionMenuButtonText}>Change Project Thumbnail</Text>
            </Pressable>
            <Pressable style={[styles.actionMenuButton, styles.actionMenuDanger]} onPress={onDeleteProjectFromMenu}>
              <Ionicons name="trash-outline" size={20} color="#AD432F" />
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
              <Ionicons name="images-outline" size={20} color="#4A4239" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Memory</Text>
                <Text style={styles.actionMenuHint}>Create an event memory and add photos.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("collection")}>
              <Ionicons name="albums-outline" size={20} color="#4A4239" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Collection</Text>
                <Text style={styles.actionMenuHint}>Create a theme collection with selected photos.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.actionMenuButton} onPress={() => openProjectAddIntent("suggestions")}>
              <Ionicons name="sparkles-outline" size={20} color="#4A4239" />
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

      <Modal transparent animationType="fade" visible={themePickerVisible} onRequestClose={() => setThemePickerVisible(false)}>
        <View style={styles.centerModalBackdrop}>
          <View style={styles.actionMenuCard}>
            <Text style={styles.modalTitle}>Choose Theme</Text>
            <Text style={styles.modalSubtitle}>
              Pick a suggested theme or enter your own. The next step lets you choose exact photos.
            </Text>
            <View style={styles.themeChipRow}>
              {SUGGESTED_THEME_PAGE_LABELS.map((label) => (
                <Pressable key={label} style={styles.themeChip} onPress={() => void openThemePhotoPicker(label)}>
                  <Text style={styles.themeChipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Custom Theme</Text>
            <TextInput
              value={customThemeLabel}
              onChangeText={setCustomThemeLabel}
              placeholder="Examples: Christmas, desserts, grandparents"
              placeholderTextColor="#6B6156"
              style={styles.modalInput}
            />
            <Pressable
              style={[styles.primaryAction, !customThemeLabel.trim() ? styles.primaryActionDisabled : null]}
              onPress={() => void openThemePhotoPicker(customThemeLabel)}
              disabled={!customThemeLabel.trim()}
            >
              <Text style={styles.primaryActionText}>Select Photos</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButtonLike}
              onPress={() => {
                setThemePickerVisible(false);
                openCreateComposer("collection");
              }}
            >
              <Text style={styles.secondaryButtonLikeText}>Blank Collection</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonLike} onPress={() => setThemePickerVisible(false)}>
              <Text style={styles.secondaryButtonLikeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={themeTargetVisible} onRequestClose={resetThemeFlow}>
        <View style={styles.centerModalBackdrop}>
          <View style={styles.actionMenuCard}>
            <Text style={styles.modalTitle}>{themeSelectionLabel ?? "Theme Photos"}</Text>
            <Text style={styles.modalSubtitle}>
              {pluralize(themeStagedAssets.length, "selected photo")} ready. Create a new collection or add them to an existing collection.
            </Text>
            {themeStagedAssets.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailPickerRow}>
                {themeStagedAssets.slice(0, 8).map((asset) => (
                  <View key={asset.key} style={styles.thumbnailOption}>
                    <Image source={{ uri: asset.uri }} style={styles.thumbnailOptionImage} />
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <Pressable
              style={[styles.actionMenuButton, themeSelectionBusy ? styles.suggestionActionDisabled : null]}
              onPress={createNewThemeCollection}
              disabled={themeSelectionBusy || themeStagedAssets.length === 0}
            >
              <Ionicons name="albums-outline" size={20} color="#4A4239" />
              <View style={styles.actionMenuTextBlock}>
                <Text style={styles.actionMenuButtonText}>Create New Collection</Text>
                <Text style={styles.actionMenuHint}>Name it, confirm the thumbnail, then save.</Text>
              </View>
            </Pressable>
            {collectionMemories.length > 0 ? (
              <>
                <Text style={styles.fieldLabel}>Add to Existing</Text>
                {collectionMemories.map((memory) => (
                  <Pressable
                    key={memory.id}
                    style={[styles.actionMenuButton, themeSelectionBusy ? styles.suggestionActionDisabled : null]}
                    onPress={() => void addThemePhotosToCollection(memory.id)}
                    disabled={themeSelectionBusy}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#4A4239" />
                    <View style={styles.actionMenuTextBlock}>
                      <Text style={styles.actionMenuButtonText}>{memory.title}</Text>
                      <Text style={styles.actionMenuHint}>
                        {memory.themeTags && memory.themeTags.length > 0 ? memory.themeTags.join(" | ") : "Collection"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}
            <Pressable style={styles.secondaryButtonLike} onPress={resetThemeFlow} disabled={themeSelectionBusy}>
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
                  <Ionicons name="close" size={22} color="#4A4239" />
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
                      <ActivityIndicator color="#4A4239" size="small" />
                    ) : (
                      <>
                        <Ionicons name="search-outline" size={15} color="#4A4239" />
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
                      <ActivityIndicator color="#4A4239" />
                    ) : (
                      <Ionicons
                        name={suggestionStateCard.icon}
                        size={24}
                        color={
                          suggestionStateCard.tone === "error"
                            ? "#AD432F"
                            : suggestionStateCard.tone === "success"
                              ? "#327558"
                              : "#6B5BD2"
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
                  <Ionicons name="close" size={22} color="#4A4239" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {suggestionReview ? (
                  <Text style={styles.suggestionMessage}>{suggestionReview.message}</Text>
                ) : null}

                {suggestionReviewCandidateRefs.length > 0 ? (
                  <View style={styles.candidateGrid}>
                    {suggestionReviewCandidateRefs.map((ref) => {
                      const selected = suggestionSelectedPhotoIds.includes(ref.id);
                      return (
                        <Pressable
                          key={ref.id}
                          style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                          onPress={() =>
                            setSuggestionSelectedPhotoIds((prev) =>
                              prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id]
                            )
                          }
                        >
                          <Image source={{ uri: ref.uri }} style={styles.candidateGridImage} />
                          <View style={[styles.candidateGridCheck, selected ? styles.candidateGridCheckSelected : null]}>
                            <Ionicons
                              name={selected ? "checkmark" : "add"}
                              size={16}
                              color={selected ? "#ffffff" : "#4A4239"}
                            />
                          </View>
                          {ref.location ? (
                            <View style={styles.mediaLibraryProbeBadge}>
                              <Text style={styles.mediaLibraryProbeBadgeText}>GPS</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : suggestionReviewPhotos.length > 0 ? (
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
                              color={selected ? "#ffffff" : "#4A4239"}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="images-outline" size={30} color="#6B6156" />
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
                      suggestionSelectedPhotoIds.length === 0 || activeSuggestionId === suggestionReview?.id
                        ? styles.primaryActionDisabled
                        : null
                    ]}
                    onPress={createMemoryFromReviewedSuggestion}
                    disabled={suggestionSelectedPhotoIds.length === 0 || activeSuggestionId === suggestionReview?.id}
                  >
                    <Text style={styles.primaryActionText}>
                      {activeSuggestionId === suggestionReview?.id
                        ? "Importing..."
                        : suggestionSelectedPhotoIds.length === 0
                          ? "Select Photos"
                          : "Create"}
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
                  <Ionicons name="close" size={22} color="#4A4239" />
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
                              color={selected ? "#ffffff" : "#4A4239"}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="sparkles-outline" size={30} color="#6B6156" />
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
                  <Ionicons name="close" size={22} color="#4A4239" />
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
                    <Ionicons name="albums-outline" size={30} color="#6B6156" />
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

      <AnalysisInspectorModal
        analysisInspectorVisible={analysisInspectorVisible}
        closeAnalysisInspector={closeAnalysisInspector}
        analysisInspectorBusy={analysisInspectorBusy}
        inspectorSelectablePhotos={inspectorSelectablePhotos}
        selectedInspectorPhoto={selectedInspectorPhoto}
        setAnalysisInspectorPhotoId={setAnalysisInspectorPhotoId}
        analysisInspectorFeedback={analysisInspectorFeedback}
        setAnalysisInspectorFeedback={setAnalysisInspectorFeedback}
        runInspectorAnalysis={runInspectorAnalysis}
        inspectorDebugReport={inspectorDebugReport}
        logInspectorDebugReport={logInspectorDebugReport}
        analysisInspectorProbe={analysisInspectorProbe}
        analysisInspectorProbeBusy={analysisInspectorProbeBusy}
        heuristicScenePreview={heuristicScenePreview}
        heuristicFacePreview={heuristicFacePreview}
        nativeLabelProbe={nativeLabelProbe}
        nativeLabelProbeBusy={nativeLabelProbeBusy}
        nativeFaceProbe={nativeFaceProbe}
        nativeFaceProbeBusy={nativeFaceProbeBusy}
      />

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
        subtitle="Fallback selector for devices where the Android Photo Picker path is unavailable."
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
        visible={themePhotoPickerVisible}
        title={themeSelectionLabel ? `Pick ${themeSelectionLabel} Photos` : "Pick Theme Photos"}
        subtitle="Fallback selector for devices where Photo Picker search highlighting is unavailable."
        confirmLabel="Use Selected Photos"
        selectionMode="multiple"
        confirming={themeSelectionBusy}
        bottomInset={insets.bottom}
        onClose={() => {
          if (!themeSelectionBusy) {
            resetThemeFlow();
          }
        }}
        onConfirm={onImportThemePhotos}
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
                  <Text style={styles.modalTitle}>
                    {composerMode === "create"
                      ? composerMemoryKind === "collection"
                        ? "New Collection"
                        : "New Memory"
                      : composerMemoryKind === "collection"
                        ? "Edit Collection"
                        : "Edit Memory"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {composerMemoryKind === "collection"
                      ? "Set a title, pick starting photos, and choose the collection thumbnail."
                      : "Set a title, pick starting photos, and choose the memory thumbnail."}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeComposer}>
                  <Ionicons name="close" size={22} color="#4A4239" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>
                  {composerMemoryKind === "collection" ? "Collection Title" : "Memory Title"}
                </Text>
                <TextInput
                  value={composerTitle}
                  onChangeText={setComposerTitle}
                  placeholder={composerMemoryKind === "collection" ? "Collection title" : "Memory title"}
                  placeholderTextColor="#6B6156"
                  style={styles.modalInput}
                />

                {composerMemoryKind === "collection" ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Collection Hooks</Text>
                    <TextInput
                      value={composerCollectionHooks}
                      onChangeText={setComposerCollectionHooks}
                      placeholder="Examples: hiking, family, sunsets"
                      placeholderTextColor="#6B6156"
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
                        <Ionicons name="sparkles-outline" size={24} color="#6B6156" />
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={styles.inlineActionRow}>
                  <Text style={styles.fieldLabel}>Photos</Text>
                  <Pressable style={styles.inlineButton} onPress={onPickComposerPhotos} disabled={composerPicking}>
                    {composerPicking ? (
                      <ActivityIndicator color="#4A4239" />
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
                      <Ionicons name="image-outline" size={32} color="#6B6156" />
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
                      <Ionicons name="images-outline" size={28} color="#6B6156" />
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
