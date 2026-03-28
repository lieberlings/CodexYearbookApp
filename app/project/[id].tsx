import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAppData } from "../../src/context/AppContext";
import { exportProjectToPdf, sharePdf } from "../../src/services/exportService";
import { suggestCandidatePhotosForMemory, suggestCollectionCandidatePhotos } from "../../src/services/promptEngine";
import { PickedPhotoAsset, pickImagesFromLibrary } from "../../src/services/photoService";
import { useEditorStore } from "../../src/state/editorStore";
import { Memory, PhotoItem, Suggestion } from "../../src/types";

type MemoryComposerMode = "create" | "edit";
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

function buildStagedAssets(assets: PickedPhotoAsset[]): StagedAsset[] {
  return assets.map((asset, index) => ({
    key: `staged-${Date.now()}-${index}-${asset.fileName ?? "photo"}`,
    uri: asset.uri,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
    capturedAt: asset.capturedAt,
    location: asset.location
  }));
}

function getThumbnailUri(
  choice: ThumbnailChoice | undefined,
  existingPhotos: PhotoItem[],
  stagedAssets: StagedAsset[]
): string | undefined {
  if (!choice) {
    return undefined;
  }
  if (choice.kind === "existing") {
    return existingPhotos.find((photo) => photo.id === choice.photoId)?.uri;
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
    getSuggestionsByProjectId,
    scanProjectSuggestions,
    acceptSuggestion,
    keepWatchingSuggestion,
    dismissSuggestion,
    snoozeSuggestion,
    createMemory,
    updateMemory,
    deleteMemory,
    reorderMemory,
    updateProject,
    deleteProject,
    pickProjectThumbnail,
    setMemoryPrimaryPhoto,
    addPhotoAssetsToMemory,
    addPhotosToProject,
    assignPhotosToMemory
  } = useAppData();
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);

  const [exporting, setExporting] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<MemoryComposerMode>("create");
  const [composerMemoryId, setComposerMemoryId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerMemoryKind, setComposerMemoryKind] = useState<Memory["kind"]>("event");
  const [composerCollectionHooks, setComposerCollectionHooks] = useState("");
  const [composerSelectedProjectPhotoIds, setComposerSelectedProjectPhotoIds] = useState<string[]>([]);
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
  const [showDismissedSuggestions, setShowDismissedSuggestions] = useState(false);
  const [projectPhotoIntakeBusy, setProjectPhotoIntakeBusy] = useState(false);
  const [projectPhotoFeedback, setProjectPhotoFeedback] = useState<StatusCard | undefined>(undefined);
  const [lastSuggestionScanFeedback, setLastSuggestionScanFeedback] = useState<
    | {
        generatedCount: number;
        source: "manual" | "intake";
      }
    | undefined
  >(undefined);
  const [candidateReviewMemoryId, setCandidateReviewMemoryId] = useState<string | null>(null);
  const [candidateSelectedPhotoIds, setCandidateSelectedPhotoIds] = useState<string[]>([]);

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
    () => getThumbnailUri(composerThumbnailChoice, composerExistingPhotos, composerStagedAssets),
    [composerExistingPhotos, composerStagedAssets, composerThumbnailChoice]
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
    setComposerStagedAssets([]);
    setComposerThumbnailChoice(undefined);
    setComposerSaving(false);
    setComposerPicking(false);
  }, []);

  const closeCandidateReview = useCallback(() => {
    setCandidateReviewMemoryId(null);
    setCandidateSelectedPhotoIds([]);
  }, []);

  const openCreateComposer = useCallback(() => {
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle("");
    setComposerMemoryKind("event");
    setComposerCollectionHooks("");
    setComposerSelectedProjectPhotoIds([]);
    setComposerStagedAssets([]);
    setComposerThumbnailChoice(undefined);
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
    try {
      setComposerPicking(true);
      const selected = await pickImagesFromLibrary();
      if (selected.length === 0) {
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
    projectId,
    composerSelectedProjectPhotoIds,
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
    Alert.alert(project?.name ?? "Project", "", [
      {
        text: projectMenuBusy ? "Working..." : "Change Cover Photo",
        onPress: async () => {
          if (!project || projectMenuBusy) {
            return;
          }
          try {
            setProjectMenuBusy(true);
            const uri = await pickProjectThumbnail();
            if (uri) {
              updateProject(project.id, { thumbnailUri: uri });
            }
          } catch (error) {
            Alert.alert("Unable to change project cover", (error as Error).message);
          } finally {
            setProjectMenuBusy(false);
          }
        }
      },
      {
        text: "Delete Project",
        style: "destructive",
        onPress: () => {
          if (!project) {
            return;
          }
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
        }
      },
      { text: "Cancel", style: "cancel" }
    ]);
  }, [deleteProject, pickProjectThumbnail, project, projectMenuBusy, updateProject]);

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

  const onAddProjectPhotos = useCallback(async () => {
    if (!project || projectPhotoIntakeBusy) {
      return;
    }
    try {
      setProjectPhotoIntakeBusy(true);
      setProjectPhotoFeedback(undefined);
      const addedCount = await addPhotosToProject(project.id);
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
      setProjectPhotoIntakeBusy(false);
    }
  }, [addPhotosToProject, project, projectPhotoIntakeBusy, scanProjectSuggestions]);

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

  const onAcceptSuggestion = useCallback(
    async (suggestionId: string) => {
      try {
        setActiveSuggestionId(suggestionId);
        await acceptSuggestion(suggestionId);
      } finally {
        setActiveSuggestionId(null);
      }
    },
    [acceptSuggestion]
  );

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

  const renderSuggestionCard = useCallback(
    (suggestion: Suggestion) => {
      const statusStyles = getSuggestionStatusStyle(suggestion.status);
      const isBusy = activeSuggestionId === suggestion.id;
      const candidateCount = suggestion.candidatePhotoIds.length;
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

          <View style={styles.suggestionActionRow}>
            {suggestion.status === "accepted" && suggestion.acceptedMemoryId ? (
              <Pressable
                style={[styles.suggestionActionButton, styles.suggestionPrimaryAction]}
                onPress={() => router.push({ pathname: "/memory/[id]", params: { id: suggestion.acceptedMemoryId! } })}
                >
                  <Text style={styles.suggestionPrimaryActionText}>Open Memory</Text>
                </Pressable>
            ) : suggestion.type === "collection" ? (
              <Pressable
                style={[
                  styles.suggestionActionButton,
                  styles.suggestionPrimaryAction,
                  isBusy || suggestion.status === "accepted" ? styles.suggestionActionDisabled : null
                ]}
                onPress={() => void onAcceptSuggestion(suggestion.id)}
                disabled={isBusy || suggestion.status === "accepted"}
              >
                <Text style={styles.suggestionPrimaryActionText}>{isBusy ? "Working..." : "Create Collection"}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.suggestionActionButton,
                  styles.suggestionPrimaryAction,
                  isBusy || suggestion.status === "accepted" ? styles.suggestionActionDisabled : null
                ]}
                onPress={() => void onAcceptSuggestion(suggestion.id)}
                disabled={isBusy || suggestion.status === "accepted"}
              >
                <Text style={styles.suggestionPrimaryActionText}>{isBusy ? "Working..." : "Accept"}</Text>
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
    [activeSuggestionId, onAcceptSuggestion, onDismissSuggestion, onKeepWatchingSuggestion, onSnoozeSuggestion]
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
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Project Photos</Text>
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
                    <View key={photo.id} style={styles.projectPhotoThumbWrap}>
                      <Image source={{ uri: photo.uri }} style={styles.projectPhotoThumb} />
                    </View>
                  ))}
                </ScrollView>
              ) : null}

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
                      <Text style={styles.scanButtonText}>Scan Suggestions</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={styles.sectionSubheading}>
                Event and collection suggestions for this project. Actions stay local and will not create pages automatically.
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
                      {candidatePhotos.length > 0 ? (
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

      <Pressable onPress={openCreateComposer} style={[styles.addButton, { bottom: toolbarBottom + 22 }]}>
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

                {composerMemoryKind === "collection" ? (
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
                  {composerExistingPhotos.length === 0 && composerStagedAssets.length === 0 ? (
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeading: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "800"
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

