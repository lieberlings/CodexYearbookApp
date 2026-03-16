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
import { pickImagesFromLibrary } from "../../src/services/photoService";
import { useEditorStore } from "../../src/state/editorStore";
import { Memory, PhotoItem } from "../../src/types";

type MemoryComposerMode = "create" | "edit";

type StagedAsset = {
  key: string;
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
};

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

function buildStagedAssets(
  assets: { uri: string; fileName?: string | null; width?: number; height?: number }[]
): StagedAsset[] {
  return assets.map((asset, index) => ({
    key: `staged-${Date.now()}-${index}-${asset.fileName ?? "photo"}`,
    uri: asset.uri,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height
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
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    createMemory,
    updateMemory,
    deleteMemory,
    reorderMemory,
    updateProject,
    deleteProject,
    pickProjectThumbnail,
    setMemoryPrimaryPhoto,
    addPhotoAssetsToMemory
  } = useAppData();
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);

  const [exporting, setExporting] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<MemoryComposerMode>("create");
  const [composerMemoryId, setComposerMemoryId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerStagedAssets, setComposerStagedAssets] = useState<StagedAsset[]>([]);
  const [composerThumbnailChoice, setComposerThumbnailChoice] = useState<ThumbnailChoice | undefined>(undefined);
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerPicking, setComposerPicking] = useState(false);
  const [projectMenuBusy, setProjectMenuBusy] = useState(false);
  const [memoryListData, setMemoryListData] = useState<Memory[]>([]);
  const [pendingMemoryOrderKey, setPendingMemoryOrderKey] = useState<string | undefined>(undefined);

  const project = getProjectById(projectId);
  const memories = useMemo(() => getMemoriesByProjectId(projectId), [getMemoriesByProjectId, projectId]);

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
    let photoCount = 0;
    let pageCount = 0;
    for (const memory of memories) {
      photoCount += getPhotosByMemoryId(memory.id).length;
      pageCount += getPageSectionsByMemoryId(memory.id).length;
    }
    return {
      memoryCount: memories.length,
      photoCount,
      pageCount,
      text: formatProjectStats(memories.length, photoCount, pageCount)
    };
  }, [getPageSectionsByMemoryId, getPhotosByMemoryId, memories]);

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

  const composerThumbnailUri = useMemo(
    () => getThumbnailUri(composerThumbnailChoice, composerExistingPhotos, composerStagedAssets),
    [composerExistingPhotos, composerStagedAssets, composerThumbnailChoice]
  );

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle("");
    setComposerStagedAssets([]);
    setComposerThumbnailChoice(undefined);
    setComposerSaving(false);
    setComposerPicking(false);
  }, []);

  const openCreateComposer = useCallback(() => {
    setComposerMode("create");
    setComposerMemoryId(null);
    setComposerTitle("");
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
        const createdMemoryId = await createMemory(projectId, trimmedTitle);
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
        updateMemory(composerMemoryId, { title: trimmedTitle });
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
    closeComposer,
    composerMemoryId,
    composerMode,
    composerSaving,
    composerStagedAssets,
    composerThumbnailChoice,
    composerTitle,
    createMemory,
    projectId,
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Memories</Text>
        </View>

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
                      <Text numberOfLines={1} style={styles.memoryName}>
                        {item.title}
                      </Text>
                      <Text style={styles.memorySummary}>
                        {pluralize(photoCount, "photo")} â€¢ {pluralize(pageCount, "page")}
                      </Text>
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
  sectionHeaderRow: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6
  },
  sectionHeading: {
    color: "#f8fbff",
    fontSize: 22,
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
  fieldLabel: {
    color: "#dce7ff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
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

