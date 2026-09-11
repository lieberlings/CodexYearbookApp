import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../../../src/context/AppContext";
import { PageBackground } from "../../../src/components/PageBackground";
import { buildLayoutDocument } from "../../../src/layout/engine";
import { applySlotOverridesToPage } from "../../../src/layout/overrides";
import { getPhotoAspect, getPhotoRenderMetrics } from "../../../src/layout/photoMetrics";
import { useEditorStore } from "../../../src/state/editorStore";

function applyColorOpacity(color: string | undefined, opacity: number | undefined): string {
  if (!color) {
    return "transparent";
  }
  const normalizedOpacity = Math.max(0, Math.min(1, opacity ?? 1));
  const hex = color.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

export default function ProjectPreviewScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showAllPages, setShowAllPages] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  const { getProjectById, getMemoriesByProjectId, getPhotosByMemoryId, getPageSectionsByMemoryId } = useAppData();
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);
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
    () => (project ? buildLayoutDocument(project, memories, photosByMemoryId, pageSectionsByMemoryId, "portrait") : null),
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

  if (!project) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Book preview", headerStyle: { backgroundColor: "#241F1B" }, headerTintColor: "#FBF6EE" }} />
        <StatusBar style="light" />
        <Text style={styles.empty}>Project not found.</Text>
      </View>
    );
  }

  const currentPageIndex = Math.min(selectedPageIndex, Math.max(0, renderedPages.length - 1));
  const fullPageWidth = Math.min(width - 32, 520);
  const pageWidth = showAllPages ? (fullPageWidth - 16) / 2 : fullPageWidth;
  const previewScale = showAllPages ? (pageWidth - 20) / (fullPageWidth - 20) : 1;
  const pageHeight = pageWidth;
  const pageInnerWidth = pageWidth - 20;
  const pageContentHeight = pageWidth - 20;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preview" style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={23} color="#FBF6EE" />
        </Pressable>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.projectTitle}>{project.name}</Text>
          <Text style={styles.projectType}>{showAllPages ? "All pages" : "Book preview"} · {renderedPages.length} pages</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={showAllPages ? "Show one page" : "Show all pages"} accessibilityState={{ selected: showAllPages }} style={[styles.iconButton, showAllPages && styles.iconButtonActive]} onPress={() => setShowAllPages((value) => !value)}>
          <Ionicons name={showAllPages ? "book-outline" : "grid-outline"} size={21} color="#FBF6EE" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
      {document?.pages.length === 0 ? <Text style={styles.empty}>No pages to preview yet.</Text> : null}
      <View style={[styles.pages, { width: fullPageWidth }]}>
      {renderedPages.map((entry, index) => {
        if (!showAllPages && index !== currentPageIndex) return null;
        const page = entry.applied;
        const textAnchorSlotIds = new Set(page.textBoxes.map((textBox) => textBox.anchorSlotId).filter(Boolean));
        return (
          <View key={page.id} style={{ width: pageWidth }}>
          <Pressable disabled={!showAllPages} accessibilityRole={showAllPages ? "button" : undefined} accessibilityLabel={`Page ${index + 1}`} onPress={() => { setSelectedPageIndex(index); setShowAllPages(false); }} style={[styles.pageCard, { width: pageWidth, minHeight: pageHeight }]}>
            <View style={[styles.canvasArea, { width: pageInnerWidth, height: pageContentHeight, borderRadius: 0 }]}>
              <PageBackground backgroundAssetId={page.backgroundAssetId} backgroundColor={page.backgroundColor} />
              {page.slots.map((slot) => {
                const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                if (!photo && textAnchorSlotIds.has(slot.id)) {
                  return null;
                }
                const photoMetrics = getPhotoRenderMetrics({
                  containerAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
                  imageAspect: getPhotoAspect(photo),
                  fitMode: slot.fitMode,
                  scale: slot.photoScale ?? 1,
                  offsetX: slot.photoOffsetX ?? 0,
                  offsetY: slot.photoOffsetY ?? 0
                });
                return (
                  <View
                    key={slot.id}
                    style={[
                      styles.slotFrame,
                      {
                        left: `${slot.frame.x * 100}%`,
                        top: `${slot.frame.y * 100}%`,
                        width: `${slot.frame.width * 100}%`,
                        height: `${slot.frame.height * 100}%`,
                        borderColor: page.slotBorderColor ?? "#e2e8f0",
                        borderWidth: page.slotBorderWidth ?? 1,
                        borderRadius: page.slotCornerRadius ?? 0
                      }
                    ]}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: photo.uri }}
                        style={[
                          styles.slotImage,
                          {
                            width: `${photoMetrics.width * 100}%`,
                            height: `${photoMetrics.height * 100}%`,
                            left: `${photoMetrics.leftPercent}%`,
                            top: `${photoMetrics.topPercent}%`
                          }
                        ]}
                        resizeMode="stretch"
                      />
                    ) : null}
                  </View>
                );
              })}
              {page.textBoxes.map((textBox) => {
                const anchorSlot = textBox.anchorSlotId
                  ? page.slots.find((slot) => slot.id === textBox.anchorSlotId)
                  : undefined;
                const textFrame = anchorSlot?.frame ?? textBox;
                return (
                  <View
                    key={textBox.id}
                    style={[
                      styles.textBox,
                      {
                        left: `${textFrame.x * 100}%`,
                        top: `${textFrame.y * 100}%`,
                        width: `${textFrame.width * 100}%`,
                        height: `${textFrame.height * 100}%`,
                        borderWidth: textBox.borderWidth ?? 0,
                        paddingHorizontal: 10 * previewScale,
                        paddingVertical: 6 * previewScale,
                        borderColor: textBox.borderColor ?? "#0f172a",
                        backgroundColor: anchorSlot
                          ? "transparent"
                          : applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.textBoxText,
                        {
                          color: textBox.textColor ?? page.textColor ?? "#0f172a",
                          fontSize: (textBox.fontSize ?? page.textSize ?? 24) * previewScale,
                          lineHeight: 28 * previewScale,
                          fontWeight: (textBox.fontWeight as "400" | "500" | "600" | "700") ?? "700",
                          fontStyle: (textBox.fontStyle as "normal" | "italic") ?? "normal",
                          fontFamily: textBox.fontFamily ?? page.textFontFamily,
                          textAlign: (textBox.textAlign ?? "center") as "left" | "center" | "right"
                        }
                      ]}
                    >
                      {textBox.text}
                    </Text>
                  </View>
                );
              })}
            </View>

          </Pressable>
          <Text style={styles.pageNumber}>{index + 1}</Text>
          </View>
        );
      })}
      </View>
      </ScrollView>
      {!showAllPages && renderedPages.length > 0 ? (
        <View style={styles.pageNavigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={currentPageIndex === 0} style={[styles.iconButton, currentPageIndex === 0 && styles.disabled]} onPress={() => setSelectedPageIndex(currentPageIndex - 1)}>
            <Ionicons name="chevron-back" size={23} color="#FBF6EE" />
          </Pressable>
          <Text style={styles.pageCount}>Page {currentPageIndex + 1} of {renderedPages.length}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next page" disabled={currentPageIndex === renderedPages.length - 1} style={[styles.iconButton, currentPageIndex === renderedPages.length - 1 && styles.disabled]} onPress={() => setSelectedPageIndex(currentPageIndex + 1)}>
            <Ionicons name="chevron-forward" size={23} color="#FBF6EE" />
          </Pressable>
        </View>
      ) : null}
      <Text style={styles.helpText}>{showAllPages ? "Tap a page to take a closer look." : "Make changes to this page in its memory."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#241F1B" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#38312B", alignItems: "center", justifyContent: "center" },
  iconButtonActive: { backgroundColor: "#6B5BD2" },
  disabled: { opacity: 0.3 },
  pages: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  pageNavigation: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, padding: 12 },
  pageCount: { color: "#FBF6EE", fontSize: 14, fontWeight: "600" },
  pageNumber: { color: "#D3C7B8", fontSize: 12, textAlign: "center", marginTop: 10 },
  container: {
    padding: 16,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14
  },
  centered: {
    flex: 1,
    backgroundColor: "#241F1B",
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    flex: 1
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FBF6EE"
  },
  projectType: {
    marginTop: 4,
    color: "#D3C7B8",
    fontSize: 12
  },
  helpText: {
    textAlign: "center",
    padding: 16,
    color: "#D3C7B8",
    fontSize: 12
  },
  pageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 0,
    padding: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  canvasArea: {
    position: "relative"
  },
  slotFrame: {
    position: "absolute",
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc"
  },
  slotImage: {
    position: "absolute"
  },
  textBox: {
    position: "absolute",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 5
  },
  textBoxText: {
    lineHeight: 28
  },
  empty: {
    color: "#D3C7B8",
    width: "100%",
    maxWidth: 520
  },
  emptyPage: {}
});
