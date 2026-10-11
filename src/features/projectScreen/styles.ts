import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  suggestionEntry: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 18,
    marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: "#D9D1F6", backgroundColor: "#EDE8FA"
  },
  addButtonLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  screen: {
    flex: 1,
    backgroundColor: "#FBF6EE"
  },
  missingScreen: {
    flex: 1,
    backgroundColor: "#FBF6EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16
  },
  missingTitle: {
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "700"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8DFD2"
  },
  topIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTextWrap: {
    flex: 1,
    alignItems: "flex-start",
  },
  projectTitle: {
    color: "#241F1B",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  projectStats: {
    marginTop: 4,
    color: "#6B6156",
    fontSize: 13
  },
  contentArea: {
    flex: 1
  },
  listHeader: {
    gap: 14,
    paddingTop: 10,
    paddingBottom: 18
  },
  devToolsSection: {
    gap: 14,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderStyle: "dashed",
    backgroundColor: "#F3EBDE"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeaderRowStack: {
    flexWrap: "wrap",
    alignItems: "flex-start"
  },
  sectionHeaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  sectionHeaderActionsFullWidth: {
    width: "100%",
    justifyContent: "flex-start"
  },
  sectionHeading: {
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "800",
    flexShrink: 1
  },
  sectionSubheading: {
    color: "#6B6156",
    fontSize: 13,
    lineHeight: 18
  },
  scanButton: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3EBDE",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  scanButtonDisabled: {
    opacity: 0.6
  },
  scanButtonText: {
    color: "#4A4239",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionSummary: {
    color: "#6B6156",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionCollapsedHint: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 18
  },
  projectPhotoStrip: {
    gap: 10,
    paddingRight: 12
  },
  sectionControlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center"
  },
  projectPoolControlRow: {
    gap: 10
  },
  projectPoolControlText: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 18
  },
  projectPhotoThumbWrap: {
    width: 78,
    height: 78,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  projectPhotoThumb: {
    width: "100%",
    height: "100%"
  },
  analysisPickerSection: {
    gap: 10
  },
  analysisPickerRow: {
    gap: 10,
    paddingRight: 12
  },
  analysisPickerCard: {
    width: 92,
    height: 110,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  analysisPickerCardSelected: {
    borderWidth: 2,
    borderColor: "#6B5BD2"
  },
  analysisPickerImage: {
    width: "100%",
    height: 78
  },
  analysisPickerMeta: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  analysisPickerMetaText: {
    color: "#4A4239",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  analysisPreviewCard: {
    height: 220,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  analysisPreviewImage: {
    width: "100%",
    height: "100%"
  },
  analysisActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  analysisSection: {
    gap: 10
  },
  analysisSectionTitle: {
    color: "#4A4239",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  analysisSectionBody: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  analysisFieldRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8DFD2",
    gap: 6
  },
  analysisFieldLabel: {
    color: "#6B6156",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  analysisFieldValue: {
    color: "#4A4239",
    fontSize: 14,
    lineHeight: 20
  },
  analysisCodeBlock: {
    color: "#4A4239",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  dismissedToggle: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3EBDE",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  dismissedToggleText: {
    color: "#6B6156",
    fontSize: 12,
    fontWeight: "700"
  },
  suggestionsStateCard: {
    marginBottom: 4,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10
  },
  suggestionsStateCardInfo: {
    borderColor: "#E8DFD2",
    backgroundColor: "#FFFFFF"
  },
  suggestionsStateCardSuccess: {
    borderColor: "#A7CEB9",
    backgroundColor: "#E5F1E9"
  },
  suggestionsStateCardError: {
    borderColor: "#E7B6A8",
    backgroundColor: "#FBECE6"
  },
  suggestionGroup: {
    gap: 10
  },
  suggestionGroupHeader: {
    gap: 4
  },
  suggestionGroupTitle: {
    color: "#4A4239",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  suggestionGroupHint: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 17
  },
  suggestionList: {
    gap: 12,
    marginBottom: 4
  },
  suggestionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    padding: 16,
    gap: 10
  },
  clusterCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    padding: 16,
    gap: 10
  },
  clusterScoreBadge: {
    backgroundColor: "#EDE8FA",
    borderColor: "#6B5BD2"
  },
  clusterScoreText: {
    color: "#6B5BD2"
  },
  clusterBestPhotoRow: {
    gap: 10,
    paddingRight: 12
  },
  clusterBestPhoto: {
    width: 74,
    height: 74,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  clusterBestPhotoImage: {
    width: "100%",
    height: "100%"
  },
  suggestionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  suggestionTitle: {
    flex: 1,
    color: "#241F1B",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  suggestionMessage: {
    color: "#4A4239",
    fontSize: 14,
    lineHeight: 20
  },
  suggestionMeta: {
    color: "#6B6156",
    fontSize: 12,
    fontWeight: "600"
  },
  suggestionLifecycleNote: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 18
  },
  suggestionPreviewRow: {
    gap: 10,
    paddingRight: 12
  },
  suggestionPreviewThumb: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  suggestionStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1
  },
  suggestionStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  suggestionStatusNew: {
    backgroundColor: "#EDE8FA",
    borderColor: "#6B5BD2"
  },
  suggestionStatusNewText: {
    color: "#6B5BD2"
  },
  suggestionStatusWatching: {
    backgroundColor: "#EDE8FA",
    borderColor: "#E8DFD2"
  },
  suggestionStatusWatchingText: {
    color: "#6B5BD2"
  },
  suggestionStatusSnoozed: {
    backgroundColor: "#F7EDD6",
    borderColor: "#E8DFD2"
  },
  suggestionStatusSnoozedText: {
    color: "#805A20"
  },
  suggestionStatusAccepted: {
    backgroundColor: "#E5F1E9",
    borderColor: "#A7CEB9"
  },
  suggestionStatusAcceptedText: {
    color: "#327558"
  },
  suggestionStatusDismissed: {
    backgroundColor: "#FBECE6",
    borderColor: "#E7B6A8"
  },
  suggestionStatusDismissedText: {
    color: "#AD432F"
  },
  finalizationStatusBadge: {
    backgroundColor: "#F3EBDE",
    borderColor: "#E8DFD2"
  },
  finalizationStatusText: {
    color: "#6B5BD2"
  },
  suggestionActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2
  },
  suggestionActionButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  suggestionPrimaryAction: {
    backgroundColor: "#6B5BD2",
    borderColor: "#6B5BD2"
  },
  suggestionPrimaryActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  suggestionSecondaryAction: {
    backgroundColor: "#F3EBDE",
    borderColor: "#E8DFD2"
  },
  suggestionSecondaryActionText: {
    color: "#4A4239",
    fontSize: 13,
    fontWeight: "700"
  },
  suggestionDangerAction: {
    backgroundColor: "#FBECE6",
    borderColor: "#E7B6A8"
  },
  suggestionDangerActionText: {
    color: "#AD432F",
    fontSize: 13,
    fontWeight: "700"
  },
  suggestionActionDisabled: {
    opacity: 0.45
  },
  suggestionsEmptyCard: {
    marginBottom: 6,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10
  },
  themeSuggestionCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FFFFFF",
    gap: 16
  },
  themeSuggestionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  themeSuggestionTextBlock: {
    flex: 1,
    gap: 6
  },
  themeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  themeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F3EBDE",
    borderWidth: 1,
    borderColor: "#E8DFD2"
  },
  themeChipText: {
    color: "#6B5BD2",
    fontSize: 12,
    fontWeight: "800"
  },
  memoryCardShell: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    overflow: "hidden",
    shadowColor: "#241F1B",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  memoryCardShellActive: {
    opacity: 0.92
  },
  memoryCard: {
    padding: 10,
    gap: 12,
  },
  memoryMenuButton: {
    position: "absolute",
    right: 20,
    top: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(251, 246, 238, 0.93)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8DFD2"
  },
  previewPanel: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F3EBDE"
  },
  previewEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderStyle: "dashed"
  },
  previewEmptyText: {
    color: "#6B6156",
    fontSize: 14
  },
  previewSingle: {
    width: "100%",
    height: "100%"
  },
  previewRow: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    padding: 3
  },
  previewHalf: {
    flex: 1,
    height: "100%",
    borderRadius: 14
  },
  previewThirdWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden"
  },
  previewThird: {
    width: "100%",
    height: "100%"
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 10, 20, 0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  previewOverlayText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800"
  },
  memoryBody: {
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 4
  },
  memoryMetaRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  memoryKindBadgeEvent: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F3EBDE",
    borderWidth: 0,
    borderColor: "#E8DFD2"
  },
  memoryKindBadgeEventText: {
    color: "#4A4239",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  memoryKindBadgeCollection: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#EDE8FA",
    borderWidth: 0,
    borderColor: "#E8DFD2"
  },
  memoryKindBadgeCollectionText: {
    color: "#4E3FBC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  memoryName: {
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "700",
    paddingRight: 36,
    letterSpacing: -0.55,
  },
  memorySummary: {
    color: "#6B6156",
    fontSize: 13,
  },
  memoryTagsSummary: {
    color: "#4A4239",
    fontSize: 12,
    lineHeight: 17
  },
  memoryCandidateButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3EBDE",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  memoryCandidateButtonText: {
    color: "#4A4239",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyCard: {
    marginTop: 12,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10
  },
  emptyTitle: {
    color: "#241F1B",
    fontWeight: "700",
    fontSize: 18
  },
  emptyText: {
    color: "#6B6156",
    textAlign: "center"
  },
  addButton: {
    position: "absolute",
    alignSelf: "flex-end",
    width: "auto",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#6B5BD2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#241F1B",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    zIndex: 20,
    right: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 9,
  },
  bottomToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: "#FBF6EE",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8DFD2",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12
  },
  toolbarItem: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  toolbarCenterSpacer: {
    width: 76
  },
  toolbarLabel: {
    color: "#4A4239",
    fontSize: 12,
    fontWeight: "600"
  },
  centerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 31, 27, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22
  },
  actionMenuCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FFFFFF",
    padding: 20,
    gap: 12
  },
  actionMenuButton: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  actionMenuTextBlock: {
    flex: 1,
    gap: 4
  },
  actionMenuButtonText: {
    color: "#4A4239",
    fontSize: 15,
    fontWeight: "800"
  },
  actionMenuHint: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 16
  },
  actionMenuDanger: {
    backgroundColor: "#FBECE6",
    borderColor: "#E7B6A8"
  },
  actionMenuDangerText: {
    color: "#AD432F",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButtonLike: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    paddingHorizontal: 16
  },
  secondaryButtonLikeText: {
    color: "#4A4239",
    fontSize: 14,
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 31, 27, 0.38)",
    justifyContent: "flex-end"
  },
  modalAvoider: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: "#FBF6EE",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: "#E8DFD2",
    paddingHorizontal: 20,
    paddingTop: 18
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14
  },
  modalTitle: {
    color: "#241F1B",
    fontSize: 22,
    fontWeight: "800"
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#6B6156",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  modalContent: {
    paddingBottom: 12,
    gap: 16
  },
  fieldGroup: {
    gap: 10
  },
  fieldLabel: {
    color: "#4A4239",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  fieldHelperText: {
    color: "#6B6156",
    fontSize: 12,
    lineHeight: 17
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    color: "#241F1B",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  choiceChip: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  choiceChipSelected: {
    backgroundColor: "#EDE8FA",
    borderColor: "#6B5BD2"
  },
  choiceChipText: {
    color: "#4A4239",
    fontSize: 14,
    fontWeight: "700"
  },
  choiceChipTextSelected: {
    color: "#241F1B"
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  inlineButton: {
    minWidth: 108,
    borderRadius: 14,
    backgroundColor: "#6B5BD2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inlineButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  thumbnailPreviewCard: {
    height: 190,
    borderRadius: 22,
    backgroundColor: "#F3EBDE",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2"
  },
  thumbnailPreviewImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailPreviewPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  thumbnailPreviewPlaceholderText: {
    color: "#6B6156"
  },
  thumbnailPickerRow: {
    gap: 10,
    paddingRight: 12
  },
  thumbnailOption: {
    width: 92,
    height: 92,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#E8DFD2",
    overflow: "hidden",
    backgroundColor: "#F3EBDE"
  },
  thumbnailOptionSelected: {
    borderColor: "#6B5BD2"
  },
  thumbnailOptionImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailOptionEmpty: {
    alignItems: "center",
    justifyContent: "center"
  },
  collectionCandidateRow: {
    gap: 10,
    paddingRight: 12
  },
  collectionCandidateCard: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  collectionCandidateCardSelected: {
    borderColor: "#6B5BD2",
    borderWidth: 2
  },
  collectionCandidateImage: {
    width: "100%",
    height: "100%"
  },
  collectionCandidateBadge: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 999,
    paddingVertical: 4,
    backgroundColor: "rgba(251, 246, 238, 0.93)",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    alignItems: "center"
  },
  collectionCandidateBadgeSelected: {
    backgroundColor: "rgba(107, 91, 210, 0.95)",
    borderColor: "#6B5BD2"
  },
  collectionCandidateBadgeText: {
    color: "#4A4239",
    fontSize: 11,
    fontWeight: "800"
  },
  collectionCandidateBadgeTextSelected: {
    color: "#ffffff"
  },
  candidateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  candidateGridItem: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  candidateGridItemSelected: {
    borderColor: "#6B5BD2",
    borderWidth: 2
  },
  finalizationGridItem: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  candidateGridImage: {
    width: "100%",
    height: "100%"
  },
  candidateGridCheck: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(251, 246, 238, 0.93)",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    alignItems: "center",
    justifyContent: "center"
  },
  candidateGridCheckSelected: {
    backgroundColor: "#6B5BD2",
    borderColor: "#6B5BD2"
  },
  mediaLibraryProbeBadge: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(107, 91, 210, 0.92)",
    borderWidth: 1,
    borderColor: "#6B5BD2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  mediaLibraryProbeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  thumbTagExisting: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(36, 31, 27, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  thumbTagNew: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(107, 91, 210, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  thumbTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#6B5BD2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryActionDisabled: {
    opacity: 0.5
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  deleteMemoryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E7B6A8",
    backgroundColor: "#FBECE6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  deleteMemoryButtonText: {
    color: "#AD432F",
    fontSize: 14,
    fontWeight: "700"
  }
});
