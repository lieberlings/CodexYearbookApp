import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAppData } from "../../../src/context/AppContext";
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
        <Text>Project not found.</Text>
      </View>
    );
  }

  const pageWidth = Math.min(width - 24, 520);
  const pageHeight = pageWidth;
  const pageInnerWidth = pageWidth - 20;
  const pageContentHeight = pageWidth - 20;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.projectTitle}>{project.name}</Text>
        <Text style={styles.projectType}>{project.projectType}</Text>
      </View>

      <Text style={styles.helpText}>Preview only. Edit page layout, template, fit, scale, and swaps inside each memory.</Text>

      {document?.pages.length === 0 ? <Text style={styles.empty}>No pages to preview yet.</Text> : null}

      {renderedPages.map((entry) => {
        const page = entry.applied;
        return (
          <View key={page.id} style={[styles.pageCard, { width: pageWidth, minHeight: pageHeight }]}>
            <View style={[styles.canvasArea, { width: pageInnerWidth, height: pageContentHeight, backgroundColor: page.backgroundColor ?? "#ffffff", borderRadius: 18 }]}>
              {page.slots.map((slot) => {
                const photo = slot.photoId ? photosById[slot.photoId] : undefined;
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
                        borderRadius: page.slotCornerRadius ?? 8
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
              {page.textBoxes.map((textBox) => (
                <View
                  key={textBox.id}
                  style={[
                    styles.textBox,
                    {
                      left: `${textBox.x * 100}%`,
                      top: `${textBox.y * 100}%`,
                      width: `${textBox.width * 100}%`,
                      height: `${textBox.height * 100}%`,
                      borderWidth: textBox.borderWidth ?? 0,
                      borderColor: textBox.borderColor ?? "#0f172a",
                      backgroundColor: applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.textBoxText,
                      {
                        color: textBox.textColor ?? page.textColor ?? "#0f172a",
                        fontSize: textBox.fontSize ?? page.textSize ?? 24,
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
              ))}
            </View>

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
  pageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10
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
    color: "#64748b",
    width: "100%",
    maxWidth: 520
  },
  emptyPage: {}
});
