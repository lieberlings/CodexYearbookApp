import type { Dispatch, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Memory, PhotoItem } from "../../../types";
import { pluralize } from "../helpers";
import { styles } from "../styles";

export function CandidateReviewModal({
  candidateReviewMemory,
  closeCandidateReview,
  candidateReviewPhotos,
  candidateSelectedPhotoIds,
  setCandidateSelectedPhotoIds,
  onApplyCandidatePhotos
}: {
  candidateReviewMemory: Memory | undefined;
  closeCandidateReview: () => void;
  candidateReviewPhotos: PhotoItem[];
  candidateSelectedPhotoIds: string[];
  setCandidateSelectedPhotoIds: Dispatch<SetStateAction<string[]>>;
  onApplyCandidatePhotos: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={Boolean(candidateReviewMemory)} onRequestClose={closeCandidateReview}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Suggested Photos</Text>
                <Text style={styles.modalSubtitle}>
                  {candidateReviewMemory
                    ? `Review project-pool photos that may belong to "${candidateReviewMemory.title}".`
                    : "Review project-pool photos for this memory."}
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={closeCandidateReview}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {candidateReviewPhotos.length > 0 ? (
                <View style={styles.candidateGrid}>
                  {candidateReviewPhotos.map((photo) => {
                    const selected = candidateSelectedPhotoIds.includes(photo.id);
                    return (
                      <Pressable
                        key={photo.id}
                        style={[styles.candidateGridItem, selected ? styles.candidateGridItemSelected : null]}
                        onPress={() =>
                          setCandidateSelectedPhotoIds((prev) =>
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
                  <Ionicons name="sparkles-outline" size={30} color="#6B6156" />
                  <Text style={styles.emptyTitle}>No candidate photos right now</Text>
                  <Text style={styles.emptyText}>
                    Add more project photos or widen the project pool to get stronger photo-addition suggestions.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.deleteMemoryButton} onPress={closeCandidateReview}>
                  <Text style={styles.deleteMemoryButtonText}>Close</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryAction,
                    candidateSelectedPhotoIds.length === 0 ? styles.primaryActionDisabled : null
                  ]}
                  onPress={onApplyCandidatePhotos}
                  disabled={candidateSelectedPhotoIds.length === 0}
                >
                  <Text style={styles.primaryActionText}>
                    {candidateSelectedPhotoIds.length === 0
                      ? "Select Photos"
                      : `Add ${pluralize(candidateSelectedPhotoIds.length, "photo")}`}
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
