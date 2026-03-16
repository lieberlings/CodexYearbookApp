import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../src/context/AppContext";

type ProjectComposerMode = "create" | "edit";

type ProjectCardStats = {
  memoryCount: number;
  pageCount: number;
  photoCount: number;
  previewUri?: string;
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatProjectStats(memoryCount: number, pageCount: number, photoCount: number): string {
  return `${pluralize(memoryCount, "memory")} | ${pluralize(pageCount, "page")} | ${pluralize(photoCount, "photo")}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomToolbarHeight = insets.bottom + 102;
  const {
    loading,
    projects,
    createProject,
    updateProject,
    deleteProject,
    pickProjectThumbnail,
    getMemoriesByProjectId,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    getMemoryThumbnailUri
  } = useAppData();

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<ProjectComposerMode>("create");
  const [composerProjectId, setComposerProjectId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerThumbnailUri, setComposerThumbnailUri] = useState<string | undefined>(undefined);
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerPicking, setComposerPicking] = useState(false);

  const projectStatsById = useMemo(() => {
    const stats = new Map<string, ProjectCardStats>();
    for (const project of projects) {
      const projectMemories = getMemoriesByProjectId(project.id);
      let photoCount = 0;
      let pageCount = 0;
      let previewUri = project.thumbnailUri;

      for (const memory of projectMemories) {
        photoCount += getPhotosByMemoryId(memory.id).length;
        pageCount += getPageSectionsByMemoryId(memory.id).length;
        if (!previewUri) {
          previewUri = getMemoryThumbnailUri(memory.id);
        }
      }

      stats.set(project.id, {
        memoryCount: projectMemories.length,
        pageCount,
        photoCount,
        previewUri
      });
    }
    return stats;
  }, [getMemoriesByProjectId, getMemoryThumbnailUri, getPageSectionsByMemoryId, getPhotosByMemoryId, projects]);

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerMode("create");
    setComposerProjectId(null);
    setComposerTitle("");
    setComposerThumbnailUri(undefined);
    setComposerSaving(false);
    setComposerPicking(false);
  }, []);

  const openCreateComposer = useCallback(() => {
    setComposerMode("create");
    setComposerProjectId(null);
    setComposerTitle("");
    setComposerThumbnailUri(undefined);
    setComposerVisible(true);
  }, []);

  const openEditComposer = useCallback(
    (projectId: string) => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) {
        return;
      }
      setComposerMode("edit");
      setComposerProjectId(project.id);
      setComposerTitle(project.name);
      setComposerThumbnailUri(project.thumbnailUri);
      setComposerVisible(true);
    },
    [projects]
  );

  const onPickComposerThumbnail = useCallback(async () => {
    try {
      setComposerPicking(true);
      const uri = await pickProjectThumbnail();
      if (uri) {
        setComposerThumbnailUri(uri);
      }
    } catch (error) {
      Alert.alert("Unable to pick thumbnail", (error as Error).message);
    } finally {
      setComposerPicking(false);
    }
  }, [pickProjectThumbnail]);

  const onSaveComposer = useCallback(async () => {
    const trimmedTitle = composerTitle.trim();
    if (!trimmedTitle || composerSaving) {
      return;
    }

    try {
      setComposerSaving(true);
      if (composerMode === "create") {
        const projectId = await createProject(trimmedTitle, "general", composerThumbnailUri);
        closeComposer();
        router.push({ pathname: "/project/[id]", params: { id: projectId } });
      } else if (composerProjectId) {
        updateProject(composerProjectId, { name: trimmedTitle, thumbnailUri: composerThumbnailUri });
        closeComposer();
      }
    } catch (error) {
      Alert.alert("Unable to save project", (error as Error).message);
      setComposerSaving(false);
    }
  }, [closeComposer, composerMode, composerProjectId, composerSaving, composerThumbnailUri, composerTitle, createProject, updateProject]);

  const onDeleteProjectPress = useCallback(() => {
    if (!composerProjectId) {
      return;
    }
    Alert.alert("Delete project", "Delete this project, all memories, and all photos inside it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProject(composerProjectId);
          closeComposer();
        }
      }
    ]);
  }, [closeComposer, composerProjectId, deleteProject]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2f80ff" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingHorizontal: 22,
          paddingBottom: bottomToolbarHeight + 72
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.avatarCircle}>
            <Ionicons name="book-outline" size={22} color="#2f80ff" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.screenTitle}>Your Projects</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Projects</Text>

        <View style={styles.projectList}>
          {projects.map((project) => {
            const stats = projectStatsById.get(project.id) ?? {
              memoryCount: 0,
              pageCount: 0,
              photoCount: 0,
              previewUri: project.thumbnailUri
            };

            return (
              <View key={project.id} style={styles.projectCard}>
                <Pressable
                  onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}
                  style={styles.projectCardPressable}
                >
                  {stats.previewUri ? (
                    <Image source={{ uri: stats.previewUri }} style={styles.projectPreview} />
                  ) : (
                    <View style={[styles.projectPreview, styles.projectPreviewPlaceholder]}>
                      <Ionicons name="images-outline" size={42} color="#7084ad" />
                    </View>
                  )}
                  <View style={styles.projectInfo}>
                    <Text numberOfLines={1} style={styles.projectTitle}>
                      {project.name}
                    </Text>
                    <Text style={styles.projectMeta}>
                      {formatProjectStats(stats.memoryCount, stats.pageCount, stats.photoCount)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable hitSlop={10} onPress={() => openEditComposer(project.id)} style={styles.projectMenuButton}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#d7e2ff" />
                </Pressable>
              </View>
            );
          })}

          {projects.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={38} color="#62759c" />
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyText}>Use the add button below to create the first one.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable onPress={openCreateComposer} style={[styles.addButton, { bottom: insets.bottom + 32 }]}>
        <Ionicons name="add" size={34} color="#ffffff" />
      </Pressable>

      <View style={[styles.bottomToolbar, { height: bottomToolbarHeight, paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => Alert.alert("Settings", "Settings screen is not wired yet.")}
        >
          <Ionicons name="settings-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Settings</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => Alert.alert("Orders", "Open a project and use Order there for now.")}
        >
          <Ionicons name="bag-handle-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Orders</Text>
        </Pressable>
        <View style={styles.toolbarCenterSpacer} />
        <Pressable style={styles.toolbarItem} onPress={() => router.push("/prompts")}>
          <Ionicons name="notifications-outline" size={22} color="#d2def5" />
          <Text style={styles.toolbarLabel}>Notifications</Text>
        </Pressable>
        <View style={styles.toolbarGhostSpacer} />
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
                  <Text style={styles.modalTitle}>{composerMode === "create" ? "New Project" : "Edit Project"}</Text>
                  <Text style={styles.modalSubtitle}>Set the title and choose the project cover thumbnail.</Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeComposer}>
                  <Ionicons name="close" size={22} color="#eef4ff" />
                </Pressable>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.fieldLabel}>Project Title</Text>
                <TextInput
                  value={composerTitle}
                  onChangeText={setComposerTitle}
                  placeholder="Project title"
                  placeholderTextColor="#6f7f9f"
                  style={styles.modalInput}
                />

                <Text style={styles.fieldLabel}>Thumbnail</Text>
                <View style={styles.thumbnailPreviewCard}>
                  {composerThumbnailUri ? (
                    <Image source={{ uri: composerThumbnailUri }} style={styles.thumbnailPreviewImage} />
                  ) : (
                    <View style={styles.thumbnailPreviewPlaceholder}>
                      <Ionicons name="image-outline" size={34} color="#6c7c9d" />
                      <Text style={styles.thumbnailPreviewPlaceholderText}>Pick a project thumbnail</Text>
                    </View>
                  )}
                </View>

                <Pressable style={styles.inlineButton} onPress={onPickComposerThumbnail} disabled={composerPicking}>
                  {composerPicking ? (
                    <ActivityIndicator color="#eef4ff" />
                  ) : (
                    <Text style={styles.inlineButtonText}>Pick Thumbnail</Text>
                  )}
                </Pressable>

                <View style={styles.modalActions}>
                  {composerMode === "edit" ? (
                    <Pressable style={styles.deleteProjectButton} onPress={onDeleteProjectPress}>
                      <Text style={styles.deleteProjectButtonText}>Delete Project</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.primaryAction, !composerTitle.trim() || composerSaving ? styles.primaryActionDisabled : null]}
                    onPress={onSaveComposer}
                    disabled={!composerTitle.trim() || composerSaving}
                  >
                    <Text style={styles.primaryActionText}>
                      {composerSaving ? "Saving..." : composerMode === "create" ? "Create Project" : "Save Changes"}
                    </Text>
                  </Pressable>
                </View>
              </View>
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
  loadingScreen: {
    flex: 1,
    backgroundColor: "#0a1220",
    alignItems: "center",
    justifyContent: "center"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 34
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#17233b",
    borderWidth: 1,
    borderColor: "#2d3d61",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTextWrap: {
    flex: 1
  },
  welcomeText: {
    color: "#95a8cf",
    fontSize: 17
  },
  screenTitle: {
    color: "#f8fbff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4
  },
  sectionTitle: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 18
  },
  projectList: {
    gap: 20
  },
  projectCard: {
    borderRadius: 24,
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#20304d",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  projectCardPressable: {
    gap: 0
  },
  projectPreview: {
    width: "100%",
    height: 280,
    backgroundColor: "#1a2843"
  },
  projectPreviewPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  projectInfo: {
    paddingHorizontal: 20,
    paddingVertical: 18
  },
  projectTitle: {
    color: "#f8fbff",
    fontSize: 20,
    fontWeight: "800"
  },
  projectMeta: {
    marginTop: 8,
    color: "#9fb2d9",
    fontSize: 13
  },
  projectMenuButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(12, 20, 36, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#223456"
  },
  emptyCard: {
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
  toolbarGhostSpacer: {
    flex: 1
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
  inlineButton: {
    minHeight: 48,
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
  deleteProjectButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6f2432",
    backgroundColor: "#28131a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  deleteProjectButtonText: {
    color: "#ff8ea2",
    fontSize: 14,
    fontWeight: "700"
  }
});

