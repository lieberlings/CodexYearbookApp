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
import {
  ProjectAssistLevel,
  ProjectStyleIntensity,
  ProjectTimelineMode,
  ProjectType
} from "../src/types";

type ProjectComposerMode = "create" | "edit";

type ProjectCardStats = {
  memoryCount: number;
  pageCount: number;
  photoCount: number;
  previewUri?: string;
};

const TIMELINE_MODE_OPTIONS: { label: string; value: ProjectTimelineMode }[] = [
  { label: "Ongoing", value: "ongoing" },
  { label: "Past", value: "past" },
  { label: "Hybrid", value: "hybrid" }
];

function normalizeDateInput(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidSimpleDate(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatProjectStats(memoryCount: number, pageCount: number, photoCount: number): string {
  return `${pluralize(memoryCount, "memory")} · ${pluralize(pageCount, "page")} · ${pluralize(photoCount, "photo")}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomToolbarHeight = insets.bottom + 76;
  const {
    loading,
    projects,
    createProject,
    updateProject,
    scanProjectSuggestions,
    deleteProject,
    pickProjectThumbnail,
    getMemoriesByProjectId,
    getPhotosByProjectId,
    getPageSectionsByMemoryId,
    getMemoryThumbnailUri
  } = useAppData();

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<ProjectComposerMode>("create");
  const [composerProjectId, setComposerProjectId] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerThumbnailUri, setComposerThumbnailUri] = useState<string | undefined>(undefined);
  const [composerProjectType, setComposerProjectType] = useState<ProjectType>("yearbook");
  const [composerTimelineMode, setComposerTimelineMode] = useState<ProjectTimelineMode>("ongoing");
  const [composerIncludeFutureProjectPhotos, setComposerIncludeFutureProjectPhotos] = useState(true);
  const [composerStartDate, setComposerStartDate] = useState("");
  const [composerEndDate, setComposerEndDate] = useState("");
  const [composerAssistLevel, setComposerAssistLevel] = useState<ProjectAssistLevel>("balanced");
  const [composerStyleIntensity, setComposerStyleIntensity] = useState<ProjectStyleIntensity>("warm");
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerPicking, setComposerPicking] = useState(false);

  const projectStatsById = useMemo(() => {
    const stats = new Map<string, ProjectCardStats>();
    for (const project of projects) {
      const projectMemories = getMemoriesByProjectId(project.id);
      const projectPhotos = getPhotosByProjectId(project.id);
      let photoCount = projectPhotos.length;
      let pageCount = 0;
      let previewUri: string | undefined = project.thumbnailUri ?? projectPhotos[0]?.uri;

      for (const memory of projectMemories) {
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
  }, [getMemoriesByProjectId, getMemoryThumbnailUri, getPageSectionsByMemoryId, getPhotosByProjectId, projects]);

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setComposerMode("create");
    setComposerProjectId(null);
    setComposerTitle("");
    setComposerThumbnailUri(undefined);
    setComposerProjectType("yearbook");
    setComposerTimelineMode("ongoing");
    setComposerIncludeFutureProjectPhotos(true);
    setComposerStartDate("");
    setComposerEndDate("");
    setComposerAssistLevel("balanced");
    setComposerStyleIntensity("warm");
    setComposerSaving(false);
    setComposerPicking(false);
  }, []);

  const openCreateComposer = useCallback(() => {
    setComposerMode("create");
    setComposerProjectId(null);
    setComposerTitle("");
    setComposerThumbnailUri(undefined);
    setComposerProjectType("yearbook");
    setComposerTimelineMode("ongoing");
    setComposerIncludeFutureProjectPhotos(true);
    setComposerStartDate("");
    setComposerEndDate("");
    setComposerAssistLevel("balanced");
    setComposerStyleIntensity("warm");
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
      setComposerProjectType(project.projectType);
      setComposerTimelineMode(project.timelineMode);
      setComposerIncludeFutureProjectPhotos(project.includeFutureProjectPhotos);
      setComposerStartDate(project.startDate ?? "");
      setComposerEndDate(project.endDate ?? "");
      setComposerAssistLevel(project.assistLevel);
      setComposerStyleIntensity(project.styleIntensity);
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

    if (!isValidSimpleDate(composerStartDate) || !isValidSimpleDate(composerEndDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD for project dates, or leave the fields blank.");
      return;
    }

    const normalizedStartDate = composerTimelineMode === "ongoing" ? undefined : normalizeDateInput(composerStartDate);
    const normalizedEndDate = composerTimelineMode === "ongoing" ? undefined : normalizeDateInput(composerEndDate);
    const shouldRunRetroScan = composerTimelineMode === "past" || composerTimelineMode === "hybrid";

    try {
      setComposerSaving(true);
      if (composerMode === "create") {
        const projectId = await createProject(trimmedTitle, composerProjectType, composerThumbnailUri, {
          timelineMode: composerTimelineMode,
          includeFutureProjectPhotos: composerIncludeFutureProjectPhotos,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          assistLevel: composerAssistLevel,
          styleIntensity: composerStyleIntensity
        });
        if (shouldRunRetroScan) {
          void scanProjectSuggestions(projectId, {
            timelineMode: composerTimelineMode,
            includeFutureProjectPhotos: composerIncludeFutureProjectPhotos,
            startDate: normalizedStartDate,
            endDate: normalizedEndDate
          }).catch(() => undefined);
        }
        closeComposer();
        router.push({ pathname: "/project/[id]", params: { id: projectId } });
      } else if (composerProjectId) {
        updateProject(composerProjectId, {
          name: trimmedTitle,
          projectType: composerProjectType,
          thumbnailUri: composerThumbnailUri,
          timelineMode: composerTimelineMode,
          includeFutureProjectPhotos: composerIncludeFutureProjectPhotos,
          startDate: normalizedStartDate ?? null,
          endDate: normalizedEndDate ?? null,
          assistLevel: composerAssistLevel,
          styleIntensity: composerStyleIntensity
        });
        if (shouldRunRetroScan) {
          void scanProjectSuggestions(composerProjectId, {
            timelineMode: composerTimelineMode,
            includeFutureProjectPhotos: composerIncludeFutureProjectPhotos,
            startDate: normalizedStartDate,
            endDate: normalizedEndDate
          }).catch(() => undefined);
        }
        closeComposer();
      }
    } catch (error) {
      Alert.alert("Unable to save project", (error as Error).message);
      setComposerSaving(false);
    }
  }, [
    closeComposer,
    composerAssistLevel,
    composerEndDate,
    composerMode,
    composerIncludeFutureProjectPhotos,
    composerProjectId,
    composerProjectType,
    composerSaving,
    composerStartDate,
    composerStyleIntensity,
    composerThumbnailUri,
    composerTimelineMode,
    composerTitle,
    createProject,
    scanProjectSuggestions,
    updateProject
  ]);

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
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#6B5BD2" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingHorizontal: 16,
          paddingBottom: bottomToolbarHeight + 72
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.screenTitle}>Your books</Text>
          </View>
        </View>

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
                      <Ionicons name="images-outline" size={42} color="#6B6156" />
                    </View>
                  )}
                  <View style={styles.projectInfo}>
                    <Text style={styles.timelineBadge}>{project.timelineMode}</Text>
                    <Text numberOfLines={1} style={styles.projectTitle}>
                      {project.name}
                    </Text>
                    <Text style={styles.projectMeta}>
                      {formatProjectStats(stats.memoryCount, stats.pageCount, stats.photoCount)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable hitSlop={10} onPress={() => openEditComposer(project.id)} style={styles.projectMenuButton}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#4A4239" />
                </Pressable>
              </View>
            );
          })}

          {projects.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={38} color="#6B6156" />
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyText}>Use the add button below to create the first one.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable onPress={openCreateComposer} style={[styles.addButton, { bottom: bottomToolbarHeight + 12 }]}>
        <Ionicons name="add" size={22} color="#ffffff" />
        <Text style={styles.addButtonLabel}>New book</Text>
      </Pressable>

      <View style={[styles.bottomToolbar, { height: bottomToolbarHeight, paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => Alert.alert("Settings", "Settings screen is not wired yet.")}
        >
          <Ionicons name="settings-outline" size={22} color="#4A4239" />
          <Text style={styles.toolbarLabel}>Settings</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarItem}
          onPress={() => Alert.alert("Orders", "Open a project and use Order there for now.")}
        >
          <Ionicons name="bag-handle-outline" size={22} color="#4A4239" />
          <Text style={styles.toolbarLabel}>Orders</Text>
        </Pressable>
        <Pressable style={styles.toolbarItem} onPress={() => router.push("/prompts")}>
          <Ionicons name="notifications-outline" size={22} color="#4A4239" />
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
                  <Text style={styles.modalTitle}>{composerMode === "create" ? "New Project" : "Edit Project"}</Text>
                  <Text style={styles.modalSubtitle}>
                    Set the title, timeline, and cover thumbnail.
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeComposer}>
                  <Ionicons name="close" size={22} color="#4A4239" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.fieldLabel}>Project Title</Text>
                <TextInput
                  value={composerTitle}
                  onChangeText={setComposerTitle}
                  placeholder="Project title"
                  placeholderTextColor="#6B6156"
                  style={styles.modalInput}
                />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Timeline</Text>
                  <View style={styles.choiceGrid}>
                    {TIMELINE_MODE_OPTIONS.map((option) => {
                      const selected = composerTimelineMode === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
                          onPress={() => {
                            setComposerTimelineMode(option.value);
                            if (option.value === "ongoing") {
                              setComposerStartDate("");
                              setComposerEndDate("");
                              setComposerIncludeFutureProjectPhotos(true);
                            } else if (option.value === "past") {
                              setComposerIncludeFutureProjectPhotos(false);
                            }
                          }}
                        >
                          <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldHelperText}>
                    Ongoing keeps collecting. Past and hybrid can store a retroactive date range.
                  </Text>
                </View>

                {composerTimelineMode !== "ongoing" ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Date Range</Text>
                    <View style={styles.dateRow}>
                      <TextInput
                        value={composerStartDate}
                        onChangeText={setComposerStartDate}
                        placeholder="Start YYYY-MM-DD"
                        placeholderTextColor="#6B6156"
                        style={[styles.modalInput, styles.dateInput]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                      />
                      <TextInput
                        value={composerEndDate}
                        onChangeText={setComposerEndDate}
                        placeholder="End YYYY-MM-DD"
                        placeholderTextColor="#6B6156"
                        style={[styles.modalInput, styles.dateInput]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
                      />
                    </View>
                    <Text style={styles.fieldHelperText}>Leave either field blank if you want to fill it in later.</Text>
                  </View>
                ) : null}

                {composerTimelineMode !== "past" ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Future Project Photos</Text>
                    <View style={styles.choiceGrid}>
                      {[
                        { label: "Include", value: true },
                        { label: "Pause", value: false }
                      ].map((option) => {
                        const selected = composerIncludeFutureProjectPhotos === option.value;
                        return (
                          <Pressable
                            key={option.label}
                            style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
                            onPress={() => setComposerIncludeFutureProjectPhotos(option.value)}
                          >
                            <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.fieldHelperText}>
                      Include means future project photos stay eligible for later suggestion scans. Pause keeps the
                      project scoped to its current timeline window.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>Thumbnail</Text>
                <View style={styles.thumbnailPreviewCard}>
                  {composerThumbnailUri ? (
                    <Image source={{ uri: composerThumbnailUri }} style={styles.thumbnailPreviewImage} />
                  ) : (
                    <View style={styles.thumbnailPreviewPlaceholder}>
                      <Ionicons name="image-outline" size={34} color="#6B6156" />
                      <Text style={styles.thumbnailPreviewPlaceholderText}>Pick a project thumbnail</Text>
                    </View>
                  )}
                </View>

                <Pressable style={styles.inlineButton} onPress={onPickComposerThumbnail} disabled={composerPicking}>
                  {composerPicking ? (
                    <ActivityIndicator color="#4A4239" />
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  timelineBadge: {
    alignSelf: "flex-start", backgroundColor: "#F3EBDE", color: "#4A4239",
    borderRadius: 13, paddingHorizontal: 11, paddingVertical: 6,
    fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 7
  },
  addButtonLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  screen: {
    flex: 1,
    backgroundColor: "#FBF6EE"
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#FBF6EE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  headerTextWrap: {
    flex: 1
  },
  screenTitle: {
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 0,
    letterSpacing: -0.55,
  },
  projectList: {
    gap: 14,
  },
  projectCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    overflow: "hidden",
    shadowColor: "#241F1B",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    padding: 10,
  },
  projectCardPressable: {
    gap: 0
  },
  projectPreview: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F3EBDE",
    borderRadius: 14,
  },
  projectPreviewPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  projectInfo: {
    paddingHorizontal: 4,
    paddingVertical: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  projectTitle: {
    color: "#241F1B",
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  projectMeta: {
    marginTop: 7,
    color: "#6B6156",
    fontSize: 13
  },
  projectMenuButton: {
    position: "absolute",
    right: 20,
    top: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(251, 246, 238, 0.93)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8DFD2"
  },
  emptyCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10
  },
  emptyTitle: {
    color: "#241F1B",
    fontWeight: "700",
    fontSize: 18
  },
  emptyText: {
    color: "#6B6156",
    textAlign: "center"
  },
  addButton: {
    position: "absolute",
    alignSelf: "flex-end",
    width: "auto",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#6B5BD2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#241F1B",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    zIndex: 20,
    right: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 9,
  },
  bottomToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: "#FBF6EE",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8DFD2",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbarItem: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  toolbarLabel: {
    color: "#4A4239",
    fontSize: 12,
    fontWeight: "600"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 31, 27, 0.38)",
    justifyContent: "flex-end"
  },
  modalAvoider: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FBF6EE",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: "#E8DFD2",
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
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "800"
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#6B6156",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  modalScroll: {
    maxHeight: 620
  },
  modalContent: {
    paddingBottom: 12,
    gap: 16
  },
  fieldGroup: {
    gap: 10
  },
  fieldLabel: {
    color: "#4A4239",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  fieldHelperText: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 17
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    color: "#241F1B",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  dateRow: {
    flexDirection: "row",
    gap: 10
  },
  dateInput: {
    flex: 1
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
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  choiceChipSelected: {
    backgroundColor: "#EDE8FA",
    borderColor: "#6B5BD2"
  },
  choiceChipText: {
    color: "#4A4239",
    fontSize: 14,
    fontWeight: "700"
  },
  choiceChipTextSelected: {
    color: "#4E3FBC",
  },
  thumbnailPreviewCard: {
    height: 190,
    borderRadius: 22,
    backgroundColor: "#F3EBDE",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2"
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
    color: "#6B6156"
  },
  inlineButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#6B5BD2",
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
    borderRadius: 999,
    backgroundColor: "#6B5BD2",
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
    borderColor: "#E7B6A8",
    backgroundColor: "#FBECE6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  deleteProjectButtonText: {
    color: "#AD432F",
    fontSize: 14,
    fontWeight: "700"
  }
});

