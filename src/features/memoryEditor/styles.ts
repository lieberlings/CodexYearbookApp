import { StyleSheet } from "react-native";
import { colors } from "../../ui/theme";

export const styles = StyleSheet.create({
  textTapAwaySurface: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  idleToolSpace: { flex: 1, justifyContent: "center", alignItems: "center" },
  toolContentScroll: { flex: 1, minHeight: 0 },
  borderControls: { gap: 14, paddingBottom: 12 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingLabel: { color: "#4A4239", fontSize: 14, fontWeight: "600" },
  formatBar: { flexDirection: "row", alignItems: "center", gap: 7 },
  formatBarScroll: { height: 36, minHeight: 36, flexGrow: 0, flexShrink: 0 },
  formatButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F5EFE4", alignItems: "center", justifyContent: "center" },
  formatButtonSelected: { backgroundColor: colors.brand },
  formatSelectedText: { color: colors.onBrand },
  fontMenuButton: { flexDirection: "row", gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#F5EFE4", alignItems: "center" },
  addLineButton: { flexDirection: "row", gap: 5, alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#C9BCF0" },
  addLineLabel: { fontSize: 12, fontWeight: "700", color: "#4E3FBC" },
  inspectorHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  inspectorTitle: { color: "#241F1B", fontSize: 17, fontWeight: "600", textTransform: "capitalize", letterSpacing: -0.2 },
  screen: {
    flex: 1,
    backgroundColor: "#F4EDE1",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8DFD2"
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTextWrap: {
    flex: 1,
    alignItems: "flex-start",
  },
  topBarTitle: {
    color: "#241F1B",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  topBarSubtitle: {
    marginTop: 4,
    color: "#6B6156",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topBarGhost: {
    width: 40,
    height: 40
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10
  },
  containerWithFloatingActions: {
    paddingBottom: 180
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    padding: 14
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "700",
    color: "#241F1B",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  meta: {
    marginTop: 2,
    color: "#6B6156"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#F3EBDE"
  },
  secondaryActionText: {
    color: "#241F1B",
    fontWeight: "600"
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#6B5BD2",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#E7B6A8",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10
  },
  deleteText: {
    color: "#AD432F",
    fontWeight: "600"
  },
  helpText: {
    color: "#6B6156"
  },
  toolbar: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 12,
    padding: 10,
    gap: 8
  },
  toolbarLabel: {
    color: "#4A4239",
    fontSize: 12
  },
  toolbarButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  toolbarButton: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3EBDE"
  },
  toolbarButtonDanger: {
    borderWidth: 1,
    borderColor: "#E7B6A8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#241F1B"
  },
  pageCard: {
    position: "relative",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
    padding: 0,
    shadowColor: "#241F1B",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0
  },
  activePageCard: {
    alignSelf: "center",
    paddingBottom: 0,
    flex: 1,
    minHeight: 0,
  },
  pageInsertMarker: {
    alignSelf: "center",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#6B5BD2",
    marginVertical: 2
  },
  pageCardDropTarget: {
    borderColor: "#6B5BD2",
    borderWidth: 2,
    backgroundColor: "#EDE8FA"
  },
  pageCardDragging: {
    opacity: 0.45
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  pageHandle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  pageHandleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B6156",
    letterSpacing: 1
  },
  pageHeaderText: {
    flex: 1
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#241F1B"
  },
  pageMeta: {
    marginTop: 2,
    color: "#6B6156",
    fontSize: 12
  },
  pageActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  iconRail: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8
  },
  toolTray: {
    marginTop: 8,
    backgroundColor: "#FBF6EE",
    borderRadius: 20,
    padding: 6,
    flexShrink: 0,
    height: 84,
  },
  toolRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 4,
    justifyContent: "space-between",
    flexGrow: 1,
  },
  textCompactToolbarShell: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FBF6EE",
    overflow: "hidden"
  },
  textCompactToolbarScroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  textCompactToolbar: {
    gap: 12,
    padding: 0,
    paddingBottom: 12,
  },
  textCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  fontDropdown: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
  },
  fontDropdownOption: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center"
  },
  fontDropdownOptionActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  fontDropdownText: {
    color: "#4A4239",
    fontWeight: "600"
  },
  toggleChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  toggleChipActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  toggleChipText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A4239"
  },
  toggleChipItalic: {
    fontStyle: "italic"
  },
  sliderGroup: {
    flex: 1,
    gap: 6
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6156",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  sliderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  sliderButtonText: {
    color: "#4A4239",
    fontWeight: "700"
  },
  alignGroup: {
    flexDirection: "row",
    gap: 6
  },
  alignButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  alignButtonActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  alignButtonText: {
    fontSize: 16,
    color: "#4A4239"
  },
  pageDeleteCornerButton: {
    position: "absolute",
    top: 8,
    right: 6,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E7B6A8",
    backgroundColor: "#FBECE6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30
  },
  iconOrb: {
    width: 54,
    height: 60,
    borderRadius: 13,
    borderWidth: 0,
    borderColor: "#E8DFD2",
    backgroundColor: "#F5EFE4",
    alignItems: "center",
    justifyContent: "center"
  },
  iconOrbActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#6B5BD2",
  },
  iconOrbLabel: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "600",
    color: "#4A4239",
    textAlign: "center",
    maxWidth: 54,
  },
  iconOrbLabelActive: {
    color: "#ffffff"
  },
  inspectorArea: {
    justifyContent: "flex-start",
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#FBF6EE",
    padding: 14,
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
  },
  backgroundInspectorArea: {
    maxHeight: 320
  },
  layoutPickerScroll: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
  },
  layoutPicker: {
    gap: 14,
    paddingBottom: 4
  },
  templateRow: {
    gap: 10,
    paddingRight: 10
  },
  templateChoice: {
    borderWidth: 2,
    borderColor: "#E8DFD2",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 6,
  },
  templateChoiceActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  templateChoiceLabel: {
    paddingHorizontal: 10,
    paddingVertical: 20,
    fontWeight: "700",
    color: "#4A4239"
  },
  templateMiniCard: {
    width: 90,
    height: 90,
    borderRadius: 4,
    backgroundColor: "#F5EFE4",
    position: "relative",
    overflow: "hidden"
  },
  templateMiniCardActive: {
    backgroundColor: "#F5EFE4",
  },
  templateMiniBlock: {
    position: "absolute",
    borderRadius: 0,
    backgroundColor: "#D9D1F6",
  },
  templateMiniHero: {
    backgroundColor: "#6B5BD2"
  },
  textInspector: {
    gap: 12
  },
  textInspectorHelp: {
    color: "#6B6156",
    textAlign: "center"
  },
  addTextButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#6B5BD2"
  },
  controlGroup: {
    gap: 8
  },
  controlGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6156",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  shapeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  shapeChoice: {
    minWidth: 58,
    height: 34,
    borderWidth: 2,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  shapeChoiceActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  shapeChoiceText: {
    color: "#4A4239",
    fontWeight: "700",
    fontSize: 12
  },
  backgroundPicker: {
    gap: 14,
    paddingBottom: 4
  },
  backgroundPickerScroll: {
    maxHeight: undefined,
    flex: 1,
    minHeight: 0,
  },
  backgroundPackRow: {
    gap: 10,
    paddingRight: 10
  },
  backgroundChoice: {
    width: 88,
    gap: 6,
    alignItems: "center"
  },
  backgroundChoicePreview: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E8DFD2",
    backgroundColor: "#ffffff"
  },
  backgroundChoicePreviewActive: {
    borderColor: "#6B5BD2"
  },
  backgroundChoiceLabel: {
    width: "100%",
    textAlign: "center",
    color: "#6B6156",
    fontWeight: "700",
    fontSize: 12
  },
  backgroundChoiceLabelActive: {
    color: "#4E3FBC",
  },
  stepperButtonActive: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  stepperButtonTextActive: {
    color: "#4E3FBC",
  },
  canvasWrap: {
    alignSelf: "center",
    position: "relative",
    borderRadius: 0,
    overflow: "hidden",
    marginBottom: 0,
    flexShrink: 0,
  },
  primaryCanvasWrap: {
    marginTop: 0
  },
  slotFrameWrap: {
    position: "absolute"
  },
  slotFrame: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#F3EBDE"
  },
  slotFrameTextOccupied: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  textBoxWrap: {
    position: "absolute",
    zIndex: 20
  },
  textBoxFrame: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center"
  },
  textBoxFrameAnchored: {
    borderRadius: 0
  },
  textBoxFrameSelected: {
    borderColor: "#6B5BD2",
    borderWidth: 2,
    shadowColor: "#241F1B",
    shadowOpacity: 0.16,
    shadowRadius: 10
  },
  textBoxText: {
    width: "100%"
  },
  textBoxInput: {
    width: "100%",
    height: "100%",
    padding: 0,
    textAlignVertical: "center"
  },
  textBoxHandle: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#6B5BD2",
    backgroundColor: "#ffffff"
  },
  textBoxResizeHandle: {
    position: "absolute",
    right: -10,
    bottom: -10,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#6B5BD2",
    backgroundColor: "#ffffff",
    zIndex: 30
  },
  slotDropTarget: {
    borderColor: "#6B5BD2",
    borderWidth: 5,
    backgroundColor: "rgba(107, 91, 210, 0.2)"
  },
  slotDragging: {
    opacity: 0.32
  },
  slotSelected: {
    shadowColor: "#241F1B",
    shadowOpacity: 0.18,
    shadowRadius: 10
  },
  slotImage: {
    position: "absolute"
  },
  tinyButton: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3EBDE"
  },
  tinyButtonDanger: {
    borderWidth: 1,
    borderColor: "#E7B6A8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  grid: {
    gap: 10
  },
  empty: {
    color: "#6B6156"
  },
  photoCard: {
    width: 156,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 4,
    backgroundColor: "#ffffff"
  },
  photoCardSelected: {
    borderColor: "#6B5BD2",
    backgroundColor: "#E5F1E9"
  },
  photoCardDropTarget: {
    borderColor: "#6B5BD2",
    borderWidth: 2
  },
  photoCardDragging: {
    opacity: 0.25
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#F3EBDE"
  },
  photoMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  photoMeta: {
    fontSize: 12,
    color: "#6B6156"
  },
  primaryBadge: {
    fontSize: 11,
    color: "#327558",
    backgroundColor: "#E5F1E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  thumbStrip: {
    gap: 8,
    paddingRight: 8
  },
  stagingStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
    minHeight: 0,
  },
  stagingStripActive: {
    borderColor: "#6B5BD2",
    borderWidth: 4,
    borderRadius: 18,
    backgroundColor: "rgba(107, 91, 210, 0.14)",
    padding: 6
  },
  stagingBlock: {
    marginTop: 4,
    gap: 12
  },
  blockLabel: {
    marginLeft: 4,
    color: "#6B6156",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  stagingPhotosRow: {
    gap: 12,
    paddingRight: 8,
    alignItems: "center"
  },
  stagingTile: {
    width: 92,
    height: 92,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F3EBDE",
    borderWidth: 1,
    borderColor: "#E8DFD2"
  },
  addPhotoTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EBDE",
    borderStyle: "dashed"
  },
  removePhotoTileActive: {
    borderColor: "#6B5BD2",
    borderWidth: 4,
    backgroundColor: "#EDE8FA"
  },
  addPhotoTileText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4A4239"
  },
  thumbCard: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff"
  },
  thumbCardSelected: {
    borderColor: "#6B5BD2",
    backgroundColor: "#EDE8FA"
  },
  thumbCardDropTarget: {
    borderColor: "#6B5BD2",
    borderWidth: 2
  },
  thumbCardDragging: {
    opacity: 0.25
  },
  gallerySwapTarget: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 5,
    borderColor: "#6B5BD2",
    backgroundColor: "rgba(107, 91, 210, 0.22)"
  },
  thumbImage: {
    width: "100%",
    height: "100%"
  },
  heroDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3F8F6E"
  },
  pageRail: {
    paddingVertical: 0,
    flex: 1,
    minHeight: 0,
  },
  pageRailSection: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8DFD2"
  },
  pageRailList: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
  },
  pageRailRow: {
    alignItems: "flex-end",
    paddingHorizontal: 2
  },
  pageRailSeparator: {
    width: 12
  },
  pageRailFooter: {
    marginLeft: 12
  },
  pageRailItem: {
    width: 96,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  pageRailCard: {
    width: 96,
    minHeight: 120,
    alignItems: "center"
  },
  pageRailCardDragging: {
    opacity: 0.92,
    zIndex: 20
  },
  pageRailAddCard: {
    opacity: 0.95
  },
  pageRailCardActive: {
    transform: [{ translateY: -4 }]
  },
  pageRailPreview: {
    width: 96,
    height: 96,
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE"
  },
  pageRailPreviewSelected: {
    borderColor: "#6B5BD2",
    borderWidth: 3
  },
  pageRailPlaceholderPreview: {
    opacity: 0.28,
    borderStyle: "dashed"
  },
  pageRailAddPreview: {
    borderStyle: "dashed",
    borderColor: "#E8DFD2",
    alignItems: "center",
    justifyContent: "center"
  },
  pageRailPreviewBlock: {
    position: "absolute",
    backgroundColor: "rgba(191, 205, 228, 0.4)",
    borderRadius: 0
  },
  pageRailPreviewPhoto: {
    position: "absolute",
    backgroundColor: "#F3EBDE"
  },
  pageRailAddText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4A4239"
  },
  pageRailLabel: {
    marginTop: 6,
    textAlign: "center",
    color: "#6B6156",
    fontSize: 12,
    fontWeight: "600"
  },
  pageRailLabelActive: {
    color: "#6B5BD2"
  },
  pageRailLabelPlaceholder: {
    opacity: 0
  },
  pageRailInsertMarker: {
    width: 10,
    height: 72,
    borderRadius: 999,
    backgroundColor: "#6B5BD2"
  },
  floatingActionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8
  },
  floatingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  floatingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F3EBDE"
  },
  floatingTitleWrap: {
    flex: 1
  },
  floatingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#241F1B"
  },
  floatingSubtitle: {
    marginTop: 1,
    color: "#6B6156",
    fontSize: 12
  },
  floatingActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  floatingMoveRow: {
    gap: 8,
    paddingRight: 8
  },
  floatingButton: {
    borderWidth: 1,
    borderColor: "#E8DFD2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#F3EBDE"
  },
  floatingButtonText: {
    color: "#241F1B",
    fontWeight: "600"
  },
  floatingDangerButton: {
    borderWidth: 1,
    borderColor: "#E7B6A8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fef2f2"
  },
  floatingDangerText: {
    color: "#AD432F",
    fontWeight: "600"
  },
  dragPreview: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#6B5BD2",
    backgroundColor: "#ffffff",
    opacity: 0.95
  },
  dragPreviewImage: {
    width: "100%",
    height: "100%"
  },
  pageDragPreview: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6B5BD2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pageDragPreviewText: {
    fontWeight: "700",
    color: "#241F1B"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.64)",
    justifyContent: "flex-end"
  },
  deleteBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 31, 27, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  deletePopover: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFD2",
    padding: 18,
    gap: 12,
    alignItems: "center"
  },
  deletePreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: "#F3EBDE"
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#241F1B"
  },
  deleteCopy: {
    color: "#6B6156",
    textAlign: "center"
  },
  deleteActions: {
    flexDirection: "row",
    gap: 10
  },
  modalSheet: {
    backgroundColor: "#FBF6EE",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#E8DFD2",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    alignItems: "center",
    gap: 12
  },
  modalHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  modalIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E8DFD2",
    backgroundColor: "#F3EBDE",
    alignItems: "center",
    justifyContent: "center"
  },
  modalUndoGlyph: {
    fontSize: 24,
    lineHeight: 24,
    color: "#241F1B",
    fontWeight: "700"
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#241F1B",
    textAlign: "center"
  },
  modalDone: {
    color: "#6B5BD2",
    fontWeight: "700"
  },
  modalCanvas: {
    borderRadius: 18,
    position: "relative",
    overflow: "hidden"
  },
  modalDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.18)"
  },
  modalCropImage: {
    position: "absolute"
  },
  modalCropFrame: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#241F1B",
    shadowOpacity: 0.16,
    shadowRadius: 12
  }
});
