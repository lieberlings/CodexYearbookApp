import type { Dispatch, ReactElement, SetStateAction } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { FinalizationSuggestion, Project, Suggestion } from "../../../types";
import { DEV_TOOLS_ENABLED } from "../devTools/flags";
import { StatusCard, SUGGESTED_THEME_PAGE_LABELS, SuggestionScanState } from "../helpers";
import { styles } from "../styles";

export function InlineProjectSections({
  scanningSuggestions,
  onScanSuggestions,
  project,
  suggestionSummary,
  projectSuggestions,
  setSuggestionsExpanded,
  suggestionsExpanded,
  dismissedSuggestions,
  setShowDismissedSuggestions,
  showDismissedSuggestions,
  suggestionStateCard,
  suggestionScanState,
  newSuggestions,
  renderSuggestionCard,
  watchingSuggestions,
  snoozedSuggestions,
  acceptedSuggestions,
  setThemePickerVisible,
  openThemePhotoPicker,
  onStartFinalization,
  onCompleteFinalization,
  finalizationSummary,
  devToolsExpanded,
  setFinalizationExpanded,
  finalizationExpanded,
  finalizationSuggestions,
  finalizationStateCard,
  missingMomentFinalizationSuggestions,
  renderFinalizationSuggestionCard,
  strongestUnusedFinalizationSuggestions,
  highlightFinalizationSuggestions
}: {
  scanningSuggestions: boolean;
  onScanSuggestions: () => void;
  project: Project;
  suggestionSummary: string;
  projectSuggestions: Suggestion[];
  setSuggestionsExpanded: Dispatch<SetStateAction<boolean>>;
  suggestionsExpanded: boolean;
  dismissedSuggestions: Suggestion[];
  setShowDismissedSuggestions: Dispatch<SetStateAction<boolean>>;
  showDismissedSuggestions: boolean;
  suggestionStateCard: StatusCard | undefined;
  suggestionScanState: SuggestionScanState;
  newSuggestions: Suggestion[];
  renderSuggestionCard: (suggestion: Suggestion) => ReactElement;
  watchingSuggestions: Suggestion[];
  snoozedSuggestions: Suggestion[];
  acceptedSuggestions: Suggestion[];
  setThemePickerVisible: (visible: boolean) => void;
  openThemePhotoPicker: (label: string) => Promise<void>;
  onStartFinalization: () => void;
  onCompleteFinalization: () => void;
  finalizationSummary: string;
  devToolsExpanded: boolean;
  setFinalizationExpanded: Dispatch<SetStateAction<boolean>>;
  finalizationExpanded: boolean;
  finalizationSuggestions: FinalizationSuggestion[];
  finalizationStateCard: StatusCard;
  missingMomentFinalizationSuggestions: FinalizationSuggestion[];
  renderFinalizationSuggestionCard: (suggestion: FinalizationSuggestion) => ReactElement;
  strongestUnusedFinalizationSuggestions: FinalizationSuggestion[];
  highlightFinalizationSuggestions: FinalizationSuggestion[];
}) {
  return (
    <>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeading}>Suggested Memories</Text>
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
            <Text style={styles.scanButtonText}>Scan Memories</Text>
          </>
        )}
      </Pressable>
    </View>
    <Text style={styles.sectionSubheading}>
      Review suggested event memories for this project. Actions stay local and will not create pages automatically.
    </Text>

    {suggestionSummary ? <Text style={styles.suggestionSummary}>{suggestionSummary}</Text> : null}

    {projectSuggestions.length > 0 ? (
      <View style={styles.sectionControlRow}>
        <Pressable style={styles.dismissedToggle} onPress={() => setSuggestionsExpanded((prev) => !prev)}>
          <Ionicons
            name={suggestionsExpanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={15}
            color="#6B6156"
          />
          <Text style={styles.dismissedToggleText}>
            {suggestionsExpanded
              ? `Collapse suggestions (${projectSuggestions.length})`
              : `Expand suggestions (${projectSuggestions.length})`}
          </Text>
        </Pressable>

        {suggestionsExpanded && dismissedSuggestions.length > 0 ? (
          <Pressable
            style={styles.dismissedToggle}
            onPress={() => setShowDismissedSuggestions((prev) => !prev)}
          >
            <Ionicons
              name={showDismissedSuggestions ? "eye-off-outline" : "eye-outline"}
              size={15}
              color="#6B6156"
            />
            <Text style={styles.dismissedToggleText}>
              {showDismissedSuggestions
                ? `Hide dismissed (${dismissedSuggestions.length})`
                : `Show dismissed (${dismissedSuggestions.length})`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ) : null}

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

    {!suggestionsExpanded && projectSuggestions.length > 0 ? (
      <Text style={styles.suggestionCollapsedHint}>
        Suggestion cards are hidden to keep this screen lighter. Expand them when you want to review or act on them.
      </Text>
    ) : null}

    {suggestionsExpanded && newSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>New</Text>
          <Text style={styles.suggestionGroupHint}>Ready to review and accept.</Text>
        </View>
        <View style={styles.suggestionList}>{newSuggestions.map(renderSuggestionCard)}</View>
      </View>
    ) : null}

    {suggestionsExpanded && watchingSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Watching</Text>
          <Text style={styles.suggestionGroupHint}>
            Collection ideas that are staged for later growth without becoming full memories yet.
          </Text>
        </View>
        <View style={styles.suggestionList}>{watchingSuggestions.map(renderSuggestionCard)}</View>
      </View>
    ) : null}

    {suggestionsExpanded && snoozedSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Snoozed</Text>
          <Text style={styles.suggestionGroupHint}>Parked for later so they stay visible during testing.</Text>
        </View>
        <View style={styles.suggestionList}>{snoozedSuggestions.map(renderSuggestionCard)}</View>
      </View>
    ) : null}

    {suggestionsExpanded && acceptedSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Accepted</Text>
          <Text style={styles.suggestionGroupHint}>
            Kept visible in Milestone 1 so you can verify created memories.
          </Text>
        </View>
        <View style={styles.suggestionList}>{acceptedSuggestions.map(renderSuggestionCard)}</View>
      </View>
    ) : null}

    {suggestionsExpanded && showDismissedSuggestions && dismissedSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Dismissed</Text>
          <Text style={styles.suggestionGroupHint}>Hidden by default to reduce clutter during testing.</Text>
        </View>
        <View style={styles.suggestionList}>{dismissedSuggestions.map(renderSuggestionCard)}</View>
      </View>
    ) : null}

    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeading}>Suggested Theme Pages</Text>
      <Pressable style={styles.scanButton} onPress={() => setThemePickerVisible(true)}>
        <Ionicons name="search-outline" size={15} color="#4A4239" />
        <Text style={styles.scanButtonText}>Pick Theme</Text>
      </Pressable>
    </View>
    <Text style={styles.sectionSubheading}>
      Theme pages are user-led in the MVP. Pick a theme, choose exact photos, then create or add to a collection.
    </Text>
    <View style={styles.themeSuggestionCard}>
      <View style={styles.themeSuggestionHeader}>
        <Ionicons name="albums-outline" size={24} color="#6B5BD2" />
        <View style={styles.themeSuggestionTextBlock}>
          <Text style={styles.emptyTitle}>Theme picker</Text>
          <Text style={styles.emptyText}>
            Suggested themes open a picker. Nothing is imported until you select photos and choose where to put them.
          </Text>
        </View>
      </View>
      <View style={styles.themeChipRow}>
        {SUGGESTED_THEME_PAGE_LABELS.map((label) => (
          <Pressable key={label} style={styles.themeChip} onPress={() => void openThemePhotoPicker(label)}>
            <Text style={styles.themeChipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>

    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeading}>Finalization</Text>
      {project?.finalizationStatus === "idle" ? (
        <Pressable style={styles.scanButton} onPress={onStartFinalization}>
          <Ionicons name="flag-outline" size={15} color="#4A4239" />
          <Text style={styles.scanButtonText}>Start Finalization</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.scanButton} onPress={onCompleteFinalization}>
          <Ionicons name="checkmark-done-outline" size={15} color="#4A4239" />
          <Text style={styles.scanButtonText}>
            {project?.finalizationStatus === "reviewed" ? "Reviewed" : "Mark Reviewed"}
          </Text>
        </Pressable>
      )}
    </View>
    <Text style={styles.sectionSubheading}>
      A lightweight end-stage entry for reviewing accepted memories and theme pages before finishing the book.
    </Text>
    <Text style={styles.suggestionSummary}>{finalizationSummary}</Text>

    {DEV_TOOLS_ENABLED && devToolsExpanded ? (
      <View style={styles.sectionControlRow}>
      <Pressable style={styles.dismissedToggle} onPress={() => setFinalizationExpanded((prev) => !prev)}>
        <Ionicons
          name={finalizationExpanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={15}
          color="#6B6156"
        />
        <Text style={styles.dismissedToggleText}>
          {finalizationExpanded
            ? `Collapse finalization (${finalizationSuggestions.length})`
            : `Expand finalization (${finalizationSuggestions.length})`}
        </Text>
      </Pressable>
      </View>
    ) : (
      <Text style={styles.suggestionCollapsedHint}>
        Detailed finalization review is deferred until accepted-memory and theme-page inputs are wired for the MVP.
      </Text>
    )}

    {finalizationStateCard ? (
      <View
        style={[
          styles.suggestionsStateCard,
          finalizationStateCard.tone === "error" ? styles.suggestionsStateCardError : null,
          finalizationStateCard.tone === "info" ? styles.suggestionsStateCardInfo : null,
          finalizationStateCard.tone === "success" ? styles.suggestionsStateCardSuccess : null
        ]}
      >
        <Ionicons
          name={finalizationStateCard.icon}
          size={24}
          color={
            finalizationStateCard.tone === "error"
              ? "#AD432F"
              : finalizationStateCard.tone === "success"
                ? "#327558"
                : "#6B5BD2"
          }
        />
        <Text style={styles.emptyTitle}>{finalizationStateCard.title}</Text>
        <Text style={styles.emptyText}>{finalizationStateCard.message}</Text>
      </View>
    ) : null}

    {DEV_TOOLS_ENABLED && devToolsExpanded && !finalizationExpanded && finalizationSuggestions.length > 0 ? (
      <Text style={styles.suggestionCollapsedHint}>
        Finalization ideas are hidden until you expand them, so the main project workflow stays uncluttered.
      </Text>
    ) : null}

    {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && missingMomentFinalizationSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Missing Moments</Text>
          <Text style={styles.suggestionGroupHint}>
            Unassigned time clusters that may deserve a final event memory or recap page.
          </Text>
        </View>
        <View style={styles.suggestionList}>
          {missingMomentFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
        </View>
      </View>
    ) : null}

    {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && strongestUnusedFinalizationSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Strongest Unused Photos</Text>
          <Text style={styles.suggestionGroupHint}>
            High-value photos still outside memories near the end of the project.
          </Text>
        </View>
        <View style={styles.suggestionList}>
          {strongestUnusedFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
        </View>
      </View>
    ) : null}

    {DEV_TOOLS_ENABLED && devToolsExpanded && finalizationExpanded && highlightFinalizationSuggestions.length > 0 ? (
      <View style={styles.suggestionGroup}>
        <View style={styles.suggestionGroupHeader}>
          <Text style={styles.suggestionGroupTitle}>Recurring Highlights</Text>
          <Text style={styles.suggestionGroupHint}>
            Repeating themes across the project that may work better as closing highlight collections.
          </Text>
        </View>
        <View style={styles.suggestionList}>
          {highlightFinalizationSuggestions.map(renderFinalizationSuggestionCard)}
        </View>
      </View>
    ) : null}
    </>
  );
}
