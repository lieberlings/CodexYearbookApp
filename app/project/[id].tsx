import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAppData } from "../../src/context/AppContext";
import { exportProjectToPdf, sharePdf } from "../../src/services/exportService";
import { useEditorStore } from "../../src/state/editorStore";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MemoryDragState = {
  memoryId: string;
  pageX: number;
  pageY: number;
};

const AUTO_SCROLL_EDGE_PX = 96;
const AUTO_SCROLL_STEP_PX = 20;
const AUTO_SCROLL_TICK_MS = 42;

function isPointInside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export default function ProjectDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const {
    getProjectById,
    getMemoriesByProjectId,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    getMemoryThumbnailUri,
    createMemory,
    updateMemory,
    deleteMemory,
    addPhotosToMemory,
    moveMemory,
    reorderMemory,
    updateProject,
    deleteProject,
    pickProjectThumbnail
  } = useAppData();

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryTheme, setMemoryTheme] = useState("");
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryTitle, setEditMemoryTitle] = useState("");
  const [editMemoryTheme, setEditMemoryTheme] = useState("");
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [pickingThumb, setPickingThumb] = useState(false);
  const [memoryDragState, setMemoryDragState] = useState<MemoryDragState | undefined>(undefined);
  const [dropMemoryId, setDropMemoryId] = useState<string | undefined>(undefined);

  const scrollRef = useRef<ScrollView | null>(null);
  const memoryCardRefs = useRef<Record<string, View | null>>({});
  const memoryRectsRef = useRef<Record<string, Rect>>({});
  const scrollRectRef = useRef<Rect | undefined>(undefined);
  const scrollOffsetYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const memoryDragRef = useRef<MemoryDragState | undefined>(undefined);
  const autoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const project = getProjectById(projectId);
  const memories = useMemo(() => getMemoriesByProjectId(projectId), [getMemoriesByProjectId, projectId]);
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);
  const draggedMemory = memoryDragState ? memories.find((memory) => memory.id === memoryDragState.memoryId) : undefined;

  useEffect(() => {
    if (project) {
      setProjectNameDraft(project.name);
    }
  }, [project]);

  useEffect(() => {
    memoryDragRef.current = memoryDragState;
  }, [memoryDragState]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, []);

  async function onCreateMemory() {
    if (!memoryTitle.trim()) {
      return;
    }
    try {
      setCreating(true);
      await createMemory(projectId, memoryTitle, memoryTheme);
      setMemoryTitle("");
      setMemoryTheme("");
    } finally {
      setCreating(false);
    }
  }

  async function onAddPhotos(memoryId: string) {
    try {
      setBusyMemoryId(memoryId);
      const count = await addPhotosToMemory(memoryId);
      if (count > 0) {
        Alert.alert("Photos added", `${count} photo(s) added.`);
      }
    } catch (error) {
      Alert.alert("Unable to add photos", (error as Error).message);
    } finally {
      setBusyMemoryId(null);
    }
  }

  async function onExportProjectPdf() {
    if (!project) {
      return;
    }
    try {
      setExporting(true);
      const photosByMemoryId = Object.fromEntries(
        memories.map((memory) => [memory.id, getPhotosByMemoryId(memory.id)])
      );
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
      Alert.alert("Export failed", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  function startMemoryEdit(memoryId: string) {
    const target = memories.find((memory) => memory.id === memoryId);
    if (!target) {
      return;
    }
    setEditingMemoryId(memoryId);
    setEditMemoryTitle(target.title);
    setEditMemoryTheme(target.themeLabel ?? "");
  }

  function saveMemoryEdit() {
    if (!editingMemoryId) {
      return;
    }
    updateMemory(editingMemoryId, { title: editMemoryTitle, themeLabel: editMemoryTheme });
    setEditingMemoryId(null);
  }

  function onDeleteMemory(memoryId: string) {
    Alert.alert("Delete memory", "Delete this memory and all its photos?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMemory(memoryId)
      }
    ]);
  }

  function onDeleteProject() {
    Alert.alert("Delete project", "Delete this project, all memories, and all photos inside it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProject(projectId);
          router.replace("/");
        }
      }
    ]);
  }

  function onSaveProjectTitle() {
    if (!project || !projectNameDraft.trim()) {
      return;
    }
    setSavingProject(true);
    updateProject(project.id, { name: projectNameDraft });
    setSavingProject(false);
  }

  async function onPickProjectThumbnail() {
    if (!project) {
      return;
    }
    try {
      setPickingThumb(true);
      const uri = await pickProjectThumbnail();
      if (uri) {
        updateProject(project.id, { thumbnailUri: uri });
      }
    } catch (error) {
      Alert.alert("Thumbnail failed", (error as Error).message);
    } finally {
      setPickingThumb(false);
    }
  }

  async function measureNode(node: View | null): Promise<Rect | undefined> {
    if (!node) {
      return undefined;
    }
    return new Promise((resolve) => {
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          resolve(undefined);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }

  async function measureScrollRect() {
    const rect = await measureNode(scrollRef.current as unknown as View);
    scrollRectRef.current = rect;
  }

  async function primeMemoryRects() {
    const nextRects: Record<string, Rect> = {};
    const entries = Object.entries(memoryCardRefs.current);
    const results = await Promise.all(entries.map(async ([id, node]) => [id, await measureNode(node)] as const));
    for (const [id, rect] of results) {
      if (rect) {
        nextRects[id] = rect;
      }
    }
    memoryRectsRef.current = nextRects;
  }

  function stopAutoScroll() {
    autoScrollDirectionRef.current = 0;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = undefined;
    }
  }

  function resolveDropMemoryId(pageX: number, pageY: number, draggingMemoryId: string): string | undefined {
    for (const [memoryId, rect] of Object.entries(memoryRectsRef.current)) {
      if (memoryId === draggingMemoryId) {
        continue;
      }
      if (isPointInside(rect, pageX, pageY)) {
        return memoryId;
      }
    }
    return undefined;
  }

  function updateDropMemory(pageX: number, pageY: number, draggingMemoryId: string) {
    const nextDrop = resolveDropMemoryId(pageX, pageY, draggingMemoryId);
    setDropMemoryId((prev) => (prev === nextDrop ? prev : nextDrop));
  }

  function startAutoScroll(direction: -1 | 0 | 1) {
    if (direction === autoScrollDirectionRef.current) {
      return;
    }
    stopAutoScroll();
    autoScrollDirectionRef.current = direction;
    if (direction === 0) {
      return;
    }
    autoScrollTimerRef.current = setInterval(() => {
      const activeDrag = memoryDragRef.current;
      if (!activeDrag) {
        stopAutoScroll();
        return;
      }
      const maxOffset = Math.max(0, scrollContentHeightRef.current - scrollViewportHeightRef.current);
      if (maxOffset <= 0) {
        return;
      }
      const nextOffset = Math.max(
        0,
        Math.min(maxOffset, scrollOffsetYRef.current + direction * AUTO_SCROLL_STEP_PX)
      );
      if (nextOffset === scrollOffsetYRef.current) {
        return;
      }
      scrollOffsetYRef.current = nextOffset;
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
      void primeMemoryRects().then(() => {
        const dragNow = memoryDragRef.current;
        if (!dragNow) {
          return;
        }
        updateDropMemory(dragNow.pageX, dragNow.pageY, dragNow.memoryId);
      });
    }, AUTO_SCROLL_TICK_MS);
  }

  function handleAutoScrollByPointer(pageY: number) {
    const scrollRect = scrollRectRef.current;
    if (!scrollRect) {
      startAutoScroll(0);
      return;
    }
    const topEdge = scrollRect.y + AUTO_SCROLL_EDGE_PX;
    const bottomEdge = scrollRect.y + scrollRect.height - AUTO_SCROLL_EDGE_PX;
    if (pageY <= topEdge) {
      startAutoScroll(-1);
    } else if (pageY >= bottomEdge) {
      startAutoScroll(1);
    } else {
      startAutoScroll(0);
    }
  }

  function onMemoryDragStart(memoryId: string, pageX: number, pageY: number) {
    const nextDrag = { memoryId, pageX, pageY };
    memoryDragRef.current = nextDrag;
    setMemoryDragState(nextDrag);
    setDropMemoryId(undefined);
    void Promise.all([measureScrollRect(), primeMemoryRects()]);
  }

  function onMemoryDragMove(pageX: number, pageY: number) {
    const activeDrag = memoryDragRef.current;
    if (!activeDrag) {
      return;
    }
    const nextDrag = { ...activeDrag, pageX, pageY };
    memoryDragRef.current = nextDrag;
    setMemoryDragState(nextDrag);
    updateDropMemory(pageX, pageY, activeDrag.memoryId);
    handleAutoScrollByPointer(pageY);
  }

  function onMemoryDragEnd() {
    const activeDrag = memoryDragRef.current;
    if (!activeDrag) {
      return;
    }
    stopAutoScroll();
    const fallbackDropMemoryId = resolveDropMemoryId(activeDrag.pageX, activeDrag.pageY, activeDrag.memoryId);
    const finalDropMemoryId = dropMemoryId ?? fallbackDropMemoryId;
    if (finalDropMemoryId) {
      const toIndex = memories.findIndex((memory) => memory.id === finalDropMemoryId);
      if (toIndex >= 0) {
        reorderMemory(projectId, activeDrag.memoryId, toIndex);
      }
    }
    memoryDragRef.current = undefined;
    setMemoryDragState(undefined);
    setDropMemoryId(undefined);
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text>Project not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        scrollEnabled={!memoryDragState}
        onLayout={(event) => {
          scrollViewportHeightRef.current = event.nativeEvent.layout.height;
          void measureScrollRect();
        }}
        onContentSizeChange={(_width, height) => {
          scrollContentHeightRef.current = height;
        }}
        onScroll={(event) => {
          scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onTouchMove={(event) => {
          if (!memoryDragRef.current) {
            return;
          }
          const touch = event.nativeEvent.touches[0];
          if (!touch) {
            return;
          }
          onMemoryDragMove(touch.pageX, touch.pageY);
        }}
        onTouchEnd={() => {
          if (memoryDragRef.current) {
            onMemoryDragEnd();
          }
        }}
        onTouchCancel={() => {
          if (memoryDragRef.current) {
            onMemoryDragEnd();
          }
        }}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            {project.thumbnailUri ? <Image source={{ uri: project.thumbnailUri }} style={styles.thumb} /> : null}
            <View style={styles.headerText}>
              <Text style={styles.meta}>{project.projectType}</Text>
              <TextInput
                style={styles.projectTitleInput}
                value={projectNameDraft}
                onChangeText={setProjectNameDraft}
                placeholder="Project name"
              />
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.tinyButtonWide} onPress={onSaveProjectTitle} disabled={savingProject}>
              <Text>{savingProject ? "Saving..." : "Save Title"}</Text>
            </Pressable>
            <Pressable style={styles.tinyButtonWide} onPress={onPickProjectThumbnail} disabled={pickingThumb}>
              <Text>{pickingThumb ? "Picking..." : "Change Thumbnail"}</Text>
            </Pressable>
          </View>
          <View style={styles.headerActions}>
            <Link href={{ pathname: "/project/[id]/preview", params: { id: project.id } }} asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Preview Project</Text>
              </Pressable>
            </Link>
            <Pressable style={styles.secondaryButton} onPress={onExportProjectPdf} disabled={exporting}>
              {exporting ? <ActivityIndicator /> : <Text style={styles.secondaryButtonText}>Export Project PDF</Text>}
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={onDeleteProject}>
              <Text style={styles.deleteButtonText}>Delete Project</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create Memory (page/group)</Text>
          <TextInput
            style={styles.input}
            placeholder="Memory title"
            value={memoryTitle}
            onChangeText={setMemoryTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Theme label (optional)"
            value={memoryTheme}
            onChangeText={setMemoryTheme}
          />
          <Pressable style={styles.primaryButton} onPress={onCreateMemory} disabled={creating}>
            <Text style={styles.primaryButtonText}>{creating ? "Creating..." : "Create Memory"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Memories (ordered)</Text>
          <Text style={styles.helper}>Long press and drag a memory card to reorder.</Text>
          {memories.length === 0 ? <Text style={styles.empty}>No memories yet.</Text> : null}
          {memories.map((memory, index) => {
            const photoCount = getPhotosByMemoryId(memory.id).length;
            const pageCount = getPageSectionsByMemoryId(memory.id).length;
            const busy = busyMemoryId === memory.id;
            const thumbnailUri = getMemoryThumbnailUri(memory.id);
            const isEditing = editingMemoryId === memory.id;
            const isDragging = memoryDragState?.memoryId === memory.id;
            const isDropTarget = dropMemoryId === memory.id;
            return (
              <View
                key={memory.id}
                ref={(node) => {
                  memoryCardRefs.current[memory.id] = node;
                }}
                collapsable={false}
                style={[
                  styles.memoryCardWrap,
                  isDropTarget ? styles.memoryDropTarget : null,
                  isDragging ? styles.memoryDragging : null
                ]}
              >
                <Pressable
                  delayLongPress={180}
                  onLongPress={(event) => {
                    if (!isEditing) {
                      onMemoryDragStart(memory.id, event.nativeEvent.pageX, event.nativeEvent.pageY);
                    }
                  }}
                  style={styles.memoryCard}
                >
                  <View style={styles.memoryHead}>
                    {thumbnailUri ? <Image source={{ uri: thumbnailUri }} style={styles.memoryThumb} /> : null}
                    <View style={styles.memoryTextWrap}>
                      {isEditing ? (
                        <>
                          <TextInput
                            style={styles.inputCompact}
                            value={editMemoryTitle}
                            onChangeText={setEditMemoryTitle}
                            placeholder="Memory title"
                          />
                          <TextInput
                            style={styles.inputCompact}
                            value={editMemoryTheme}
                            onChangeText={setEditMemoryTheme}
                            placeholder="Theme label (optional)"
                          />
                        </>
                      ) : (
                        <>
                          <Text style={styles.memoryTitle}>
                            {index + 1}. {memory.title}
                          </Text>
                          {memory.themeLabel ? <Text style={styles.memoryTheme}>{memory.themeLabel}</Text> : null}
                          <Text style={styles.memoryMeta}>{photoCount} photos | {pageCount} pages</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.memoryActionsWrap}>
                    <View style={styles.memoryActions}>
                      <Pressable style={styles.tinyButton} onPress={() => moveMemory(projectId, memory.id, "up")}>
                        <Text>Up</Text>
                      </Pressable>
                      <Pressable style={styles.tinyButton} onPress={() => moveMemory(projectId, memory.id, "down")}>
                        <Text>Down</Text>
                      </Pressable>
                      <Pressable style={styles.tinyButton} onPress={() => onAddPhotos(memory.id)} disabled={busy}>
                        {busy ? <ActivityIndicator /> : <Text>Add Photos</Text>}
                      </Pressable>
                      <Link href={{ pathname: "/memory/[id]", params: { id: memory.id } }} asChild>
                        <Pressable style={styles.tinyButton}>
                          <Text>View</Text>
                        </Pressable>
                      </Link>
                    </View>
                    <View style={styles.memoryActions}>
                      {isEditing ? (
                        <>
                          <Pressable style={styles.tinyButton} onPress={saveMemoryEdit}>
                            <Text>Save</Text>
                          </Pressable>
                          <Pressable style={styles.tinyButton} onPress={() => setEditingMemoryId(null)}>
                            <Text>Cancel</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable style={styles.tinyButton} onPress={() => startMemoryEdit(memory.id)}>
                          <Text>Edit</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.tinyButtonDanger} onPress={() => onDeleteMemory(memory.id)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {memoryDragState && draggedMemory ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.dragPreview, { left: memoryDragState.pageX - 110, top: memoryDragState.pageY - 34 }]}>
            {getMemoryThumbnailUri(draggedMemory.id) ? (
              <Image source={{ uri: getMemoryThumbnailUri(draggedMemory.id) }} style={styles.dragPreviewThumb} />
            ) : null}
            <Text numberOfLines={1} style={styles.dragPreviewText}>
              {draggedMemory.title}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  container: {
    padding: 16,
    gap: 12
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 10
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  headerText: {
    flex: 1
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#e2e8f0"
  },
  meta: {
    color: "#475569",
    marginBottom: 4
  },
  projectTitleInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#0f172a"
  },
  helper: {
    marginBottom: 8,
    color: "#64748b"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  inputCompact: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6
  },
  primaryButton: {
    marginTop: 2,
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteButtonText: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  deleteText: {
    color: "#b91c1c"
  },
  empty: {
    color: "#64748b"
  },
  memoryCardWrap: {
    borderRadius: 10
  },
  memoryDropTarget: {
    borderWidth: 2,
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff"
  },
  memoryDragging: {
    opacity: 0.28
  },
  memoryCard: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingVertical: 10,
    gap: 8
  },
  memoryHead: {
    flexDirection: "row",
    gap: 10
  },
  memoryThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  memoryTextWrap: {
    flex: 1
  },
  memoryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a"
  },
  memoryTheme: {
    marginTop: 2,
    color: "#334155"
  },
  memoryMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12
  },
  memoryActionsWrap: {
    gap: 8
  },
  memoryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tinyButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc"
  },
  tinyButtonWide: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    minWidth: 120,
    alignItems: "center"
  },
  tinyButtonDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  dragPreview: {
    position: "absolute",
    width: 220,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f766e",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    opacity: 0.96
  },
  dragPreviewThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#e2e8f0"
  },
  dragPreviewText: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "600"
  }
});
