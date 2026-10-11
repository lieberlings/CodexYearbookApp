import type { ReactElement } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Suggestion } from "../../../types";
import type { StatusCard, SuggestionScanState } from "../helpers";
import { styles } from "../styles";

export function SuggestionsModal({
  suggestionsModalVisible,
  setSuggestionsModalVisible,
  scanningSuggestions,
  onScanSuggestions,
  suggestionStateCard,
  suggestionScanState,
  newSuggestions,
  watchingSuggestions,
  snoozedSuggestions,
  acceptedSuggestions,
  renderSuggestionCard
}: {
  suggestionsModalVisible: boolean;
  setSuggestionsModalVisible: (visible: boolean) => void;
  scanningSuggestions: boolean;
  onScanSuggestions: () => void;
  suggestionStateCard: StatusCard | undefined;
  suggestionScanState: SuggestionScanState;
  newSuggestions: Suggestion[];
  watchingSuggestions: Suggestion[];
  snoozedSuggestions: Suggestion[];
  acceptedSuggestions: Suggestion[];
  renderSuggestionCard: (suggestion: Suggestion) => ReactElement;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={suggestionsModalVisible} onRequestClose={() => setSuggestionsModalVisible(false)}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAvoider}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Suggested Memories</Text>
                <Text style={styles.modalSubtitle}>
                  Scan for local suggestions, then review photos before creating a memory or collection.
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setSuggestionsModalVisible(false)}>
                <Ionicons name="close" size={22} color="#4A4239" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Suggestions</Text>
                <Pressable
                  style={[styles.scanButton, scanningSuggestions ? styles.scanButtonDisabled : null]}
                  onPress={onScanSuggestions}
                  disabled={scanningSuggestions}
                >
                  {scanningSuggestions ? (
                    <ActivityIndicator color="#4A4239" size="small" />
                  ) : (
                    <>
                      <Ionicons name="search-outline" size={15} color="#4A4239" />
                      <Text style={styles.scanButtonText}>Scan</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {suggestionStateCard ? (
                <View
                  style={[
                    styles.suggestionsStateCard,
                    suggestionStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
                    suggestionStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
                    suggestionStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
                  ]}
                >
                  {suggestionScanState === "scanning" ? (
                    <ActivityIndicator color="#4A4239" />
                  ) : (
                    <Ionicons
                      name={suggestionStateCard.icon}
                      size={24}
                      color={
                        suggestionStateCard.tone === "error"
                          ? "#AD432F"
                          : suggestionStateCard.tone === "success"
                            ? "#327558"
                            : "#6B5BD2"
                      }
                    />
                  )}
                  <Text style={styles.emptyTitle}>{suggestionStateCard.title}</Text>
                  <Text style={styles.emptyText}>{suggestionStateCard.message}</Text>
                </View>
              ) : null}

              {newSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <Text style={styles.suggestionGroupTitle}>New</Text>
                  <View style={styles.suggestionList}>{newSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}
              {watchingSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <Text style={styles.suggestionGroupTitle}>Watching</Text>
                  <View style={styles.suggestionList}>{watchingSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}
              {snoozedSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <Text style={styles.suggestionGroupTitle}>Snoozed</Text>
                  <View style={styles.suggestionList}>{snoozedSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}
              {acceptedSuggestions.length > 0 ? (
                <View style={styles.suggestionGroup}>
                  <Text style={styles.suggestionGroupTitle}>Accepted</Text>
                  <View style={styles.suggestionList}>{acceptedSuggestions.map(renderSuggestionCard)}</View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
