import { router, useLocalSearchParams } from "expo-router";
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

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragState = {
  photoId: string;
  originPageSectionId: string;
  pageX: number;
  pageY: number;
};

type DropTarget = {
  pageSectionId: string;
  photoId?: string;
};

const AUTO_SCROLL_EDGE_PX = 96;
const AUTO_SCROLL_STEP_PX = 20;
const AUTO_SCROLL_TICK_MS = 42;

function isPointInside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function sameDropTarget(a?: DropTarget, b?: DropTarget): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.pageSectionId === b.pageSectionId && a.photoId === b.photoId;
}

export default function MemoryDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const memoryId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const {
    getProjectById,
    getMemoryById,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    addPhotosToMemory,
    updateMemory,
    deleteMemory,
    deletePhotos,
    createPageSection,
    deletePageSection,
    movePhotoToPage,
    setPageHero
  } = useAppData();

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<DropTarget | undefined>(undefined);

  const pageRefs = useRef<Record<string, View | null>>({});
  const photoRefs = useRef<Record<string, View | null>>({});
  const pageRectsRef = useRef<Record<string, Rect>>({});
  const photoRectsRef = useRef<Record<string, Rect>>({});
  const suppressNextPressPhotoIdRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollRectRef = useRef<Rect | undefined>(undefined);
  const scrollOffsetYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const dragStateRef = useRef<DragState | undefined>(undefined);
  const autoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const memory = getMemoryById(memoryId);
  const photos = useMemo(() => getPhotosByMemoryId(memoryId), [getPhotosByMemoryId, memoryId]);
  const pageSections = useMemo(() => getPageSectionsByMemoryId(memoryId), [getPageSectionsByMemoryId, memoryId]);
  const project = memory ? getProjectById(memory.projectId) : undefined;
  const photosById = useMemo(
    () => Object.fromEntries(photos.map((photo) => [photo.id, photo] as const)),
    [photos]
  );
  const pageSectionIdByPhotoId = useMemo(() => {
    const pairs = pageSections.flatMap((section) => section.photoIds.map((photoId) => [photoId, section.id] as const));
    return Object.fromEntries(pairs);
  }, [pageSections]);
  const draggedPhoto = dragState ? photosById[dragState.photoId] : undefined;
  const selectedCount = selectedPhotoIds.length;
  const latestSelectedPhotoId = selectedCount > 0 ? selectedPhotoIds[selectedCount - 1] : undefined;
  const latestSelectedPhoto = latestSelectedPhotoId ? photosById[latestSelectedPhotoId] : undefined;

  useEffect(() => {
    if (memory) {
      setTitleDraft(memory.title);
      setThemeDraft(memory.themeLabel ?? "");
    }
  }, [memory]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    setSelectedPhotoIds((prev) => {
      const next = prev.filter((photoId) => Boolean(photosById[photoId]));
      return next.length === prev.length ? prev : next;
    });
  }, [photosById]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, []);

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]));
  }

  function onPhotoPress(photoId: string) {
    if (suppressNextPressPhotoIdRef.current === photoId) {
      suppressNextPressPhotoIdRef.current = undefined;
      return;
    }
    togglePhotoSelection(photoId);
  }

  async function onAddPhotos() {
    try {
      setAdding(true);
      const count = await addPhotosToMemory(memoryId);
      if (count > 0) {
        Alert.alert("Photos added", `${count} photo(s) added to this memory.`);
      }
    } catch (error) {
      Alert.alert("Unable to add photos", (error as Error).message);
    } finally {
      setAdding(false);
    }
  }

  function onSaveMemory() {
    if (!memory) {
      return;
    }
    setSaving(true);
    updateMemory(memory.id, { title: titleDraft, themeLabel: themeDraft });
    setSaving(false);
  }

  function onDeleteMemory() {
    if (!memory) {
      return;
    }
    Alert.alert("Delete memory", "Delete this memory and all photos in it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMemory(memory.id);
          if (project) {
            router.replace({ pathname: "/project/[id]", params: { id: project.id } });
          } else {
            router.replace("/");
          }
        }
      }
    ]);
  }

  function onDeleteSelectedPhotos() {
    if (selectedPhotoIds.length === 0) {
      return;
    }
    const count = selectedPhotoIds.length;
    Alert.alert("Delete photos", `Delete ${count} selected photo(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePhotos(selectedPhotoIds);
          setSelectedPhotoIds([]);
        }
      }
    ]);
  }

  function onSetSelectedAsPageHero() {
    if (selectedPhotoIds.length !== 1) {
      return;
    }
    const photoId = selectedPhotoIds[0];
    const pageSectionId = pageSectionIdByPhotoId[photoId];
    if (!pageSectionId) {
      return;
    }
    setPageHero(pageSectionId, photoId);
    setSelectedPhotoIds([]);
  }

  function onAddPage() {
    if (!memory) {
      return;
    }
    createPageSection(memory.id);
  }

  function onDeletePage(pageSectionId: string, photoCount: number) {
    Alert.alert(
      "Delete page",
      photoCount > 0
        ? "Delete this page? Its photos will move to the adjacent page."
        : "Delete this empty page?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePageSection(pageSectionId)
        }
      ]
    );
  }

  function onMoveSelectedToPage(targetPageSectionId: string) {
    if (selectedPhotoIds.length === 0) {
      return;
    }
    for (const photoId of selectedPhotoIds) {
      movePhotoToPage(photoId, targetPageSectionId);
    }
    setSelectedPhotoIds([]);
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

  async function primeDropGeometry() {
    const nextPageRects: Record<string, Rect> = {};
    const nextPhotoRects: Record<string, Rect> = {};

    const pageEntries = Object.entries(pageRefs.current);
    const pageResults = await Promise.all(pageEntries.map(async ([id, node]) => [id, await measureNode(node)] as const));
    for (const [id, rect] of pageResults) {
      if (rect) {
        nextPageRects[id] = rect;
      }
    }

    const photoEntries = Object.entries(photoRefs.current);
    const photoResults = await Promise.all(photoEntries.map(async ([id, node]) => [id, await measureNode(node)] as const));
    for (const [id, rect] of photoResults) {
      if (rect) {
        nextPhotoRects[id] = rect;
      }
    }

    pageRectsRef.current = nextPageRects;
    photoRectsRef.current = nextPhotoRects;
  }

  async function measureScrollRect() {
    const rect = await measureNode(scrollRef.current as unknown as View);
    scrollRectRef.current = rect;
  }

  function resolveDropTarget(pageX: number, pageY: number, draggingPhotoId: string): DropTarget | undefined {
    for (const [photoId, rect] of Object.entries(photoRectsRef.current)) {
      if (photoId === draggingPhotoId) {
        continue;
      }
      if (!isPointInside(rect, pageX, pageY)) {
        continue;
      }
      const pageSectionId = pageSectionIdByPhotoId[photoId];
      if (pageSectionId) {
        return { pageSectionId, photoId };
      }
    }

    for (const [pageSectionId, rect] of Object.entries(pageRectsRef.current)) {
      if (isPointInside(rect, pageX, pageY)) {
        return { pageSectionId };
      }
    }
    return undefined;
  }

  function stopAutoScroll() {
    autoScrollDirectionRef.current = 0;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = undefined;
    }
  }

  function updateDropTargetForPoint(pageX: number, pageY: number, draggingPhotoId: string) {
    const nextTarget = resolveDropTarget(pageX, pageY, draggingPhotoId);
    setDropTarget((prev) => (sameDropTarget(prev, nextTarget) ? prev : nextTarget));
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
      const activeDrag = dragStateRef.current;
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
      void primeDropGeometry().then(() => {
        const dragNow = dragStateRef.current;
        if (!dragNow) {
          return;
        }
        updateDropTargetForPoint(dragNow.pageX, dragNow.pageY, dragNow.photoId);
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

  function onDragStart(photoId: string, pageSectionId: string, pageX: number, pageY: number) {
    suppressNextPressPhotoIdRef.current = photoId;
    const nextDrag = {
      photoId,
      originPageSectionId: pageSectionId,
      pageX,
      pageY
    };
    dragStateRef.current = nextDrag;
    setDropTarget(undefined);
    setDragState(nextDrag);
    void Promise.all([measureScrollRect(), primeDropGeometry()]);
  }

  function onDragMove(pageX: number, pageY: number) {
    const activeDrag = dragStateRef.current;
    if (!activeDrag) {
      return;
    }
    const nextDrag = { ...activeDrag, pageX, pageY };
    dragStateRef.current = nextDrag;
    setDragState(nextDrag);
    updateDropTargetForPoint(pageX, pageY, activeDrag.photoId);
    handleAutoScrollByPointer(pageY);
  }

  function onDragEnd() {
    const activeDrag = dragStateRef.current;
    if (!activeDrag) {
      return;
    }
    stopAutoScroll();
    const fallbackTarget = resolveDropTarget(activeDrag.pageX, activeDrag.pageY, activeDrag.photoId);
    const finalTarget = dropTarget ?? fallbackTarget;
    if (finalTarget?.photoId) {
      const targetPageSectionId = pageSectionIdByPhotoId[finalTarget.photoId];
      const targetPageSection = pageSections.find((section) => section.id === targetPageSectionId);
      const targetIndex = targetPageSection?.photoIds.indexOf(finalTarget.photoId) ?? -1;
      if (targetPageSectionId && targetIndex >= 0) {
        movePhotoToPage(activeDrag.photoId, targetPageSectionId, targetIndex);
      }
    } else if (finalTarget?.pageSectionId) {
      movePhotoToPage(activeDrag.photoId, finalTarget.pageSectionId);
    }
    dragStateRef.current = undefined;
    setDragState(undefined);
    setDropTarget(undefined);
    setTimeout(() => {
      if (suppressNextPressPhotoIdRef.current === activeDrag.photoId) {
        suppressNextPressPhotoIdRef.current = undefined;
      }
    }, 120);
  }

  if (!memory) {
    return (
      <View style={styles.centered}>
        <Text>Memory not found.</Text>
      </View>
    );
  }

  const singleSelected = selectedPhotoIds.length === 1;
  const selectedPhotoPageSectionId = singleSelected ? pageSectionIdByPhotoId[selectedPhotoIds[0]] : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, selectedCount > 0 ? styles.containerWithFloatingActions : null]}
        scrollEnabled={!dragState}
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
          if (!dragStateRef.current) {
            return;
          }
          const touch = event.nativeEvent.touches[0];
          if (!touch) {
            return;
          }
          onDragMove(touch.pageX, touch.pageY);
        }}
        onTouchEnd={() => {
          if (dragStateRef.current) {
            onDragEnd();
          }
        }}
        onTouchCancel={() => {
          if (dragStateRef.current) {
            onDragEnd();
          }
        }}
      >
        <View style={styles.headerCard}>
          <TextInput
            style={styles.titleInput}
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder="Memory title"
          />
          <TextInput
            style={styles.input}
            value={themeDraft}
            onChangeText={setThemeDraft}
            placeholder="Theme label (optional)"
          />
          <Text style={styles.meta}>Project: {project?.name ?? "Unknown"}</Text>
          <Text style={styles.meta}>Updated {new Date(memory.updatedAt).toLocaleString()}</Text>
          <View style={styles.row}>
            <Pressable style={styles.primaryButton} onPress={onSaveMemory} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? "Saving..." : "Save Memory"}</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={onDeleteMemory}>
              <Text style={styles.deleteText}>Delete Memory</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={onAddPhotos} disabled={adding}>
            {adding ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Add Photos</Text>}
          </Pressable>
          <Pressable style={styles.secondaryActionButton} onPress={onAddPage}>
            <Text style={styles.secondaryActionText}>Add Page</Text>
          </Pressable>
        </View>

        <Text style={styles.helpText}>Tap to select. Long press and drag to reorder or move across pages.</Text>

        <Text style={styles.sectionTitle}>Pages ({pageSections.length})</Text>
        {pageSections.map((section, index) => (
          <View
            key={section.id}
            ref={(node) => {
              pageRefs.current[section.id] = node;
            }}
            collapsable={false}
            style={[
              styles.pageCard,
              dropTarget?.pageSectionId === section.id && !dropTarget.photoId ? styles.pageCardDropTarget : null
            ]}
          >
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.pageTitle}>Page {index + 1}</Text>
                <Text style={styles.pageMeta}>
                  {section.photoIds.length} photo(s){section.heroPhotoId ? " | hero set" : ""}
                </Text>
              </View>
              <View style={styles.pageActions}>
                {selectedPhotoIds.length > 0 ? (
                  <Pressable style={styles.tinyButton} onPress={() => onMoveSelectedToPage(section.id)}>
                    <Text>Move Here</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.tinyButtonDanger}
                  onPress={() => onDeletePage(section.id, section.photoIds.length)}
                >
                  <Text style={styles.deleteText}>Delete Page</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.grid}>
              {section.photoIds.length === 0 ? (
                <Text style={styles.empty}>No photos on this page yet.</Text>
              ) : null}
              {section.photoIds.map((photoId) => {
                const photo = photosById[photoId];
                if (!photo) {
                  return null;
                }
                const selected = selectedPhotoIds.includes(photo.id);
                const isHero = section.heroPhotoId === photo.id;
                const isDragging = dragState?.photoId === photo.id;
                return (
                  <View
                    key={photo.id}
                    ref={(node) => {
                      photoRefs.current[photo.id] = node;
                    }}
                    collapsable={false}
                  >
                    <Pressable
                      style={[
                        styles.photoCard,
                        selected && styles.photoCardSelected,
                        dropTarget?.photoId === photo.id && styles.photoCardDropTarget,
                        isDragging && styles.photoCardDragging
                      ]}
                      delayLongPress={180}
                      onLongPress={(event) =>
                        onDragStart(photo.id, section.id, event.nativeEvent.pageX, event.nativeEvent.pageY)
                      }
                      onPress={() => onPhotoPress(photo.id)}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <View style={styles.photoMetaRow}>
                        <Text style={styles.photoMeta}>{new Date(photo.capturedAt).toLocaleDateString()}</Text>
                        {isHero ? <Text style={styles.primaryBadge}>Hero</Text> : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {photos.length === 0 ? (
          <Text style={styles.empty}>No photos in this memory yet. Use Add Photos to begin.</Text>
        ) : null}
      </ScrollView>

      {selectedCount > 0 ? (
        <View style={styles.floatingActionBar}>
          <View style={styles.floatingTopRow}>
            {latestSelectedPhoto ? <Image source={{ uri: latestSelectedPhoto.uri }} style={styles.floatingThumb} /> : null}
            <View style={styles.floatingTitleWrap}>
              <Text style={styles.floatingTitle}>{selectedCount} selected</Text>
              <Text style={styles.floatingSubtitle}>
                {singleSelected ? "Single-photo actions enabled" : "Bulk actions enabled"}
              </Text>
            </View>
          </View>
          <View style={styles.floatingActionsRow}>
            {singleSelected && selectedPhotoPageSectionId ? (
              <Pressable style={styles.floatingButton} onPress={onSetSelectedAsPageHero}>
                <Text style={styles.floatingButtonText}>Set Hero</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.floatingDangerButton} onPress={onDeleteSelectedPhotos}>
              <Text style={styles.floatingDangerText}>Delete</Text>
            </Pressable>
            <Pressable style={styles.floatingButton} onPress={() => setSelectedPhotoIds([])}>
              <Text style={styles.floatingButtonText}>Clear</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingMoveRow}>
            {pageSections.map((section, index) => (
              <Pressable
                key={section.id}
                style={styles.floatingButton}
                onPress={() => onMoveSelectedToPage(section.id)}
              >
                <Text style={styles.floatingButtonText}>Move to Page {index + 1}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {dragState && draggedPhoto ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.dragPreview, { left: dragState.pageX - 58, top: dragState.pageY - 58 }]}>
            <Image source={{ uri: draggedPhoto.uri }} style={styles.dragPreviewImage} />
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
  containerWithFloatingActions: {
    paddingBottom: 180
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  meta: {
    marginTop: 2,
    color: "#475569"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  secondaryActionText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#0f766e",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10
  },
  deleteText: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  helpText: {
    color: "#64748b"
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a"
  },
  pageCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10
  },
  pageCardDropTarget: {
    borderColor: "#0f766e",
    borderWidth: 2,
    backgroundColor: "#f0fdfa"
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  pageMeta: {
    marginTop: 2,
    color: "#475569",
    fontSize: 12
  },
  pageActions: {
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
  tinyButtonDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  empty: {
    color: "#64748b"
  },
  photoCard: {
    width: 156,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 4,
    backgroundColor: "#ffffff"
  },
  photoCardSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#f0fdfa"
  },
  photoCardDropTarget: {
    borderColor: "#1d4ed8",
    borderWidth: 2
  },
  photoCardDragging: {
    opacity: 0.25
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  photoMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  photoMeta: {
    fontSize: 12,
    color: "#475569"
  },
  primaryBadge: {
    fontSize: 11,
    color: "#115e59",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  floatingActionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8
  },
  floatingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  floatingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#e2e8f0"
  },
  floatingTitleWrap: {
    flex: 1
  },
  floatingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  floatingSubtitle: {
    marginTop: 1,
    color: "#64748b",
    fontSize: 12
  },
  floatingActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  floatingMoveRow: {
    gap: 8,
    paddingRight: 8
  },
  floatingButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc"
  },
  floatingButtonText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  floatingDangerButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fef2f2"
  },
  floatingDangerText: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  dragPreview: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#0f766e",
    backgroundColor: "#ffffff",
    opacity: 0.95
  },
  dragPreviewImage: {
    width: "100%",
    height: "100%"
  }
});
