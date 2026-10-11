import type { Dispatch, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Memory, PhotoItem } from "../../../types";
import { DEV_TOOLS_ENABLED } from "../devTools/flags";
import type { MemoryComposerMode, StagedAsset, ThumbnailChoice } from "../helpers";
import { styles } from "../styles";

export function MemoryComposerModal({
  composerVisible,
  closeComposer,
  composerMode,
  composerMemoryKind,
  composerTitle,
  setComposerTitle,
  composerCollectionHooks,
  setComposerCollectionHooks,
  devToolsExpanded,
  composerCandidateProjectPhotos,
  composerSelectedProjectPhotoIds,
  setComposerSelectedProjectPhotoIds,
  onPickComposerPhotos,
  composerPicking,
  composerThumbnailUri,
  composerExistingPhotos,
  composerSelectableProjectPhotos,
  composerStagedAssets,
  composerThumbnailChoice,
  setComposerThumbnailChoice,
  onDeleteComposerMemory,
  composerCanSave,
  onSaveComposer,
  composerSaving
}: {
  composerVisible: boolean;
  closeComposer: () => void;
  composerMode: MemoryComposerMode;
  composerMemoryKind: Memory["kind"];
  composerTitle: string;
  setComposerTitle: (title: string) => void;
  composerCollectionHooks: string;
  setComposerCollectionHooks: (hooks: string) => void;
  devToolsExpanded: boolean;
  composerCandidateProjectPhotos: PhotoItem[];
  composerSelectedProjectPhotoIds: string[];
  setComposerSelectedProjectPhotoIds: Dispatch<SetStateAction<string[]>>;
  onPickComposerPhotos: () => void;
  composerPicking: boolean;
  composerThumbnailUri: string | undefined;
  composerExistingPhotos: PhotoItem[];
  composerSelectableProjectPhotos: PhotoItem[];
  composerStagedAssets: StagedAsset[];
  composerThumbnailChoice: ThumbnailChoice | undefined;
  setComposerThumbnailChoice: (choice: ThumbnailChoice | undefined) => void;
  onDeleteComposerMemory: () => void;
  composerCanSave: boolean;
  onSaveComposer: () => void;
  composerSaving: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={composerVisible} onRequestClose={closeComposer}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {composerMode === "create"
                    ? composerMemoryKind === "collection"
                      ? "New Collection"
                      : "New Memory"
                    : composerMemoryKind === "collection"
                      ? "Edit Collection"
                      : "Edit Memory"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {composerMemoryKind === "collection"
                    ? "Set a title, pick starting photos, and choose the collection thumbnail."
                    : "Set a title, pick starting photos, and choose the memory thumbnail."}
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={closeComposer}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>
                {composerMemoryKind === "collection" ? "Collection Title" : "Memory Title"}
              </Text>
              <TextInput
                value={composerTitle}
                onChangeText={setComposerTitle}
                placeholder={composerMemoryKind === "collection" ? "Collection title" : "Memory title"}
                placeholderTextColor="#6B6156"
                style={styles.modalInput}
              />

              {composerMemoryKind === "collection" ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Collection Hooks</Text>
                  <TextInput
                    value={composerCollectionHooks}
                    onChangeText={setComposerCollectionHooks}
                    placeholder="Examples: hiking, family, sunsets"
                    placeholderTextColor="#6B6156"
                    style={styles.modalInput}
                  />
                  <Text style={styles.fieldHelperText}>
                    Use simple comma-separated cues. They are stored with the collection and used to propose project
                    photos without auto-adding them.
                  </Text>
                </View>
              ) : null}

              {DEV_TOOLS_ENABLED && devToolsExpanded && composerMemoryKind === "collection" ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Suggested Project Photos</Text>
                  <Text style={styles.fieldHelperText}>
                    Tap any suggested photo to include it when you save this collection. Nothing is auto-added.
                  </Text>
                  {composerCandidateProjectPhotos.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.collectionCandidateRow}
                    >
                      {composerCandidateProjectPhotos.map((photo) => {
                        const selected = composerSelectedProjectPhotoIds.includes(photo.id);
                        return (
                          <Pressable
                            key={photo.id}
                            style={[
                              styles.collectionCandidateCard,
                              selected ? styles.collectionCandidateCardSelected : null
                            ]}
                            onPress={() =>
                              setComposerSelectedProjectPhotoIds((prev) =>
                                prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                              )
                            }
                          >
                            <Image source={{ uri: photo.uri }} style={styles.collectionCandidateImage} />
                            <View
                              style={[
                                styles.collectionCandidateBadge,
                                selected ? styles.collectionCandidateBadgeSelected : null
                              ]}
                            >
                              <Text
                                style={[
                                  styles.collectionCandidateBadgeText,
                                  selected ? styles.collectionCandidateBadgeTextSelected : null
                                ]}
                              >
                                {selected ? "Include" : "Suggest"}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.thumbnailOptionEmpty}>
                      <Ionicons name="sparkles-outline" size={24} color="#6B6156" />
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.inlineActionRow}>
                <Text style={styles.fieldLabel}>Photos</Text>
                <Pressable style={styles.inlineButton} onPress={onPickComposerPhotos} disabled={composerPicking}>
                  {composerPicking ? (
                    <ActivityIndicator color="#4A4239" />
                  ) : (
                    <Text style={styles.inlineButtonText}>Add Photos</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.thumbnailPreviewCard}>
                {composerThumbnailUri ? (
                  <Image source={{ uri: composerThumbnailUri }} style={styles.thumbnailPreviewImage} />
                ) : (
                  <View style={styles.thumbnailPreviewPlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#6B6156" />
                    <Text style={styles.thumbnailPreviewPlaceholderText}>Select a thumbnail</Text>
                  </View>
                )}
              </View>

              <Text style={styles.fieldLabel}>Thumbnail</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailPickerRow}
              >
                {composerExistingPhotos.map((photo) => {
                  const selected =
                    composerThumbnailChoice?.kind === "existing" && composerThumbnailChoice.photoId === photo.id;
                  return (
                    <Pressable
                      key={photo.id}
                      onPress={() => setComposerThumbnailChoice({ kind: "existing", photoId: photo.id })}
                      style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.thumbnailOptionImage} />
                      <View style={styles.thumbTagExisting}>
                        <Text style={styles.thumbTagText}>Current</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {composerSelectableProjectPhotos
                  .filter((photo) => !composerExistingPhotos.some((existing) => existing.id === photo.id))
                  .map((photo) => {
                    const selected =
                      composerThumbnailChoice?.kind === "existing" && composerThumbnailChoice.photoId === photo.id;
                    return (
                      <Pressable
                        key={photo.id}
                        onPress={() => setComposerThumbnailChoice({ kind: "existing", photoId: photo.id })}
                        style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                      >
                        <Image source={{ uri: photo.uri }} style={styles.thumbnailOptionImage} />
                        <View style={styles.thumbTagNew}>
                          <Text style={styles.thumbTagText}>Selected</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                {composerStagedAssets.map((asset) => {
                  const selected =
                    composerThumbnailChoice?.kind === "staged" &&
                    composerThumbnailChoice.stagedKey === asset.key;
                  return (
                    <Pressable
                      key={asset.key}
                      onPress={() => setComposerThumbnailChoice({ kind: "staged", stagedKey: asset.key })}
                      style={[styles.thumbnailOption, selected ? styles.thumbnailOptionSelected : null]}
                    >
                      <Image source={{ uri: asset.uri }} style={styles.thumbnailOptionImage} />
                      <View style={styles.thumbTagNew}>
                        <Text style={styles.thumbTagText}>New</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {composerExistingPhotos.length === 0 && composerSelectableProjectPhotos.length === 0 && composerStagedAssets.length === 0 ? (
                  <View style={[styles.thumbnailOption, styles.thumbnailOptionEmpty]}>
                    <Ionicons name="images-outline" size={28} color="#6B6156" />
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.modalActions}>
                {composerMode === "edit" ? (
                  <Pressable style={styles.deleteMemoryButton} onPress={onDeleteComposerMemory}>
                    <Text style={styles.deleteMemoryButtonText}>Delete Memory</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.primaryAction, !composerCanSave ? styles.primaryActionDisabled : null]}
                  onPress={onSaveComposer}
                  disabled={!composerCanSave}
                >
                  <Text style={styles.primaryActionText}>
                    {composerSaving ? "Saving..." : composerMode === "create" ? "Create Memory" : "Save Changes"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
