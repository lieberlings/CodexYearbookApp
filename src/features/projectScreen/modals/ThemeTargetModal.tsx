import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Memory } from "../../../types";
import { pluralize, StagedAsset } from "../helpers";
import { styles } from "../styles";

export function ThemeTargetModal({
  themeTargetVisible,
  resetThemeFlow,
  themeSelectionLabel,
  themeStagedAssets,
  themeSelectionBusy,
  createNewThemeCollection,
  collectionMemories,
  addThemePhotosToCollection
}: {
  themeTargetVisible: boolean;
  resetThemeFlow: () => void;
  themeSelectionLabel: string | null;
  themeStagedAssets: StagedAsset[];
  themeSelectionBusy: boolean;
  createNewThemeCollection: () => void;
  collectionMemories: Memory[];
  addThemePhotosToCollection: (memoryId: string) => Promise<void>;
}) {
  return (
    <Modal transparent animationType="fade" visible={themeTargetVisible} onRequestClose={resetThemeFlow}>
      <View style={styles.centerModalBackdrop}>
        <View style={styles.actionMenuCard}>
          <Text style={styles.modalTitle}>{themeSelectionLabel ?? "Theme Photos"}</Text>
          <Text style={styles.modalSubtitle}>
            {pluralize(themeStagedAssets.length, "selected photo")} ready. Create a new collection or add them to an existing collection.
          </Text>
          {themeStagedAssets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailPickerRow}>
              {themeStagedAssets.slice(0, 8).map((asset) => (
                <View key={asset.key} style={styles.thumbnailOption}>
                  <Image source={{ uri: asset.uri }} style={styles.thumbnailOptionImage} />
                </View>
              ))}
            </ScrollView>
          ) : null}
          <Pressable
            style={[styles.actionMenuButton, themeSelectionBusy ? styles.suggestionActionDisabled : null]}
            onPress={createNewThemeCollection}
            disabled={themeSelectionBusy || themeStagedAssets.length === 0}
          >
            <Ionicons name="albums-outline" size={20} color="#4A4239" />
            <View style={styles.actionMenuTextBlock}>
              <Text style={styles.actionMenuButtonText}>Create New Collection</Text>
              <Text style={styles.actionMenuHint}>Name it, confirm the thumbnail, then save.</Text>
            </View>
          </Pressable>
          {collectionMemories.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Add to Existing</Text>
              {collectionMemories.map((memory) => (
                <Pressable
                  key={memory.id}
                  style={[styles.actionMenuButton, themeSelectionBusy ? styles.suggestionActionDisabled : null]}
                  onPress={() => void addThemePhotosToCollection(memory.id)}
                  disabled={themeSelectionBusy}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#4A4239" />
                  <View style={styles.actionMenuTextBlock}>
                    <Text style={styles.actionMenuButtonText}>{memory.title}</Text>
                    <Text style={styles.actionMenuHint}>
                      {memory.themeTags && memory.themeTags.length > 0 ? memory.themeTags.join(" | ") : "Collection"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
          <Pressable style={styles.secondaryButtonLike} onPress={resetThemeFlow} disabled={themeSelectionBusy}>
            <Text style={styles.secondaryButtonLikeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
