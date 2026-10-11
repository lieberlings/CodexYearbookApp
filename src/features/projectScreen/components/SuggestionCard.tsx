import { router } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { PhotoItem, Suggestion } from "../../../types";
import {
  formatSuggestionStatus,
  getSuggestionCandidateCount,
  getSuggestionCandidateRefs,
  getSuggestionTypeLabel,
  pluralize
} from "../helpers";
import { styles } from "../styles";

function getSuggestionStatusStyle(status: Suggestion["status"]) {
  switch (status) {
    case "accepted":
      return {
        badge: styles.suggestionStatusAccepted,
        text: styles.suggestionStatusAcceptedText
      };
    case "dismissed":
      return {
        badge: styles.suggestionStatusDismissed,
        text: styles.suggestionStatusDismissedText
      };
    case "watching":
      return {
        badge: styles.suggestionStatusWatching,
        text: styles.suggestionStatusWatchingText
      };
    case "snoozed":
      return {
        badge: styles.suggestionStatusSnoozed,
        text: styles.suggestionStatusSnoozedText
      };
    default:
      return {
        badge: styles.suggestionStatusNew,
        text: styles.suggestionStatusNewText
      };
  }
}

export function SuggestionCard({
  suggestion,
  activeSuggestionId,
  projectPhotos,
  openSuggestionReview,
  onKeepWatchingSuggestion,
  onSnoozeSuggestion,
  onDismissSuggestion
}: {
  suggestion: Suggestion;
  activeSuggestionId: string | null;
  projectPhotos: PhotoItem[];
  openSuggestionReview: (suggestionId: string) => void;
  onKeepWatchingSuggestion: (suggestionId: string) => void;
  onSnoozeSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}) {
  const statusStyles = getSuggestionStatusStyle(suggestion.status);
  const isBusy = activeSuggestionId === suggestion.id;
  const candidateRefs = getSuggestionCandidateRefs(suggestion);
  const candidateCount = getSuggestionCandidateCount(suggestion);
  const candidatePreviewPhotos = suggestion.candidatePhotoIds
    .map((photoId) => projectPhotos.find((photo) => photo.id === photoId))
    .filter((photo): photo is PhotoItem => Boolean(photo))
    .slice(0, 4);
  const candidatePreviewRefs = candidateRefs.slice(0, 4);
  const lifecycleNote =
    suggestion.status === "accepted"
      ? suggestion.acceptedMemoryId
        ? "Accepted. A memory was created from this suggestion and linked below for testing."
        : "Accepted. This suggestion is kept visible during Milestone 1 for traceability."
      : suggestion.status === "watching"
        ? "Watching. This collection idea is staged so it can accumulate value before becoming a full memory."
      : suggestion.status === "snoozed"
        ? "Snoozed. This suggestion is parked for later review."
        : suggestion.status === "dismissed"
          ? "Dismissed. Hidden by default to keep the scaffold readable during testing."
          : "New. Ready to review and accept into a memory.";

  return (
    <View key={suggestion.id} style={styles.suggestionCard}>
      <View style={styles.suggestionCardHeader}>
        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
        <View style={[styles.suggestionStatusBadge, statusStyles.badge]}>
          <Text style={[styles.suggestionStatusText, statusStyles.text]}>
            {formatSuggestionStatus(suggestion.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.suggestionMessage}>{suggestion.message}</Text>
      <Text style={styles.suggestionMeta}>
        {getSuggestionTypeLabel(suggestion.type)} |{" "}
        {candidateCount > 0 ? `${pluralize(candidateCount, "candidate photo")}` : "No candidate photos attached"}
      </Text>
      <Text style={styles.suggestionLifecycleNote}>{lifecycleNote}</Text>
      {candidatePreviewRefs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionPreviewRow}>
          {candidatePreviewRefs.map((ref) => (
            <Image key={ref.id} source={{ uri: ref.uri }} style={styles.suggestionPreviewThumb} />
          ))}
        </ScrollView>
      ) : candidatePreviewPhotos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionPreviewRow}>
          {candidatePreviewPhotos.map((photo) => (
            <Image key={photo.id} source={{ uri: photo.uri }} style={styles.suggestionPreviewThumb} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.suggestionActionRow}>
        {suggestion.status === "accepted" && suggestion.acceptedMemoryId ? (
          <Pressable
            style={[styles.suggestionActionButton, styles.suggestionPrimaryAction]}
            onPress={() => router.push({ pathname: "/memory/[id]", params: { id: suggestion.acceptedMemoryId! } })}
            >
              <Text style={styles.suggestionPrimaryActionText}>Open Memory</Text>
            </Pressable>
        ) : (
          <Pressable
            style={[
              styles.suggestionActionButton,
              styles.suggestionPrimaryAction,
              isBusy || suggestion.status === "accepted" || candidateCount === 0 ? styles.suggestionActionDisabled : null
            ]}
            onPress={() => openSuggestionReview(suggestion.id)}
            disabled={isBusy || suggestion.status === "accepted" || candidateCount === 0}
          >
            <Text style={styles.suggestionPrimaryActionText}>{isBusy ? "Working..." : "Review"}</Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.suggestionActionButton,
            styles.suggestionSecondaryAction,
            suggestion.type === "collection"
              ? suggestion.status === "watching" || suggestion.status === "accepted"
                ? styles.suggestionActionDisabled
                : null
              : suggestion.status === "snoozed" || suggestion.status === "accepted"
              ? styles.suggestionActionDisabled
              : null
          ]}
          onPress={() =>
            suggestion.type === "collection"
              ? onKeepWatchingSuggestion(suggestion.id)
              : onSnoozeSuggestion(suggestion.id)
          }
          disabled={
            suggestion.type === "collection"
              ? suggestion.status === "watching" || suggestion.status === "accepted"
              : suggestion.status === "snoozed" || suggestion.status === "accepted"
          }
        >
          <Text style={styles.suggestionSecondaryActionText}>
            {suggestion.type === "collection" ? "Keep Watching" : "Snooze"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.suggestionActionButton,
            styles.suggestionDangerAction,
            suggestion.status === "dismissed" || suggestion.status === "accepted"
              ? styles.suggestionActionDisabled
              : null
          ]}
          onPress={() => onDismissSuggestion(suggestion.id)}
          disabled={suggestion.status === "dismissed" || suggestion.status === "accepted"}
        >
          <Text style={styles.suggestionDangerActionText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
