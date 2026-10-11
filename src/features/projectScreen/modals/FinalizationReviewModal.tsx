import { Ionicons } from "@expo/vector-icons";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FinalizationSuggestion, PhotoItem } from "../../../types";
import { styles } from "../styles";

export function FinalizationReviewModal({
  finalizationReviewSuggestion,
  closeFinalizationReview,
  finalizationReviewPhotos
}: {
  finalizationReviewSuggestion: FinalizationSuggestion | null;
  closeFinalizationReview: () => void;
  finalizationReviewPhotos: PhotoItem[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType="slide"
      visible={Boolean(finalizationReviewSuggestion)}
      onRequestClose={closeFinalizationReview}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{finalizationReviewSuggestion?.title ?? "Finalization Review"}</Text>
                <Text style={styles.modalSubtitle}>
                  {finalizationReviewSuggestion?.message ??
                    "Review these project photos before deciding whether they belong in a final memory or collection."}
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={closeFinalizationReview}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {finalizationReviewPhotos.length > 0 ? (
                <View style={styles.candidateGrid}>
                  {finalizationReviewPhotos.map((photo) => (
                    <View key={photo.id} style={styles.finalizationGridItem}>
                      <Image source={{ uri: photo.uri }} style={styles.candidateGridImage} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="albums-outline" size={30} color="#6B6156" />
                  <Text style={styles.emptyTitle}>No review photos right now</Text>
                  <Text style={styles.emptyText}>
                    This finalization idea does not currently have a stable candidate set attached.
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.deleteMemoryButton} onPress={closeFinalizationReview}>
                  <Text style={styles.deleteMemoryButtonText}>Close</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
