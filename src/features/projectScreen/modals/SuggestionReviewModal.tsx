import type { Dispatch, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PhotoItem, Suggestion, SuggestionCandidatePhotoRef } from "../../../types";
import { styles } from "../styles";

export function SuggestionReviewModal({
  suggestionReview,
  closeSuggestionReview,
  suggestionReviewCandidateRefs,
  suggestionReviewPhotos,
  suggestionSelectedPhotoIds,
  setSuggestionSelectedPhotoIds,
  onSnoozeSuggestion,
  onDismissSuggestion,
  activeSuggestionId,
  createMemoryFromReviewedSuggestion
}: {
  suggestionReview: Suggestion | null;
  closeSuggestionReview: () => void;
  suggestionReviewCandidateRefs: SuggestionCandidatePhotoRef[];
  suggestionReviewPhotos: PhotoItem[];
  suggestionSelectedPhotoIds: string[];
  setSuggestionSelectedPhotoIds: Dispatch<SetStateAction<string[]>>;
  onSnoozeSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  activeSuggestionId: string | null;
  createMemoryFromReviewedSuggestion: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={Boolean(suggestionReview)} onRequestClose={closeSuggestionReview}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{suggestionReview?.title ?? "Review Suggestion"}</Text>
                <Text style={styles.modalSubtitle}>
                  Select the photos you want, then create a memory or collection with your own title.
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={closeSuggestionReview}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {suggestionReview ? (
                <Text style={styles.suggestionMessage}>{suggestionReview.message}</Text>
              ) : null}

              {suggestionReviewCandidateRefs.length > 0 ? (
                <View style={styles.candidateGrid}>
                  {suggestionReviewCandidateRefs.map((ref) => {
                    const selected = suggestionSelectedPhotoIds.includes(ref.id);
                    return (
                      <Pressable
                        key={ref.id}
                        style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                        onPress={() =>
                          setSuggestionSelectedPhotoIds((prev) =>
                            prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id]
                          )
                        }
                      >
                        <Image source={{ uri: ref.uri }} style={styles.candidateGridImage} />
                        <View style={[styles.candidateGridCheck, selected ? styles.candidateGridCheckSelected : null]}>
                          <Ionicons
                            name={selected ? "checkmark" : "add"}
                            size={16}
                            color={selected ? "#ffffff" : "#4A4239"}
                          />
                        </View>
                        {ref.location ? (
                          <View style={styles.mediaLibraryProbeBadge}>
                            <Text style={styles.mediaLibraryProbeBadgeText}>GPS</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : suggestionReviewPhotos.length > 0 ? (
                <View style={styles.candidateGrid}>
                  {suggestionReviewPhotos.map((photo) => {
                    const selected = suggestionSelectedPhotoIds.includes(photo.id);
                    return (
                      <Pressable
                        key={photo.id}
                        style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                        onPress={() =>
                          setSuggestionSelectedPhotoIds((prev) =>
                            prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
                          )
                        }
                      >
                        <Image source={{ uri: photo.uri }} style={styles.candidateGridImage} />
                        <View style={[styles.candidateGridCheck, selected ? styles.candidateGridCheckSelected : null]}>
                          <Ionicons
                            name={selected ? "checkmark" : "add"}
                            size={16}
                            color={selected ? "#ffffff" : "#4A4239"}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="images-outline" size={30} color="#6B6156" />
                  <Text style={styles.emptyTitle}>No preview photos</Text>
                  <Text style={styles.emptyText}>This suggestion does not currently have candidate photos attached.</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.deleteMemoryButton} onPress={closeSuggestionReview}>
                  <Text style={styles.deleteMemoryButtonText}>Close</Text>
                </Pressable>
                {suggestionReview ? (
                  <>
                    <Pressable style={[styles.suggestionActionButton, styles.suggestionSecondaryAction]} onPress={() => {
                      onSnoozeSuggestion(suggestionReview.id);
                      closeSuggestionReview();
                    }}>
                      <Text style={styles.suggestionSecondaryActionText}>Snooze</Text>
                    </Pressable>
                    <Pressable style={[styles.suggestionActionButton, styles.suggestionDangerAction]} onPress={() => {
                      onDismissSuggestion(suggestionReview.id);
                      closeSuggestionReview();
                    }}>
                      <Text style={styles.suggestionDangerActionText}>Dismiss</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable
                  style={[
                    styles.primaryAction,
                    suggestionSelectedPhotoIds.length === 0 || activeSuggestionId === suggestionReview?.id
                      ? styles.primaryActionDisabled
                      : null
                  ]}
                  onPress={createMemoryFromReviewedSuggestion}
                  disabled={suggestionSelectedPhotoIds.length === 0 || activeSuggestionId === suggestionReview?.id}
                >
                  <Text style={styles.primaryActionText}>
                    {activeSuggestionId === suggestionReview?.id
                      ? "Importing..."
                      : suggestionSelectedPhotoIds.length === 0
                        ? "Select Photos"
                        : "Create"}
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
