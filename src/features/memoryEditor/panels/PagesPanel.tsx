import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import DraggableFlatList, { type DragEndParams } from "react-native-draggable-flatlist";
import { PageBackground } from "../../../components/PageBackground";
import { LayoutPage } from "../../../layout/schemas";
import { MemoryPageSection } from "../../../types";
import { DRAG_HOLD_MS } from "../helpers";
import { styles } from "../styles";

export type PageExportChange = { exportToFolder?: boolean; exportFolderName?: string };

/** The page rail (tap to select, hold to reorder, add a page) and the page's ZIP export settings. */
export function PagesPanel({
  header,
  pages,
  activePageId,
  renderedPageById,
  photosById,
  getPageStyle,
  dragging,
  onDraggingChange,
  onDragEnd,
  onSelectPage,
  onAddPage,
  pageNumber,
  exportToFolder,
  exportFolderName,
  onExportChange
}: {
  header?: ReactNode;
  pages: MemoryPageSection[];
  activePageId?: string;
  renderedPageById: Record<string, LayoutPage | undefined>;
  photosById: Record<string, { uri: string } | undefined>;
  getPageStyle: (pageId: string) => { backgroundColor: string; backgroundAssetId?: string };
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onDragEnd: (params: DragEndParams<MemoryPageSection>) => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  pageNumber: number;
  exportToFolder?: boolean;
  exportFolderName?: string;
  onExportChange: (change: PageExportChange) => void;
}) {
  return (
    <ScrollView style={styles.pageRail} contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
      {header}
      {/* Page reorder is owned by DraggableFlatList. Other editor drags still use the custom drag controller. */}
      <DraggableFlatList
        data={pages}
        horizontal
        activationDistance={8}
        autoscrollSpeed={220}
        dragItemOverflow={false}
        animationConfig={{
          damping: 26,
          mass: 0.22,
          stiffness: 240,
          overshootClamping: true
        }}
        containerStyle={[styles.pageRailList, { flex: 0, height: 138 }]}
        contentContainerStyle={styles.pageRailRow}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.pageRailSeparator} />}
        ListFooterComponentStyle={styles.pageRailFooter}
        onDragBegin={() => onDraggingChange(true)}
        onRelease={() => onDraggingChange(false)}
        onDragEnd={onDragEnd}
        renderPlaceholder={({ item }) => (
          <View style={styles.pageRailItem}>
            <View style={styles.pageRailCard}>
              <View
                style={[
                  styles.pageRailPreview,
                  styles.pageRailPlaceholderPreview,
                  { backgroundColor: getPageStyle(item.id).backgroundColor }
                ]}
              >
                <PageBackground
                  backgroundAssetId={getPageStyle(item.id).backgroundAssetId}
                  backgroundColor={getPageStyle(item.id).backgroundColor}
                />
              </View>
              <Text style={[styles.pageRailLabel, styles.pageRailLabelPlaceholder]}>Page</Text>
            </View>
          </View>
        )}
        renderItem={({ item, drag: beginPageReorder, isActive, getIndex }) => {
          const renderedPage = renderedPageById[item.id];
          const isSelected = item.id === activePageId;
          const index = getIndex() ?? pages.findIndex((pageSection) => pageSection.id === item.id);
          return (
            <View style={styles.pageRailItem}>
              <Pressable
                collapsable={false}
                delayLongPress={DRAG_HOLD_MS}
                onPress={() => onSelectPage(item.id)}
                onLongPress={beginPageReorder}
                style={[
                  styles.pageRailCard,
                  isSelected && !dragging ? styles.pageRailCardActive : null,
                  isActive ? styles.pageRailCardDragging : null
                ]}
              >
                <View
                  style={[
                    styles.pageRailPreview,
                    isSelected ? styles.pageRailPreviewSelected : null,
                    { backgroundColor: getPageStyle(item.id).backgroundColor }
                  ]}
                >
                  <PageBackground
                    backgroundAssetId={getPageStyle(item.id).backgroundAssetId}
                    backgroundColor={getPageStyle(item.id).backgroundColor}
                  />
                  {renderedPage?.slots.slice(0, 4).map((slot) => {
                    const previewPhoto = slot.photoId ? photosById[slot.photoId] : undefined;
                    return previewPhoto ? (
                      <Image
                        key={slot.id}
                        source={{ uri: previewPhoto.uri }}
                        style={[
                          styles.pageRailPreviewPhoto,
                          {
                            left: `${slot.frame.x * 100}%`,
                            top: `${slot.frame.y * 100}%`,
                            width: `${slot.frame.width * 100}%`,
                            height: `${slot.frame.height * 100}%`
                          }
                        ]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        key={slot.id}
                        style={[
                          styles.pageRailPreviewBlock,
                          {
                            left: `${slot.frame.x * 100}%`,
                            top: `${slot.frame.y * 100}%`,
                            width: `${slot.frame.width * 100}%`,
                            height: `${slot.frame.height * 100}%`
                          }
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={[styles.pageRailLabel, isSelected ? styles.pageRailLabelActive : null]}>
                  Page {(index >= 0 ? index : 0) + 1}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.pageRailItem}>
            <Pressable style={[styles.pageRailCard, styles.pageRailAddCard]} onPress={onAddPage}>
              <View style={[styles.pageRailPreview, styles.pageRailAddPreview]}>
                <Text style={styles.pageRailAddText}>+</Text>
              </View>
              <Text style={styles.pageRailLabel}>Add Page</Text>
            </Pressable>
          </View>
        }
      />
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { flex: 1 }]}>Export to separate folder?</Text>
        <Switch accessibilityLabel="Export this page to a separate folder" value={Boolean(exportToFolder)}
          trackColor={{ false: "#D3C7B8", true: "#6B5BD2" }}
          onValueChange={(exportToFolder) => onExportChange({ exportToFolder })} />
      </View>
      {exportToFolder ? (
        <View style={styles.controlGroup}>
          <Text style={styles.controlGroupLabel}>Export folder name</Text>
          <TextInput accessibilityLabel="Export folder name" value={exportFolderName ?? ""}
            placeholder={`Page ${pageNumber}`} placeholderTextColor="#7A6E63"
            style={[styles.input, { color: "#241F1B", backgroundColor: "#FFFFFF" }]} maxLength={80}
            onChangeText={(exportFolderName) => onExportChange({ exportFolderName })} />
          <Text style={styles.textInspectorHelp}>Only used in photo ZIP exports. It will not appear in the book.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
