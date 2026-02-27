import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAppData } from "../../../src/context/AppContext";
import { buildLayoutDocument } from "../../../src/layout/engine";
import { applySlotOverridesToPage } from "../../../src/layout/overrides";
import { useEditorStore } from "../../../src/state/editorStore";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ProjectPreviewScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const { width } = useWindowDimensions();

  const { getProjectById, getMemoriesByProjectId, getPhotosByMemoryId, getPageSectionsByMemoryId, setPageHero } = useAppData();
  const setDocument = useEditorStore((state) => state.setDocument);
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);
  const selectedPageId = useEditorStore((state) => state.selectedPageId);
  const selectedSlotId = useEditorStore((state) => state.selectedSlotId);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setSlotOverride = useEditorStore((state) => state.setSlotOverride);
  const clearSlotOverride = useEditorStore((state) => state.clearSlotOverride);
  const project = getProjectById(projectId);
  const memories = useMemo(() => getMemoriesByProjectId(projectId), [getMemoriesByProjectId, projectId]);
  const photosByMemoryId = useMemo(
    () => Object.fromEntries(memories.map((memory) => [memory.id, getPhotosByMemoryId(memory.id)])),
    [getPhotosByMemoryId, memories]
  );
  const pageSectionsByMemoryId = useMemo(
    () => Object.fromEntries(memories.map((memory) => [memory.id, getPageSectionsByMemoryId(memory.id)])),
    [getPageSectionsByMemoryId, memories]
  );
  const document = useMemo(
    () => (project ? buildLayoutDocument(project, memories, photosByMemoryId, pageSectionsByMemoryId, "landscape") : null),
    [memories, pageSectionsByMemoryId, photosByMemoryId, project]
  );
  const photosById = useMemo(() => {
    const pairs = Object.values(photosByMemoryId).flat().map((photo) => [photo.id, photo] as const);
    return Object.fromEntries(pairs);
  }, [photosByMemoryId]);
  const renderedPages = useMemo(
    () =>
      (document?.pages ?? []).map((basePage) => ({
        base: basePage,
        applied: applySlotOverridesToPage(basePage, slotOverridesByPage[basePage.id])
      })),
    [document?.pages, slotOverridesByPage]
  );
  const selectedPage = useMemo(
    () => renderedPages.find((entry) => entry.applied.id === selectedPageId)?.applied,
    [renderedPages, selectedPageId]
  );
  const selectedSlot = useMemo(
    () => selectedPage?.slots.find((slot) => slot.id === selectedSlotId),
    [selectedPage, selectedSlotId]
  );

  useEffect(() => {
    if (document) {
      setDocument(document);
    }
  }, [document, setDocument]);

  useEffect(() => {
    if (!selectedPageId || !selectedSlotId) {
      return;
    }
    const page = renderedPages.find((entry) => entry.applied.id === selectedPageId)?.applied;
    const exists = page?.slots.some((slot) => slot.id === selectedSlotId);
    if (!exists) {
      setSelection(undefined, undefined);
    }
  }, [renderedPages, selectedPageId, selectedSlotId, setSelection]);

  function setSelectedFitMode(mode: "contain" | "cover") {
    if (!selectedPageId || !selectedSlotId) {
      return;
    }
    setSlotOverride(selectedPageId, selectedSlotId, { fitMode: mode });
  }

  function nudgeSelectedOffset(deltaX: number, deltaY: number) {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    const nextX = clamp((selectedSlot.photoOffsetX ?? 0) + deltaX, -1, 1);
    const nextY = clamp((selectedSlot.photoOffsetY ?? 0) + deltaY, -1, 1);
    setSlotOverride(selectedPageId, selectedSlot.id, { photoOffsetX: nextX, photoOffsetY: nextY });
  }

  function nudgeSelectedScale(delta: number) {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    const nextScale = clamp((selectedSlot.photoScale ?? 1) + delta, 0.5, 3);
    setSlotOverride(selectedPageId, selectedSlot.id, { photoScale: nextScale });
  }

  function centerSelectedPhoto() {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    setSlotOverride(selectedPageId, selectedSlot.id, { photoOffsetX: 0, photoOffsetY: 0, photoScale: 1 });
  }

  function clearSelectedOverride() {
    if (!selectedPageId || !selectedSlotId) {
      return;
    }
    clearSlotOverride(selectedPageId, selectedSlotId);
  }

  function setSelectedAsHero() {
    if (!selectedPage || !selectedSlot?.photoId) {
      return;
    }
    setPageHero(selectedPage.id, selectedSlot.photoId);
  }

  function swapSelectedWithNext() {
    if (!selectedPage || !selectedSlotId) {
      return;
    }
    const slotted = selectedPage.slots.filter((slot) => Boolean(slot.photoId));
    if (slotted.length < 2) {
      return;
    }
    const index = slotted.findIndex((slot) => slot.id === selectedSlotId);
    if (index < 0) {
      return;
    }
    const next = slotted[(index + 1) % slotted.length];
    const current = slotted[index];
    if (!current.photoId || !next.photoId) {
      return;
    }
    setSlotOverride(selectedPage.id, current.id, { photoId: next.photoId });
    setSlotOverride(selectedPage.id, next.id, { photoId: current.photoId });
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text>Project not found.</Text>
      </View>
    );
  }

  const pageWidth = Math.min(width - 24, 520);
  const pageHeight = Math.round(pageWidth * (8 / 11));
  const pageInnerWidth = pageWidth - 20;
  const pageContentHeight = pageHeight - 98;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.projectTitle}>{project.name}</Text>
        <Text style={styles.projectType}>{project.projectType}</Text>
      </View>

      {selectedSlot ? (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarLabel}>
            Selected: {selectedSlot.role} ({selectedSlot.fitMode}) | zoom {selectedSlot.photoScale.toFixed(2)} | x{" "}
            {selectedSlot.photoOffsetX.toFixed(2)} | y {selectedSlot.photoOffsetY.toFixed(2)}
          </Text>
          <View style={styles.toolbarButtons}>
            <Pressable style={styles.toolbarButton} onPress={() => setSelectedFitMode("contain")}>
              <Text>Fit</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => setSelectedFitMode("cover")}>
              <Text>Fill</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedScale(-0.1)}>
              <Text>Zoom -</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedScale(0.1)}>
              <Text>Zoom +</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedOffset(0, -0.05)}>
              <Text>Up</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedOffset(-0.05, 0)}>
              <Text>Left</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedOffset(0.05, 0)}>
              <Text>Right</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={() => nudgeSelectedOffset(0, 0.05)}>
              <Text>Down</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={swapSelectedWithNext}>
              <Text>Swap</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={setSelectedAsHero}>
              <Text>Set Hero</Text>
            </Pressable>
            <Pressable style={styles.toolbarButton} onPress={centerSelectedPhoto}>
              <Text>Center</Text>
            </Pressable>
            <Pressable style={styles.toolbarButtonDanger} onPress={clearSelectedOverride}>
              <Text style={styles.toolbarDangerText}>Reset</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.helpText}>Tap a photo slot to edit fit mode or swap.</Text>
      )}

      {document?.pages.length === 0 ? <Text style={styles.empty}>No pages to preview yet.</Text> : null}

      {renderedPages.map((entry) => {
        const page = entry.applied;
        const title = page.pageCount > 1 ? `${page.memoryTitle} (${page.pageIndex + 1}/${page.pageCount})` : page.memoryTitle;
        return (
          <View key={page.id} style={[styles.pageCard, { width: pageWidth, minHeight: pageHeight }]}>
            <Text style={styles.pageTitle}>{title}</Text>
            {page.themeLabel ? <Text style={styles.pageTheme}>{page.themeLabel}</Text> : null}

            <View style={[styles.canvasArea, { width: pageInnerWidth, height: pageContentHeight }]}>
              {page.slots.map((slot) => {
                const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                const isSelected = selectedPageId === page.id && selectedSlotId === slot.id;
                const sizePercent = slot.photoScale * 100;
                const leftPercent = 50 - slot.photoScale * 50 + slot.photoOffsetX * 100;
                const topPercent = 50 - slot.photoScale * 50 + slot.photoOffsetY * 100;
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => setSelection(page.id, slot.id)}
                    style={[
                      styles.slotFrame,
                      isSelected && styles.slotSelected,
                      {
                        left: `${slot.frame.x * 100}%`,
                        top: `${slot.frame.y * 100}%`,
                        width: `${slot.frame.width * 100}%`,
                        height: `${slot.frame.height * 100}%`
                      }
                    ]}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: photo.uri }}
                        style={[
                          styles.slotImage,
                          {
                            width: `${sizePercent}%`,
                            height: `${sizePercent}%`,
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`
                          }
                        ]}
                        resizeMode={slot.fitMode}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {page.slots.length === 0 ? <Text style={styles.emptyPage}>No photos on this page.</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    alignItems: "center",
    gap: 14
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    width: "100%",
    maxWidth: 520
  },
  projectTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a"
  },
  projectType: {
    marginTop: 4,
    color: "#64748b"
  },
  helpText: {
    width: "100%",
    maxWidth: 520,
    color: "#64748b"
  },
  toolbar: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 8
  },
  toolbarLabel: {
    color: "#334155",
    fontSize: 12
  },
  toolbarButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  toolbarButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc"
  },
  toolbarButtonDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  toolbarDangerText: {
    color: "#b91c1c"
  },
  pageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 26
  },
  pageTheme: {
    marginTop: 4,
    marginBottom: 8,
    color: "#475569",
    fontSize: 14
  },
  canvasArea: {
    position: "relative"
  },
  slotFrame: {
    position: "absolute",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc"
  },
  slotSelected: {
    borderColor: "#0f766e",
    borderWidth: 2
  },
  slotImage: {
    position: "absolute"
  },
  empty: {
    color: "#64748b",
    width: "100%",
    maxWidth: 520
  },
  emptyPage: {
    marginTop: 10,
    color: "#64748b"
  }
});
