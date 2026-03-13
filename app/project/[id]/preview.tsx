import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAppData } from "../../../src/context/AppContext";
import { buildLayoutDocument } from "../../../src/layout/engine";
import { applySlotOverridesToPage } from "../../../src/layout/overrides";
import { useEditorStore } from "../../../src/state/editorStore";

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
        const title = page.pageCount > 1 ? `${page.memoryTitle} (${page.pageIndex + 1}/${page.pageCount})` : page.memoryTitle;
        return (
          <View key={page.id} style={[styles.pageCard, { width: pageWidth, minHeight: pageHeight }]}>
            <Text
              style={[
                styles.pageTitle,
                {
                  color: page.textColor ?? "#0f172a",
                  fontSize: page.textSize ?? 22,
                  fontWeight: (page.textWeight as "400" | "500" | "600" | "700") ?? "700",
                  fontFamily: page.textFontFamily
                }
              ]}
            >
              {title}
            </Text>
            {page.themeLabel ? <Text style={[styles.pageTheme, { color: page.textColor ?? "#475569" }]}>{page.themeLabel}</Text> : null}

            <View style={[styles.canvasArea, { width: pageInnerWidth, height: pageContentHeight, backgroundColor: page.backgroundColor ?? "#ffffff", borderRadius: 18 }]}>
              {page.slots.map((slot) => {
                const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                const sizePercent = slot.photoScale * 100;
                const leftPercent = 50 - slot.photoScale * 50 + slot.photoOffsetX * 100;
                const topPercent = 50 - slot.photoScale * 50 + slot.photoOffsetY * 100;
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
                            width: `${sizePercent}%`,
                            height: `${sizePercent}%`,
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`
                          }
                        ]}
                        resizeMode={slot.fitMode}
                      />
                    ) : null}
                  </View>
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
