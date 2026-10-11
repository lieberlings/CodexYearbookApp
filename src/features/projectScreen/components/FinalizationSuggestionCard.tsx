import { Pressable, Text, View } from "react-native";
import type { FinalizationSuggestion } from "../../../types";
import { getFinalizationTypeLabel, pluralize } from "../helpers";
import { styles } from "../styles";

export function FinalizationSuggestionCard({
  suggestion,
  setFinalizationReviewSuggestion
}: {
  suggestion: FinalizationSuggestion;
  setFinalizationReviewSuggestion: (suggestion: FinalizationSuggestion) => void;
}) {
  const candidateCount = suggestion.candidatePhotoIds.length;

  return (
    <View key={suggestion.id} style={styles.suggestionCard}>
      <View style={styles.suggestionCardHeader}>
        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
        <View style={[styles.suggestionStatusBadge, styles.finalizationStatusBadge]}>
          <Text style={[styles.suggestionStatusText, styles.finalizationStatusText]}>
            {getFinalizationTypeLabel(suggestion.type)}
          </Text>
        </View>
      </View>
      <Text style={styles.suggestionMessage}>{suggestion.message}</Text>
      <Text style={styles.suggestionMeta}>
        {candidateCount > 0 ? `${pluralize(candidateCount, "candidate photo")}` : "No candidate photos attached"}
        {suggestion.highlightTag ? ` | ${suggestion.highlightTag}` : ""}
      </Text>
      <Text style={styles.suggestionLifecycleNote}>
        Finalization stays optional. Review the photos here, then decide whether they belong in a new or expanded memory.
      </Text>
      <View style={styles.suggestionActionRow}>
        <Pressable
          style={[styles.suggestionActionButton, styles.suggestionPrimaryAction]}
          onPress={() => setFinalizationReviewSuggestion(suggestion)}
        >
          <Text style={styles.suggestionPrimaryActionText}>Review Photos</Text>
        </Pressable>
      </View>
    </View>
  );
}
