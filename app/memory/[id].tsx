import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaLibrarySelectionModal } from "../../src/components/MediaLibrarySelectionModal";
import { useAppData } from "../../src/context/AppContext";
import { DragOverlay } from "../../src/editor/drag/DragOverlay";
import { DragTargetRegistry } from "../../src/editor/drag/dragTargets";
import { useDragInteraction } from "../../src/editor/drag/useDragInteraction";
import { DragPayload, DragResolution, DropTarget, Rect } from "../../src/editor/drag/types";
import { buildLayoutDocument } from "../../src/layout/engine";
import { applySlotOverridesToPage } from "../../src/layout/overrides";
import { clampPhotoOffset, getPhotoAspect, getPhotoRenderMetrics, getPhotoScaleBounds } from "../../src/layout/photoMetrics";
import { listTemplatesForPhotoCount, TemplateDefinition } from "../../src/layout/templates";
import { SlotOverride, useEditorStore } from "../../src/state/editorStore";
import { pickPhotosFromMediaLibraryByAssetIds } from "../../src/services/photoService";
import { MemoryPageSection, PageTextBox, TextBoxAlignment } from "../../src/types";

type InspectorKind = "layout" | "background" | "border" | "text";
type IconKind = "layout" | "text" | "border" | "background";

type PhotoEditorState = {
  pageId: string;
  slotId: string;
};

type TextBoxGestureState = {
  mode?: "move" | "resize";
  textBoxId?: string;
  startPageX: number;
  startPageY: number;
  startBox?: PageTextBox;
};

const COLOR_PALETTE = ["#ffffff", "#fff7ed", "#fef3c7", "#ecfccb", "#e0f2fe", "#ede9fe", "#fce7f3", "#f1f5f9"];
const TEXT_COLORS = ["#0f172a", "#1d4ed8", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#ffffff"];
const BORDER_COLORS = ["#e2e8f0", "#0f172a", "#334155", "#0f766e", "#c2410c", "#b91c1c"];
const FONT_FAMILIES = [
  { id: "System", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "monospace", label: "Mono" }
];
const DRAG_HOLD_MS = 220;

function applyColorOpacity(color: string | undefined, opacity: number | undefined) {
  if (!color) {
    return "transparent";
  }
  const normalizedOpacity = clamp(opacity ?? 1, 0, 1);
  const hex = color.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

function sameSectionOrder(left: MemoryPageSection[], right: MemoryPageSection[]) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]?.id !== right[i]?.id) {
      return false;
    }
  }
  return true;
}

function sectionOrderKey(sections: MemoryPageSection[]) {
  return sections.map((section) => section.id).join("|");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateTextBoxSize(text: string, fontSize: number, canvasSize: number) {
  const lines = (text || "Text").split("\n");
  const longestLineLength = Math.max(...lines.map((line) => line.trim().length), 4);
  const safeCanvasSize = Math.max(canvasSize, 1);
  const widthPx = clamp(longestLineLength * fontSize * 0.56 + 28, fontSize * 3.2, safeCanvasSize * 0.88);
  const heightPx = clamp(lines.length * fontSize * 1.24 + 22, fontSize * 1.9, safeCanvasSize * 0.52);
  return {
    width: clamp(widthPx / safeCanvasSize, 0.18, 0.9),
    height: clamp(heightPx / safeCanvasSize, 0.1, 0.56)
  };
}

function MiniTemplatePreview({ template, active }: { template: TemplateDefinition; active: boolean }) {
  return (
    <View style={[styles.templateMiniCard, active ? styles.templateMiniCardActive : null]}>
      {template.slots.map((slot) => (
        <View
          key={slot.id}
          style={[
            styles.templateMiniBlock,
            slot.role === "hero" ? styles.templateMiniHero : null,
            {
              left: `${slot.frame.x * 100}%`,
              top: `${slot.frame.y * 100}%`,
              width: `${slot.frame.width * 100}%`,
              height: `${slot.frame.height * 100}%`
            }
          ]}
        />
      ))}
    </View>
  );
}

function IconOrb({
  label,
  kind,
  active,
  onPress
}: {
  label: string;
  kind: IconKind;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.iconOrb, active ? styles.iconOrbActive : null]} onPress={onPress}>
      <View style={styles.iconOrbGraphic}>
        {kind === "layout" ? (
          <>
            <View style={[styles.layoutGlyphBlock, { left: 0, top: 0, width: 14, height: 12 }]} />
            <View style={[styles.layoutGlyphBlock, { right: 0, top: 0, width: 10, height: 12 }]} />
            <View style={[styles.layoutGlyphBlock, { left: 0, bottom: 0, width: 10, height: 10 }]} />
            <View style={[styles.layoutGlyphBlock, { right: 0, bottom: 0, width: 14, height: 10 }]} />
          </>
        ) : null}
        {kind === "text" ? (
          <>
            <View style={[styles.textGlyphLine, { width: 26, top: 4 }]} />
            <View style={[styles.textGlyphLine, { width: 20, top: 12 }]} />
            <View style={[styles.textGlyphLine, { width: 24, top: 20 }]} />
          </>
        ) : null}
        {kind === "border" ? (
          <View style={styles.borderGlyphFrame}>
            <View style={styles.borderGlyphInner} />
          </View>
        ) : null}
        {kind === "background" ? (
          <>
            <View style={styles.backgroundGlyphBack} />
            <View style={styles.backgroundGlyphFront} />
          </>
        ) : null}
      </View>
      <Text style={[styles.iconOrbLabel, active ? styles.iconOrbLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

export default function MemoryDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const memoryId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const {
    getProjectById,
    getMemoryById,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    addPhotoAssetsToMemory,
    createPageSection,
    deletePageSection,
    deletePhotos,
    reorderPageSection,
    movePhotoToPage,
    removePhotoFromPage,
    addPageTextBox,
    updatePageTextBox,
    deletePageTextBox,
    setPageSectionTemplate,
    updatePageSectionStyle
  } = useAppData();
  const setDocument = useEditorStore((state) => state.setDocument);
  const selectedPageId = useEditorStore((state) => state.selectedPageId);
  const selectedSlotId = useEditorStore((state) => state.selectedSlotId);
  const slotOverridesByPage = useEditorStore((state) => state.slotOverridesByPage);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setSlotOverride = useEditorStore((state) => state.setSlotOverride);
  const clearSlotOverride = useEditorStore((state) => state.clearSlotOverride);
  const clearPageOverrides = useEditorStore((state) => state.clearPageOverrides);

  const [adding, setAdding] = useState(false);
  const [mediaLibraryPickerVisible, setMediaLibraryPickerVisible] = useState(false);
  const [openInspector, setOpenInspector] = useState<{ pageId: string; kind: InspectorKind } | undefined>(undefined);
  const [photoEditor, setPhotoEditor] = useState<PhotoEditorState | undefined>(undefined);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | undefined>(undefined);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [galleryDeletePhotoId, setGalleryDeletePhotoId] = useState<string | undefined>(undefined);
  const [pageRailDragging, setPageRailDragging] = useState(false);
  const [pageRailData, setPageRailData] = useState<MemoryPageSection[]>([]);
  const [pendingPageRailOrderKey, setPendingPageRailOrderKey] = useState<string | undefined>(undefined);

  const slotRefs = useRef<Record<string, View | null>>({});
  const galleryPhotoRefs = useRef<Record<string, View | null>>({});
  const slotRectsRef = useRef<Record<string, Rect>>({});
  const galleryPhotoRectsRef = useRef<Record<string, Rect>>({});
  const stagingRef = useRef<View | null>(null);
  const pageCanvasRef = useRef<View | null>(null);
  const removePhotoTileRef = useRef<View | null>(null);
  const stagingRectRef = useRef<Rect | undefined>(undefined);
  const pageCanvasRectRef = useRef<Rect | undefined>(undefined);
  const removePhotoTileRectRef = useRef<Rect | undefined>(undefined);
  const suppressNextPressPhotoIdRef = useRef<string | undefined>(undefined);
  const dragTargetRegistryRef = useRef(new DragTargetRegistry());
  const editorGestureRef = useRef<{
    mode?: "pan" | "pinch";
    startScale: number;
    startOffsetX: number;
    startOffsetY: number;
    startDistance: number;
    startX: number;
    startY: number;
  }>({
    startScale: 1,
    startOffsetX: 0,
    startOffsetY: 0,
    startDistance: 0,
    startX: 0,
    startY: 0
  });
  const textInputRef = useRef<TextInput | null>(null);
  const textBoxGestureRef = useRef<TextBoxGestureState>({
    startPageX: 0,
    startPageY: 0
  });

  const memory = getMemoryById(memoryId);
  const photos = useMemo(() => getPhotosByMemoryId(memoryId), [getPhotosByMemoryId, memoryId]);
  const pageSections = useMemo(() => getPageSectionsByMemoryId(memoryId), [getPageSectionsByMemoryId, memoryId]);
  const project = memory ? getProjectById(memory.projectId) : undefined;
  const photosById = useMemo(
    () => Object.fromEntries(photos.map((photo) => [photo.id, photo] as const)),
    [photos]
  );
  const layoutDocument = useMemo(() => {
    if (!memory || !project) {
      return null;
    }
    return buildLayoutDocument(project, [memory], { [memory.id]: photos }, { [memory.id]: pageSections }, "portrait");
  }, [memory, pageSections, photos, project]);
  const renderedPages = useMemo(
    () =>
      (layoutDocument?.pages ?? []).map((page) => ({
        base: page,
        applied: applySlotOverridesToPage(page, slotOverridesByPage[page.id])
      })),
    [layoutDocument?.pages, slotOverridesByPage]
  );
  const renderedPageById = useMemo(
    () => Object.fromEntries(renderedPages.map((entry) => [entry.applied.id, entry.applied] as const)),
    [renderedPages]
  );
  const baseSlotById = useMemo(
    () =>
      Object.fromEntries(
        renderedPages.flatMap((entry) => entry.base.slots.map((slot) => [`${entry.base.id}:${slot.id}`, slot] as const))
      ),
    [renderedPages]
  );
  const appliedSlotById = useMemo(
    () =>
      Object.fromEntries(
        renderedPages.flatMap((entry) => entry.applied.slots.map((slot) => [`${entry.applied.id}:${slot.id}`, slot] as const))
      ),
    [renderedPages]
  );
  const assignedPhotoIds = useMemo(
    () =>
      new Set(
        renderedPages.flatMap((entry) =>
          entry.applied.slots.map((slot) => slot.photoId).filter((photoId): photoId is string => Boolean(photoId))
        )
      ),
    [renderedPages]
  );
  const activePageId = useMemo(
    () => (selectedPageId && renderedPageById[selectedPageId] ? selectedPageId : pageSections[0]?.id),
    [pageSections, renderedPageById, selectedPageId]
  );
  const activeSection = useMemo(
    () => pageSections.find((section) => section.id === activePageId),
    [activePageId, pageSections]
  );
  const activeTextBoxes = useMemo(() => activeSection?.textBoxes ?? [], [activeSection]);
  const activeRenderedPage = activePageId ? renderedPageById[activePageId] : undefined;
  const selectedPage = useMemo(
    () => renderedPages.find((entry) => entry.applied.id === selectedPageId)?.applied,
    [renderedPages, selectedPageId]
  );
  const selectedSlot = useMemo(
    () => selectedPage?.slots.find((slot) => slot.id === selectedSlotId),
    [selectedPage, selectedSlotId]
  );
  const selectedSlotPhoto = selectedSlot?.photoId ? photosById[selectedSlot.photoId] : undefined;
  const selectedTextBox = activeTextBoxes.find((textBox) => textBox.id === selectedTextBoxId);
  const canvasSize = Math.min(width - 64, height * 0.33, 352);
  const pageCardWidth = Math.min(width - 30, 460);
  const editorSize = Math.min(width - 32, height * 0.56);
  const stageButtonSize = 64;
  const stagingPhotos = useMemo(() => photos.filter((photo) => !assignedPhotoIds.has(photo.id)), [assignedPhotoIds, photos]);
  const galleryDeletePhoto = galleryDeletePhotoId ? photosById[galleryDeletePhotoId] : undefined;
  const activePageIndex = useMemo(
    () => (activeSection ? pageSections.findIndex((section) => section.id === activeSection.id) + 1 : 0),
    [activeSection, pageSections]
  );
  const topBarMeta = activePageIndex > 0 ? `PAGE ${activePageIndex} OF ${pageSections.length}` : `${pageSections.length} PAGES`;
  const modalCrop = useMemo(() => {
    if (!selectedSlot) {
      return {
        width: editorSize * 0.82,
        height: editorSize * 0.82,
        left: editorSize * 0.09,
        top: editorSize * 0.09
      };
    }
    const aspect = Math.max(0.2, selectedSlot.frame.width) / Math.max(0.2, selectedSlot.frame.height);
    const maxSize = editorSize * 0.82;
    let width = maxSize;
    let height = width / aspect;
    if (height > maxSize) {
      height = maxSize;
      width = height * aspect;
    }
    return {
      width,
      height,
      left: (editorSize - width) / 2,
      top: (editorSize - height) / 2
    };
  }, [editorSize, selectedSlot]);

  useEffect(() => {
    if (pageRailDragging) {
      return;
    }
    const nextKey = sectionOrderKey(pageSections);
    if (pendingPageRailOrderKey && pendingPageRailOrderKey !== nextKey) {
      return;
    }
    setPageRailData((current) => (sameSectionOrder(current, pageSections) ? current : pageSections));
    if (pendingPageRailOrderKey && pendingPageRailOrderKey === nextKey) {
      setPendingPageRailOrderKey(undefined);
    }
  }, [pageRailDragging, pageSections, pendingPageRailOrderKey]);

  useEffect(() => {
    if (layoutDocument) {
      setDocument(layoutDocument);
    }
  }, [layoutDocument, setDocument]);

  useEffect(() => {
    if (!selectedPageId || !selectedSlotId) {
      return;
    }
    const page = renderedPageById[selectedPageId];
    const exists = page?.slots.some((slot) => slot.id === selectedSlotId);
    if (!exists) {
      setSelection(undefined, undefined);
      setPhotoEditor(undefined);
    }
  }, [renderedPageById, selectedPageId, selectedSlotId, setSelection]);

  useEffect(() => {
    if (!selectedTextBoxId) {
      return;
    }
    if (!activeTextBoxes.some((textBox) => textBox.id === selectedTextBoxId)) {
      setSelectedTextBoxId(undefined);
      setEditingTextBoxId(undefined);
    }
  }, [activeTextBoxes, selectedTextBoxId]);

  useEffect(() => {
    if (activePageId && activePageId !== selectedPageId) {
      setSelection(activePageId, undefined);
    }
  }, [activePageId, selectedPageId, setSelection]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setEditingTextBoxId(undefined);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (editingTextBoxId && textInputRef.current) {
      const timeoutId = setTimeout(() => textInputRef.current?.focus(), 60);
      return () => clearTimeout(timeoutId);
    }
  }, [editingTextBoxId]);

  function onPhotoPress(photoId: string) {
    if (suppressNextPressPhotoIdRef.current === photoId) {
      suppressNextPressPhotoIdRef.current = undefined;
      return;
    }
    setGalleryDeletePhotoId(photoId);
  }

  function confirmDeleteActivePage() {
    if (!activeSection) {
      return;
    }
    Alert.alert("Delete page?", "Choose what to do with the photos on this page.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Keep Photos",
        onPress: () => {
          clearPageOverrides(activeSection.id);
          deletePageSection(activeSection.id, { photoMode: "keep" });
          setSelection(undefined, undefined);
          setPhotoEditor(undefined);
          setOpenInspector(undefined);
        }
      },
      {
        text: "Discard Photos",
        style: "destructive",
        onPress: () => {
          clearPageOverrides(activeSection.id);
          deletePageSection(activeSection.id, { photoMode: "discard" });
          setSelection(undefined, undefined);
          setPhotoEditor(undefined);
          setOpenInspector(undefined);
        }
      }
    ]);
  }

  function handleAddTextBox() {
    if (!activeSection) {
      return;
    }
    const sectionStyle = getSectionStyle(activeSection.id);
    const defaultFontSize = Math.max(18, sectionStyle.textSize);
    const defaultSize = estimateTextBoxSize("", defaultFontSize, canvasSize);
    const createdId = addPageTextBox(activeSection.id, {
      textColor: sectionStyle.textColor,
      fontFamily: sectionStyle.textFontFamily,
      fontWeight: sectionStyle.textWeight,
      fontSize: defaultFontSize,
      fontStyle: "normal",
      fillColor: "#ffffff",
      fillOpacity: 0,
      width: defaultSize.width,
      height: defaultSize.height,
      autoSize: true
    });
    if (!createdId) {
      return;
    }
    setSelectedTextBoxId(createdId);
    setEditingTextBoxId(createdId);
    setOpenInspector({ pageId: activeSection.id, kind: "text" });
  }

  function buildTextBoxUpdates(textBox: PageTextBox, updates: Partial<PageTextBox>): Partial<PageTextBox> {
    const merged = { ...textBox, ...updates };
    if (!merged.autoSize) {
      return updates;
    }
    const nextFontSize = merged.fontSize ?? getSectionStyle(activeSection?.id ?? "").textSize;
    const nextSize = estimateTextBoxSize(merged.text ?? "", nextFontSize, canvasSize);
    return {
      ...updates,
      width: nextSize.width,
      height: nextSize.height,
      x: clamp(merged.x, 0, 1 - nextSize.width),
      y: clamp(merged.y, 0, 1 - nextSize.height)
    };
  }

  function updateTextBox(textBox: PageTextBox, updates: Partial<PageTextBox>) {
    if (!activeSection) {
      return;
    }
    updatePageTextBox(activeSection.id, textBox.id, buildTextBoxUpdates(textBox, updates));
  }

  function updateSelectedTextBox(updates: Partial<PageTextBox>) {
    if (!selectedTextBox) {
      return;
    }
    updateTextBox(selectedTextBox, updates);
  }

  function clearTextBoxSelection() {
    setSelectedTextBoxId(undefined);
    setEditingTextBoxId(undefined);
    if (openInspector?.kind === "text") {
      setOpenInspector(undefined);
    }
  }

  function exitTextMode() {
    Keyboard.dismiss();
    setSelectedTextBoxId(undefined);
    setEditingTextBoxId(undefined);
    if (activeSection) {
      setOpenInspector((prev) => (prev?.pageId === activeSection.id && prev.kind === "text" ? undefined : prev));
    }
  }

  function saveTextEditing() {
    exitTextMode();
  }

  function updateTextBoxFromContentSize(textBox: PageTextBox, widthPx: number, heightPx: number) {
    if (!activeSection || !textBox.autoSize) {
      return;
    }
    const width = clamp((widthPx + 22) / Math.max(canvasSize, 1), 0.18, 0.9);
    const height = clamp((heightPx + 18) / Math.max(canvasSize, 1), 0.1, 0.56);
    const widthChanged = Math.abs((textBox.width ?? 0) - width) > 0.01;
    const heightChanged = Math.abs((textBox.height ?? 0) - height) > 0.01;
    if (!widthChanged && !heightChanged) {
      return;
    }
    updatePageTextBox(activeSection.id, textBox.id, {
      width,
      height,
      x: clamp(textBox.x, 0, 1 - width),
      y: clamp(textBox.y, 0, 1 - height)
    });
  }

  function beginTextBoxGesture(mode: "move" | "resize", textBox: PageTextBox, pageX: number, pageY: number) {
    Keyboard.dismiss();
    textBoxGestureRef.current = {
      mode,
      textBoxId: textBox.id,
      startPageX: pageX,
      startPageY: pageY,
      startBox: textBox
    };
  }

  function updateTextBoxGesture(pageX: number, pageY: number) {
    const gesture = textBoxGestureRef.current;
    if (!activeSection || !gesture.mode || !gesture.textBoxId || !gesture.startBox) {
      return;
    }
    const deltaX = (pageX - gesture.startPageX) / canvasSize;
    const deltaY = (pageY - gesture.startPageY) / canvasSize;
    if (gesture.mode === "move") {
      const nextX = clamp(gesture.startBox.x + deltaX, 0, 1 - gesture.startBox.width);
      const nextY = clamp(gesture.startBox.y + deltaY, 0, 1 - gesture.startBox.height);
      updatePageTextBox(activeSection.id, gesture.textBoxId, { x: nextX, y: nextY });
      return;
    }
    const nextWidth = clamp(gesture.startBox.width + deltaX, 0.14, 1 - gesture.startBox.x);
    const nextHeight = clamp(gesture.startBox.height + deltaY, 0.08, 1 - gesture.startBox.y);
    updatePageTextBox(activeSection.id, gesture.textBoxId, {
      width: nextWidth,
      height: nextHeight,
      autoSize: false
    });
  }

  function endTextBoxGesture() {
    textBoxGestureRef.current = {
      startPageX: 0,
      startPageY: 0
    };
  }

  function getSectionStyle(pageSectionId: string) {
    const section = pageSections.find((item) => item.id === pageSectionId);
    return {
      backgroundColor: section?.backgroundColor ?? "#ffffff",
      slotBorderColor: section?.slotBorderColor ?? "#e2e8f0",
      slotBorderWidth: section?.slotBorderWidth ?? 1,
      slotCornerRadius: section?.slotCornerRadius ?? 10,
      textColor: section?.textColor ?? "#0f172a",
      textSize: section?.textSize ?? 18,
      textWeight: section?.textWeight ?? "700",
      textFontFamily: section?.textFontFamily ?? "System"
    };
  }

  function openSlotEditor(pageId: string, slotId: string) {
    setSelection(pageId, slotId);
    setPhotoEditor({ pageId, slotId });
  }

  function beginEditorGesture(touches: readonly { pageX: number; pageY: number }[]) {
    if (!selectedSlot) {
      return;
    }
    if (touches.length >= 2) {
      const [a, b] = touches;
      editorGestureRef.current = {
        mode: "pinch",
        startScale: selectedSlot.photoScale ?? 1,
        startOffsetX: selectedSlot.photoOffsetX ?? 0,
        startOffsetY: selectedSlot.photoOffsetY ?? 0,
        startDistance: Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY),
        startX: (a.pageX + b.pageX) / 2,
        startY: (a.pageY + b.pageY) / 2
      };
      return;
    }
    const [touch] = touches;
    if (!touch) {
      return;
    }
    editorGestureRef.current = {
      mode: "pan",
      startScale: selectedSlot.photoScale ?? 1,
      startOffsetX: selectedSlot.photoOffsetX ?? 0,
      startOffsetY: selectedSlot.photoOffsetY ?? 0,
      startDistance: 0,
      startX: touch.pageX,
      startY: touch.pageY
    };
  }

  function updateEditorGesture(touches: readonly { pageX: number; pageY: number }[]) {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    const gesture = editorGestureRef.current;
    const slotWidthPx = Math.max(1, modalCrop.width);
    const slotHeightPx = Math.max(1, modalCrop.height);
    const scaleBounds = getPhotoScaleBounds(selectedSlot.fitMode);
    const containerAspect = selectedSlot.frame.width / Math.max(0.0001, selectedSlot.frame.height);
    const imageAspect = getPhotoAspect(selectedSlotPhoto);
    if (touches.length >= 2 && gesture.mode === "pinch") {
      const [a, b] = touches;
      const distance = Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
      const scale = clamp(gesture.startScale * (distance / Math.max(1, gesture.startDistance)), scaleBounds.min, scaleBounds.max);
      setSlotOverride(selectedPageId, selectedSlot.id, {
        photoScale: scale,
        photoOffsetX: clampPhotoOffset("x", gesture.startOffsetX, scale, selectedSlot.fitMode, containerAspect, imageAspect),
        photoOffsetY: clampPhotoOffset("y", gesture.startOffsetY, scale, selectedSlot.fitMode, containerAspect, imageAspect)
      });
      return;
    }
    const [touch] = touches;
    if (!touch || gesture.mode !== "pan") {
      return;
    }
    const deltaX = (touch.pageX - gesture.startX) / slotWidthPx;
    const deltaY = (touch.pageY - gesture.startY) / slotHeightPx;
    setSlotOverride(selectedPageId, selectedSlot.id, {
      photoOffsetX: clampPhotoOffset("x", gesture.startOffsetX + deltaX, selectedSlot.photoScale ?? 1, selectedSlot.fitMode, containerAspect, imageAspect),
      photoOffsetY: clampPhotoOffset("y", gesture.startOffsetY + deltaY, selectedSlot.photoScale ?? 1, selectedSlot.fitMode, containerAspect, imageAspect)
    });
  }

  async function onAddPhotos() {
    if (adding) {
      return;
    }
    setMediaLibraryPickerVisible(true);
  }

  async function onImportMediaLibraryPhotos(assetIds: string[]) {
    try {
      setAdding(true);
      const selected = await pickPhotosFromMediaLibraryByAssetIds(assetIds);
      if (selected.length === 0) {
        setMediaLibraryPickerVisible(false);
        return;
      }
      const createdPhotoIds = await addPhotoAssetsToMemory(memoryId, selected);
      const count = createdPhotoIds.length;
      setMediaLibraryPickerVisible(false);
      if (count > 0) {
        Alert.alert("Photos added", `${count} photo(s) added to this memory.`);
      }
    } catch (error) {
      Alert.alert("Unable to add photos", (error as Error).message);
    } finally {
      setAdding(false);
    }
  }

  function onAddPage() {
    if (!memory) {
      return;
    }
    createPageSection(memory.id);
  }

  async function measureNode(node: View | null): Promise<Rect | undefined> {
    if (!node) {
      return undefined;
    }
    return new Promise((resolve) => {
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          resolve(undefined);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }

  async function primeDropGeometry() {
    const nextSlotRects: Record<string, Rect> = {};
    const nextGalleryPhotoRects: Record<string, Rect> = {};

    const slotEntries = Object.entries(slotRefs.current);
    const slotResults = await Promise.all(slotEntries.map(async ([id, node]) => [id, await measureNode(node)] as const));
    for (const [id, rect] of slotResults) {
      if (rect) {
        nextSlotRects[id] = rect;
      }
    }

    const galleryEntries = Object.entries(galleryPhotoRefs.current);
    const galleryResults = await Promise.all(galleryEntries.map(async ([id, node]) => [id, await measureNode(node)] as const));
    for (const [id, rect] of galleryResults) {
      if (rect) {
        nextGalleryPhotoRects[id] = rect;
      }
    }

    slotRectsRef.current = nextSlotRects;
    galleryPhotoRectsRef.current = nextGalleryPhotoRects;
    stagingRectRef.current = await measureNode(stagingRef.current);
    pageCanvasRectRef.current = await measureNode(pageCanvasRef.current);
    removePhotoTileRectRef.current = await measureNode(removePhotoTileRef.current);
  }

  function setSlotPhotoAssignment(pageId: string, slotId: string, nextPhotoId: string | null) {
    const slotKey = `${pageId}:${slotId}`;
    const basePhotoId = baseSlotById[slotKey]?.photoId ?? null;
    const existing = slotOverridesByPage[pageId]?.[slotId];
    const { photoId: _ignored, ...rest } = (existing ?? {}) as SlotOverride;

    if (nextPhotoId === basePhotoId) {
      clearSlotOverride(pageId, slotId);
      if (Object.keys(rest).length > 0) {
        setSlotOverride(pageId, slotId, rest);
      }
      return;
    }

    setSlotOverride(pageId, slotId, { photoId: nextPhotoId });
  }

  function buildDropTargets() {
    const targets: DropTarget[] = [];

    if (activeRenderedPage) {
      const pageCanvasRect = pageCanvasRectRef.current;
      if (pageCanvasRect) {
        targets.push({
          id: `page-canvas:${activeRenderedPage.id}`,
          targetType: "page-canvas" as const,
          rect: pageCanvasRect,
          priority: 2,
          targetPageId: activeRenderedPage.id,
          hitSlop: 12,
          stickySlop: 20
        });
      }
      activeRenderedPage.slots.forEach((slot) => {
        const slotKey = `${activeRenderedPage.id}:${slot.id}`;
        const rect = slotRectsRef.current[slotKey];
        if (!rect) {
          return;
        }
        if (slot.photoId) {
          targets.push({
            id: `page-photo:${slotKey}`,
            targetType: "page-photo" as const,
            rect,
            priority: 8,
            targetPageId: activeRenderedPage.id,
            targetSlotId: slot.id,
            targetPhotoId: slot.photoId,
            hitSlop: 10,
            stickySlop: 18
          });
        } else {
          targets.push({
            id: `page-slot:${slotKey}`,
            targetType: "page-slot" as const,
            rect,
            priority: 5,
            targetPageId: activeRenderedPage.id,
            targetSlotId: slot.id,
            hitSlop: 10,
            stickySlop: 18
          });
        }
      });
    }

    if (removePhotoTileRectRef.current) {
      targets.push({
        id: "gallery-remove",
        targetType: "gallery-remove" as const,
        rect: removePhotoTileRectRef.current,
        priority: 7,
        hitSlop: 10,
        stickySlop: 18
      });
    }

    if (stagingRectRef.current) {
      targets.push({
        id: "gallery-strip",
        targetType: "gallery-strip" as const,
        rect: stagingRectRef.current,
        priority: 3,
        hitSlop: 8,
        stickySlop: 16
      });
    }

    stagingPhotos.forEach((photo, index) => {
      const rect = galleryPhotoRectsRef.current[photo.id];
      if (!rect) {
        return;
      }
      targets.push({
        id: `gallery-photo:${photo.id}`,
        targetType: "gallery-photo" as const,
        rect,
        priority: 9,
        targetPhotoId: photo.id,
        targetGalleryIndex: index,
        hitSlop: 10,
        stickySlop: 18
      });
    });

    return targets;
  }

  function commitDropAction(resolution: DragResolution) {
    if (resolution.action === "cancel") {
      return;
    }
    if (resolution.action === "swap-page-photo") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      const targetSlot = appliedSlotById[`${resolution.targetPageId}:${resolution.targetSlotId}`];
      if (!sourceSlot?.photoId || !targetSlot?.photoId) {
        return;
      }
      setSlotPhotoAssignment(resolution.sourcePageId, resolution.sourceSlotId, targetSlot.photoId);
      setSlotPhotoAssignment(resolution.targetPageId, resolution.targetSlotId, sourceSlot.photoId);
      return;
    }
    if (resolution.action === "move-page-photo") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      const targetSlot = appliedSlotById[`${resolution.targetPageId}:${resolution.targetSlotId}`];
      if (!sourceSlot?.photoId || targetSlot?.photoId) {
        return;
      }
      setSlotPhotoAssignment(resolution.sourcePageId, resolution.sourceSlotId, null);
      setSlotPhotoAssignment(resolution.targetPageId, resolution.targetSlotId, sourceSlot.photoId);
      return;
    }
    if (resolution.action === "remove-to-gallery") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      if (!sourceSlot?.photoId) {
        return;
      }
      clearPageOverrides(resolution.sourcePageId);
      removePhotoFromPage(sourceSlot.photoId);
      return;
    }
    if (resolution.action === "swap-with-gallery-photo") {
      setSlotPhotoAssignment(resolution.sourcePageId, resolution.sourceSlotId, resolution.targetPhotoId);
      return;
    }
    if (resolution.action === "add-to-page") {
      clearPageOverrides(resolution.targetPageId);
      movePhotoToPage(resolution.photoId, resolution.targetPageId);
      return;
    }
    if (resolution.action === "swap-with-page-photo") {
      setSlotPhotoAssignment(resolution.targetPageId, resolution.targetSlotId, resolution.photoId);
      return;
    }
    if (resolution.action === "reorder-page") {
      const adjustedIndex = resolution.toIndex > resolution.fromIndex ? resolution.toIndex - 1 : resolution.toIndex;
      if (adjustedIndex !== resolution.fromIndex) {
        reorderPageSection(memoryId, resolution.pageId, adjustedIndex);
      }
    }
  }

  const drag = useDragInteraction({
    getTargets: () => dragTargetRegistryRef.current.getAll(),
    onCommit: (resolution) => {
      commitDropAction(resolution);
      setTimeout(() => {
        suppressNextPressPhotoIdRef.current = undefined;
      }, 80);
    }
  });

  const hoveredTarget = drag.session.hoveredTarget;

  useEffect(() => {
    if (drag.session.lifecycle !== "idle" || !suppressNextPressPhotoIdRef.current) {
      return;
    }
    const timeoutId = setTimeout(() => {
      suppressNextPressPhotoIdRef.current = undefined;
    }, 120);
    return () => clearTimeout(timeoutId);
  }, [drag.session.lifecycle]);

  async function startPhotoDrag(
    photoId: string,
    previewUri: string,
    startPoint: { x: number; y: number },
    sourcePageId?: string,
    sourceSlotId?: string,
    sourceGalleryIndex?: number
  ) {
    suppressNextPressPhotoIdRef.current = photoId;
    await primeDropGeometry();
    dragTargetRegistryRef.current.replace(buildDropTargets());
    const sourceRect = sourceSlotId
      ? slotRectsRef.current[`${sourcePageId}:${sourceSlotId}`]
      : galleryPhotoRectsRef.current[photoId];
    if (!sourceRect) {
      suppressNextPressPhotoIdRef.current = undefined;
      return;
    }
    const payload: DragPayload = {
      dragType: sourceSlotId ? "page-photo" : "gallery-photo",
      itemId: photoId,
      sourcePageId,
      sourceSlotId,
      sourceGalleryIndex,
      sourceRect,
      previewData: {
        kind: "photo",
        uri: previewUri
      }
    };
    drag.beginDrag(payload, startPoint);
  }

  function createLongPressDragHandlers({
    onTap,
    onBeginDrag
  }: {
    onTap: () => void;
    onBeginDrag: (point: { x: number; y: number }) => Promise<void> | void;
  }) {
    let longPressed = false;

    return {
      delayLongPress: DRAG_HOLD_MS,
      pressRetentionOffset: { top: 999, left: 999, right: 999, bottom: 999 },
      onPress: () => {
        if (longPressed) {
          longPressed = false;
          return;
        }
        onTap();
      },
      onLongPress: async (event: { nativeEvent: { pageX: number; pageY: number } }) => {
        longPressed = true;
        await onBeginDrag({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY
        });
      },
      onTouchMove: (event: { nativeEvent: { touches: readonly { pageX: number; pageY: number }[] } }) => {
        const touch = event.nativeEvent.touches[0];
        if (!touch || drag.session.lifecycle !== "dragging") {
          return;
        }
        drag.updateDrag({
          x: touch.pageX,
          y: touch.pageY
        });
      },
      onPressOut: () => {
        if (drag.session.lifecycle === "dragging") {
          drag.endDrag();
        }
        longPressed = false;
      },
      onTouchCancel: () => {
        if (drag.session.lifecycle === "dragging") {
          drag.cancelDrag();
        }
        longPressed = false;
      }
    };
  }

  if (!memory) {
    return (
      <View style={styles.centered}>
        <Text>Memory not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topBarButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={30} color="#f8fbff" />
        </Pressable>
        <View style={styles.topBarTextWrap}>
          <Text numberOfLines={1} style={styles.topBarTitle}>
            {memory.title}
          </Text>
          <Text style={styles.topBarSubtitle}>{topBarMeta}</Text>
        </View>
        <View style={styles.topBarGhost} />
      </View>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
        {activeSection && activeRenderedPage ? (() => {
          const section = activeSection;
          const renderedPage = activeRenderedPage;
          const pageStyle = getSectionStyle(section.id);
          const inspectorOpen = openInspector?.pageId === section.id ? openInspector.kind : undefined;
          const textModeActive = inspectorOpen === "text";
          const templates = listTemplatesForPhotoCount(section.photoIds.length);
          return (
            <View
              style={[
                styles.pageCard,
                styles.activePageCard,
                { width: pageCardWidth },
                hoveredTarget?.targetPageId === section.id &&
                (hoveredTarget.targetType === "page-slot" || hoveredTarget.targetType === "page-canvas")
                  ? styles.pageCardDropTarget
                  : null
              ]}
            >
              {!selectedTextBox ? (
                <Pressable
                  style={styles.pageDeleteCornerButton}
                  onPress={confirmDeleteActivePage}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Delete page"
                >
                  <Ionicons name="trash-outline" size={20} color="#ff9cad" />
                </Pressable>
              ) : null}
              <View
                ref={pageCanvasRef}
                collapsable={false}
                style={[styles.canvasWrap, styles.primaryCanvasWrap, { width: canvasSize, height: canvasSize, backgroundColor: pageStyle.backgroundColor }]}
                onStartShouldSetResponder={() => Boolean(textModeActive && selectedTextBoxId)}
                onResponderRelease={() => {
                  if (textModeActive && selectedTextBoxId) {
                    Keyboard.dismiss();
                    setEditingTextBoxId(undefined);
                    setSelectedTextBoxId(undefined);
                  }
                }}
              >
                {renderedPage.slots.map((slot) => {
                  const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                  const isSelected = selectedPageId === renderedPage.id && selectedSlotId === slot.id;
                  const photoMetrics = getPhotoRenderMetrics({
                    containerAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
                    imageAspect: getPhotoAspect(photo),
                    fitMode: slot.fitMode,
                    scale: slot.photoScale ?? 1,
                    offsetX: slot.photoOffsetX ?? 0,
                    offsetY: slot.photoOffsetY ?? 0
                  });
                  const slotRefKey = `${renderedPage.id}:${slot.id}`;
                  const slotPanHandlers = !textModeActive && photo
                    ? createLongPressDragHandlers({
                        onTap: () => {
                          if (suppressNextPressPhotoIdRef.current === photo.id) {
                            suppressNextPressPhotoIdRef.current = undefined;
                            return;
                          }
                          openSlotEditor(renderedPage.id, slot.id);
                        },
                        onBeginDrag: (point) => startPhotoDrag(photo.id, photo.uri, point, section.id, slot.id)
                      })
                    : undefined;
                  const slotPressHandlers = !textModeActive && photo
                    ? slotPanHandlers
                    : !textModeActive
                    ? {
                        onPress: () => openSlotEditor(renderedPage.id, slot.id)
                      }
                    : undefined;
                  return (
                    <View
                      key={slot.id}
                      ref={(node) => {
                        slotRefs.current[slotRefKey] = node;
                      }}
                      collapsable={false}
                      style={[
                        styles.slotFrameWrap,
                        {
                          left: `${slot.frame.x * 100}%`,
                          top: `${slot.frame.y * 100}%`,
                          width: `${slot.frame.width * 100}%`,
                          height: `${slot.frame.height * 100}%`
                        }
                      ]}
                    >
                      <Pressable
                        {...(slotPressHandlers ?? {})}
                        style={[
                          styles.slotFrame,
                          isSelected ? styles.slotSelected : null,
                          hoveredTarget?.targetPageId === renderedPage.id && hoveredTarget.targetSlotId === slot.id ? styles.slotDropTarget : null,
                          drag.session.payload?.dragType === "page-photo" && drag.session.payload.itemId === photo?.id ? styles.slotDragging : null,
                          {
                            borderColor: pageStyle.slotBorderColor,
                            borderWidth: pageStyle.slotBorderWidth,
                            borderRadius: pageStyle.slotCornerRadius
                          }
                        ]}
                      >
                        {photo ? (
                          <Image
                            source={{ uri: photo.uri }}
                            style={[
                              styles.slotImage,
                              {
                                width: `${photoMetrics.width * 100}%`,
                                height: `${photoMetrics.height * 100}%`,
                                left: `${photoMetrics.leftPercent}%`,
                                top: `${photoMetrics.topPercent}%`
                              }
                            ]}
                            resizeMode="stretch"
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
                {activeTextBoxes.map((textBox) => {
                  const isSelectedTextBox = textBox.id === selectedTextBoxId;
                  const isEditingTextBox = textBox.id === editingTextBoxId;
                  return (
                    <View
                      key={textBox.id}
                      style={[
                        styles.textBoxWrap,
                        {
                          left: `${textBox.x * 100}%`,
                          top: `${textBox.y * 100}%`,
                          width: `${textBox.width * 100}%`,
                          height: `${textBox.height * 100}%`
                        }
                      ]}
                      pointerEvents={textModeActive ? "box-none" : "none"}
                    >
                      <Pressable
                        disabled={!textModeActive}
                        style={[
                          styles.textBoxFrame,
                          isSelectedTextBox ? styles.textBoxFrameSelected : null,
                          {
                            borderWidth: textBox.borderWidth ?? 0,
                            borderColor: textBox.borderColor ?? "#0f172a",
                            backgroundColor: applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)
                          }
                        ]}
                        onPress={() => {
                          if (!textModeActive || textBoxGestureRef.current.mode) {
                            return;
                          }
                          setSelectedTextBoxId(textBox.id);
                          setOpenInspector({ pageId: section.id, kind: "text" });
                        }}
                        onLongPress={(event) => {
                          if (!textModeActive || keyboardVisible) {
                            return;
                          }
                          setSelectedTextBoxId(textBox.id);
                          setOpenInspector({ pageId: section.id, kind: "text" });
                          beginTextBoxGesture("move", textBox, event.nativeEvent.pageX, event.nativeEvent.pageY);
                        }}
                        delayLongPress={180}
                        onTouchMove={(event) => {
                          if (!textModeActive || keyboardVisible || textBoxGestureRef.current.mode !== "move") {
                            return;
                          }
                          const touch = event.nativeEvent.touches[0];
                          if (touch) {
                            updateTextBoxGesture(touch.pageX, touch.pageY);
                          }
                        }}
                        onTouchEnd={endTextBoxGesture}
                        onTouchCancel={endTextBoxGesture}
                      >
                        {isEditingTextBox ? (
                          <TextInput
                            ref={textInputRef}
                            value={textBox.text}
                            onChangeText={(text) => updateTextBox(textBox, { text })}
                            onContentSizeChange={(event) =>
                              updateTextBoxFromContentSize(
                                textBox,
                                event.nativeEvent.contentSize.width,
                                event.nativeEvent.contentSize.height
                              )
                            }
                            placeholder="Enter text"
                            multiline
                            blurOnSubmit
                            style={[
                              styles.textBoxInput,
                              {
                                color: textBox.textColor ?? pageStyle.textColor,
                                fontSize: textBox.fontSize ?? pageStyle.textSize,
                                fontFamily: textBox.fontFamily ?? pageStyle.textFontFamily,
                                fontWeight: (textBox.fontWeight as "400" | "500" | "600" | "700") ?? "700",
                                fontStyle: (textBox.fontStyle as "normal" | "italic") ?? "normal",
                                textAlign: (textBox.textAlign ?? "center") as "left" | "center" | "right"
                              }
                            ]}
                            onBlur={() => setEditingTextBoxId(undefined)}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.textBoxText,
                              {
                                color: textBox.textColor ?? pageStyle.textColor,
                                fontSize: textBox.fontSize ?? pageStyle.textSize,
                                fontFamily: textBox.fontFamily ?? pageStyle.textFontFamily,
                                fontWeight: (textBox.fontWeight as "400" | "500" | "600" | "700") ?? "700",
                                fontStyle: (textBox.fontStyle as "normal" | "italic") ?? "normal",
                                textAlign: (textBox.textAlign ?? "center") as "left" | "center" | "right"
                              }
                            ]}
                          >
                            {textBox.text || "Tap to edit"}
                          </Text>
                        )}
                        {isSelectedTextBox && !isEditingTextBox ? (
                          <>
                            <View style={styles.textBoxHandle} />
                            <Pressable
                              style={styles.textBoxResizeHandle}
                              hitSlop={16}
                              onTouchStart={(event) => beginTextBoxGesture("resize", textBox, event.nativeEvent.pageX, event.nativeEvent.pageY)}
                              onTouchMove={(event) => {
                                const touch = event.nativeEvent.touches[0];
                                if (touch) {
                                  updateTextBoxGesture(touch.pageX, touch.pageY);
                                }
                              }}
                              onTouchEnd={endTextBoxGesture}
                              onTouchCancel={endTextBoxGesture}
                            />
                          </>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {selectedTextBox ? (
                <View
                  style={[
                    styles.textCompactToolbarShell,
                    { maxHeight: Math.min(Math.max(height * 0.24, 196), 288) }
                  ]}
                >
                  <ScrollView
                    style={styles.textCompactToolbarScroll}
                    contentContainerStyle={styles.textCompactToolbar}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    <View style={styles.textCompactRow}>
                      <View style={styles.fontDropdown}>
                        {FONT_FAMILIES.map((fontFamily) => (
                          <Pressable
                            key={fontFamily.id}
                            style={[styles.fontDropdownOption, selectedTextBox.fontFamily === fontFamily.id ? styles.fontDropdownOptionActive : null]}
                            onPress={() => updateSelectedTextBox({ fontFamily: fontFamily.id })}
                          >
                            <Text style={[styles.fontDropdownText, { fontFamily: fontFamily.id === "System" ? undefined : fontFamily.id }]}>{fontFamily.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        style={[styles.toggleChip, selectedTextBox.fontWeight === "700" ? styles.toggleChipActive : null]}
                        onPress={() => updateSelectedTextBox({ fontWeight: selectedTextBox.fontWeight === "700" ? "400" : "700" })}
                      >
                        <Text style={styles.toggleChipText}>B</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.toggleChip, selectedTextBox.fontStyle === "italic" ? styles.toggleChipActive : null]}
                        onPress={() => updateSelectedTextBox({ fontStyle: selectedTextBox.fontStyle === "italic" ? "normal" : "italic" })}
                      >
                        <Text style={[styles.toggleChipText, styles.toggleChipItalic]}>I</Text>
                      </Pressable>
                    </View>

                  <View style={styles.textCompactRow}>
                    <View style={styles.sliderGroup}>
                      <Text style={styles.sliderLabel}>Size</Text>
                      <View style={styles.sliderButtons}>
                        <Pressable
                          style={styles.sliderButton}
                          onPress={() => updateSelectedTextBox({ fontSize: clamp((selectedTextBox.fontSize ?? 26) - 2, 10, 72) })}
                        >
                          <Text style={styles.sliderButtonText}>-</Text>
                        </Pressable>
                        <Text style={styles.metricText}>{selectedTextBox.fontSize ?? 26}</Text>
                        <Pressable
                          style={styles.sliderButton}
                          onPress={() => updateSelectedTextBox({ fontSize: clamp((selectedTextBox.fontSize ?? 26) + 2, 10, 72) })}
                        >
                          <Text style={styles.sliderButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.alignGroup}>
                      {(["left", "center", "right"] as TextBoxAlignment[]).map((alignment) => (
                        <Pressable
                          key={alignment}
                          style={[styles.alignButton, selectedTextBox.textAlign === alignment ? styles.alignButtonActive : null]}
                          onPress={() => updateSelectedTextBox({ textAlign: alignment })}
                        >
                          <Text style={styles.alignButtonText}>{alignment === "left" ? "L" : alignment === "center" ? "C" : "R"}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.controlGroup}>
                    <Text style={styles.controlGroupLabel}>Text</Text>
                    <View style={styles.paletteRow}>
                      {TEXT_COLORS.map((color) => (
                        <Pressable
                          key={color}
                          style={[styles.colorSwatch, { backgroundColor: color }, selectedTextBox.textColor === color ? styles.colorSwatchActive : null]}
                          onPress={() => updateSelectedTextBox({ textColor: color })}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.controlGroup}>
                    <Text style={styles.controlGroupLabel}>Border</Text>
                    <View style={styles.controlRow}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateSelectedTextBox({ borderWidth: clamp((selectedTextBox.borderWidth ?? 0) - 1, 0, 12) })}
                      >
                        <Text style={styles.stepperButtonText}>- Width</Text>
                      </Pressable>
                      <Text style={styles.metricText}>{selectedTextBox.borderWidth ?? 0}</Text>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateSelectedTextBox({ borderWidth: clamp((selectedTextBox.borderWidth ?? 0) + 1, 0, 12) })}
                      >
                        <Text style={styles.stepperButtonText}>+ Width</Text>
                      </Pressable>
                    </View>
                    <View style={styles.paletteRow}>
                      {BORDER_COLORS.map((color) => (
                        <Pressable
                          key={color}
                          style={[styles.colorSwatch, { backgroundColor: color }, selectedTextBox.borderColor === color ? styles.colorSwatchActive : null]}
                          onPress={() => updateSelectedTextBox({ borderColor: color })}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.controlGroup}>
                    <Text style={styles.controlGroupLabel}>Fill</Text>
                    <View style={styles.paletteRow}>
                      {COLOR_PALETTE.map((color) => (
                        <Pressable
                          key={color}
                          style={[styles.colorSwatch, { backgroundColor: color }, selectedTextBox.fillColor === color ? styles.colorSwatchActive : null]}
                          onPress={() => updateSelectedTextBox({ fillColor: color })}
                        />
                      ))}
                    </View>
                    <View style={styles.controlRow}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateSelectedTextBox({ fillOpacity: clamp((selectedTextBox.fillOpacity ?? 0) - 0.1, 0, 1) })}
                      >
                        <Text style={styles.stepperButtonText}>- Opacity</Text>
                      </Pressable>
                      <Text style={styles.metricText}>{Math.round((selectedTextBox.fillOpacity ?? 0) * 100)}%</Text>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateSelectedTextBox({ fillOpacity: clamp((selectedTextBox.fillOpacity ?? 0) + 0.1, 0, 1) })}
                      >
                        <Text style={styles.stepperButtonText}>+ Opacity</Text>
                      </Pressable>
                    </View>
                  </View>

                    <View style={styles.controlRow}>
                      <Pressable style={styles.stepperButton} onPress={() => setEditingTextBoxId(selectedTextBox.id)}>
                        <Text style={styles.stepperButtonText}>{editingTextBoxId ? "Editing..." : "Edit Text"}</Text>
                      </Pressable>
                      <Pressable style={[styles.stepperButton, styles.stepperButtonActive]} onPress={saveTextEditing}>
                        <Text style={[styles.stepperButtonText, styles.stepperButtonTextActive]}>Save Text</Text>
                      </Pressable>
                      <Pressable
                        style={styles.tinyButtonDanger}
                        onPress={() => {
                          deletePageTextBox(section.id, selectedTextBox.id);
                          clearTextBoxSelection();
                        }}
                      >
                        <Text style={styles.deleteText}>Delete Text</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.composerBar}>
                  <IconOrb
                    label="LAYOUT"
                    kind="layout"
                    active={inspectorOpen === "layout"}
                    onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "layout" ? undefined : { pageId: section.id, kind: "layout" }))}
                  />
                  <IconOrb
                    label="TEXT"
                    kind="text"
                    active={inspectorOpen === "text"}
                    onPress={() => {
                      if (inspectorOpen === "text") {
                        exitTextMode();
                        return;
                      }
                      setOpenInspector({ pageId: section.id, kind: "text" });
                      setSelectedTextBoxId(undefined);
                      setEditingTextBoxId(undefined);
                    }}
                  />
                  <IconOrb
                    label="BORDERS"
                    kind="border"
                    active={inspectorOpen === "border"}
                    onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "border" ? undefined : { pageId: section.id, kind: "border" }))}
                  />
                  <IconOrb
                    label="BACKGROUND"
                    kind="background"
                    active={inspectorOpen === "background"}
                    onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "background" ? undefined : { pageId: section.id, kind: "background" }))}
                  />
                </View>
              )}

              {inspectorOpen ? (
                <View style={styles.inspectorArea}>
                  {inspectorOpen === "layout" ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
                    <Pressable
                      style={[styles.templateChoice, !section.templateId ? styles.templateChoiceActive : null]}
                      onPress={() => setPageSectionTemplate(section.id, undefined)}
                    >
                      <Text style={styles.templateChoiceLabel}>Auto</Text>
                    </Pressable>
                    {templates.map((template) => {
                      const active = section.templateId === template.id;
                      return (
                        <Pressable
                          key={template.id}
                          style={[styles.templateChoice, active ? styles.templateChoiceActive : null]}
                          onPress={() => setPageSectionTemplate(section.id, template.id)}
                        >
                          <MiniTemplatePreview template={template} active={active} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  ) : null}

                  {inspectorOpen === "background" ? (
                    <View style={styles.paletteRow}>
                      {COLOR_PALETTE.map((color) => (
                        <Pressable
                          key={color}
                          style={[styles.colorSwatch, { backgroundColor: color }, section.backgroundColor === color ? styles.colorSwatchActive : null]}
                          onPress={() => updatePageSectionStyle(section.id, { backgroundColor: color })}
                        />
                      ))}
                    </View>
                  ) : null}

                  {inspectorOpen === "border" ? (
                    <View style={styles.controlRow}>
                      {BORDER_COLORS.map((color) => (
                        <Pressable
                          key={color}
                          style={[styles.colorSwatch, { backgroundColor: color }, pageStyle.slotBorderColor === color ? styles.colorSwatchActive : null]}
                          onPress={() => updatePageSectionStyle(section.id, { slotBorderColor: color })}
                        />
                      ))}
                      <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotBorderWidth: clamp((section.slotBorderWidth ?? 1) - 1, 0, 12) })}>
                        <Text style={styles.stepperButtonText}>- Border</Text>
                      </Pressable>
                      <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotBorderWidth: clamp((section.slotBorderWidth ?? 1) + 1, 0, 12) })}>
                        <Text style={styles.stepperButtonText}>+ Border</Text>
                      </Pressable>
                      <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotCornerRadius: clamp((section.slotCornerRadius ?? 10) - 2, 0, 28) })}>
                        <Text style={styles.stepperButtonText}>- Corner</Text>
                      </Pressable>
                      <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotCornerRadius: clamp((section.slotCornerRadius ?? 10) + 2, 0, 28) })}>
                        <Text style={styles.stepperButtonText}>+ Corner</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {inspectorOpen === "text" && !selectedTextBox ? (
                    <View style={styles.textInspector}>
                      <Pressable style={styles.addTextButton} onPress={handleAddTextBox}>
                        <Text style={styles.addTextButtonText}>Add Text</Text>
                      </Pressable>
                      <Text style={styles.textInspectorHelp}>Add a text box or tap one on the page to edit it.</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })() : (
          <Text style={styles.empty}>No page selected.</Text>
        )}

        <View style={styles.stagingBlock}>
          <Text style={styles.blockLabel}>Extra Photos</Text>
          <View
            ref={stagingRef}
            collapsable={false}
            style={[
              styles.stagingStrip,
              hoveredTarget?.targetType === "gallery-strip" ? styles.stagingStripActive : null
            ]}
          >
          <Pressable
            ref={removePhotoTileRef}
            collapsable={false}
            style={[
              styles.stagingTile,
              styles.addPhotoTile,
              hoveredTarget?.targetType === "gallery-remove" ? styles.removePhotoTileActive : null,
              { width: stageButtonSize, height: stageButtonSize }
            ]}
            onPress={onAddPhotos}
          >
            {adding ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.addPhotoTileText}>+</Text>}
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={drag.session.lifecycle !== "dragging"}
            contentContainerStyle={styles.stagingPhotosRow}
          >
            {stagingPhotos.map((photo) => {
              const isDragging = drag.session.payload?.dragType === "gallery-photo" && drag.session.payload.itemId === photo.id;
              const galleryPanHandlers = createLongPressDragHandlers({
                onTap: () => onPhotoPress(photo.id),
                onBeginDrag: (point) => startPhotoDrag(photo.id, photo.uri, point)
              });
              return (
                <Pressable
                  key={photo.id}
                  ref={(node) => {
                    galleryPhotoRefs.current[photo.id] = node;
                  }}
                  collapsable={false}
                  {...galleryPanHandlers}
                  style={[styles.stagingTile, galleryDeletePhotoId === photo.id ? styles.thumbCardSelected : null, isDragging ? styles.thumbCardDragging : null]}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
                  {hoveredTarget?.targetType === "gallery-photo" && hoveredTarget.targetPhotoId === photo.id ? (
                    <View pointerEvents="none" style={styles.gallerySwapTarget} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          </View>
        </View>

        <View style={[styles.pageRailSection, { paddingBottom: Math.max(insets.bottom + 64, 84) }]}>
          <View style={styles.pageRail}>
          {/* Page reorder is owned by DraggableFlatList. Other editor drags still use the custom drag controller. */}
          <DraggableFlatList
            data={pageRailData}
            horizontal
            activationDistance={8}
            autoscrollSpeed={220}
            dragItemOverflow={false}
            animationConfig={{
              damping: 26,
              mass: 0.22,
              stiffness: 240,
              overshootClamping: true
            }}
            containerStyle={styles.pageRailList}
            contentContainerStyle={styles.pageRailRow}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.pageRailSeparator} />}
            ListFooterComponentStyle={styles.pageRailFooter}
            onDragBegin={() => {
              setPageRailDragging(true);
            }}
            onRelease={() => {
              setPageRailDragging(false);
            }}
            onDragEnd={({ from, to, data }) => {
              setPageRailData(data);
              setPageRailDragging(false);
              if (from === to) {
                setPendingPageRailOrderKey(undefined);
                return;
              }
              const movedSection = data[to];
              if (!movedSection) {
                setPendingPageRailOrderKey(undefined);
                return;
              }
              setPendingPageRailOrderKey(sectionOrderKey(data));
              reorderPageSection(memoryId, movedSection.id, to);
            }}
            renderPlaceholder={({ item }) => (
              <View style={styles.pageRailItem}>
                <View style={styles.pageRailCard}>
                  <View
                    style={[
                      styles.pageRailPreview,
                      styles.pageRailPlaceholderPreview,
                      { backgroundColor: getSectionStyle(item.id).backgroundColor }
                    ]}
                  />
                  <Text style={[styles.pageRailLabel, styles.pageRailLabelPlaceholder]}>Page</Text>
                </View>
              </View>
            )}
            renderItem={({ item, drag: beginPageReorder, isActive, getIndex }) => {
              const renderedPage = renderedPageById[item.id];
              const isSelected = item.id === activePageId;
              const index = getIndex() ?? pageRailData.findIndex((section) => section.id === item.id);
              return (
                <View style={styles.pageRailItem}>
                  <Pressable
                    collapsable={false}
                    delayLongPress={DRAG_HOLD_MS}
                    onPress={() => {
                      setSelection(item.id, undefined);
                      setPhotoEditor(undefined);
                    }}
                    onLongPress={beginPageReorder}
                    style={[
                      styles.pageRailCard,
                      isSelected && !pageRailDragging ? styles.pageRailCardActive : null,
                      isActive ? styles.pageRailCardDragging : null
                    ]}
                  >
                    <View
                      style={[
                        styles.pageRailPreview,
                        isSelected ? styles.pageRailPreviewSelected : null,
                        { backgroundColor: getSectionStyle(item.id).backgroundColor }
                      ]}
                    >
                      {renderedPage?.slots.slice(0, 4).map((slot) => (
                        <View
                          key={slot.id}
                          style={[
                            styles.pageRailPreviewBlock,
                            {
                              left: `${slot.frame.x * 100}%`,
                              top: `${slot.frame.y * 100}%`,
                              width: `${slot.frame.width * 100}%`,
                              height: `${slot.frame.height * 100}%`
                            }
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.pageRailLabel, isSelected ? styles.pageRailLabelActive : null]}>
                      Page {(index >= 0 ? index : 0) + 1}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.pageRailItem}>
                <Pressable style={[styles.pageRailCard, styles.pageRailAddCard]} onPress={onAddPage}>
                  <View style={[styles.pageRailPreview, styles.pageRailAddPreview]}>
                    <Text style={styles.pageRailAddText}>+</Text>
                  </View>
                  <Text style={styles.pageRailLabel}>Add Page</Text>
                </Pressable>
              </View>
            }
          />
          </View>
        </View>

        {photos.length === 0 ? (
          <Text style={styles.empty}>No photos in this memory yet. Use Add Photos to begin.</Text>
        ) : null}
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <DragOverlay session={drag.session} style={drag.overlayStyle} />
      </View>

      <Modal
        visible={Boolean(galleryDeletePhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryDeletePhotoId(undefined)}
      >
        <Pressable style={styles.deleteBackdrop} onPress={() => setGalleryDeletePhotoId(undefined)}>
          <Pressable style={styles.deletePopover} onPress={() => undefined}>
            {galleryDeletePhoto ? <Image source={{ uri: galleryDeletePhoto.uri }} style={styles.deletePreview} /> : null}
            <Text style={styles.deleteTitle}>Delete photo?</Text>
            <Text style={styles.deleteCopy}>This removes it from the memory entirely.</Text>
            <View style={styles.deleteActions}>
              <Pressable style={styles.deleteCancelButton} onPress={() => setGalleryDeletePhotoId(undefined)}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.deleteConfirmButton}
                onPress={() => {
                  if (galleryDeletePhotoId) {
                    deletePhotos([galleryDeletePhotoId]);
                  }
                  setGalleryDeletePhotoId(undefined);
                }}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <MediaLibrarySelectionModal
        visible={mediaLibraryPickerVisible}
        title="Add Memory Photos"
        subtitle="Choose photos directly from Media Library so this memory keeps canonical asset ids and richer GPS/EXIF metadata."
        confirmLabel="Add to Memory"
        selectionMode="multiple"
        confirming={adding}
        bottomInset={insets.bottom}
        onClose={() => {
          if (!adding) {
            setMediaLibraryPickerVisible(false);
          }
        }}
        onConfirm={onImportMediaLibraryPhotos}
      />

      <Modal
        visible={Boolean(photoEditor && selectedPage && selectedSlot && selectedSlotPhoto)}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoEditor(undefined)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalIconButton}
                onPress={() => {
                  if (selectedPage && selectedSlot) {
                    clearSlotOverride(selectedPage.id, selectedSlot.id);
                  }
                }}
              >
                <Ionicons name="arrow-undo-outline" size={24} color="#f8fbff" />
              </Pressable>
              <Text style={styles.modalTitle}>Edit Photo</Text>
              <Pressable onPress={() => setPhotoEditor(undefined)}>
                <Text style={styles.modalDone}>Done</Text>
              </Pressable>
            </View>
            {selectedPage && selectedSlot && selectedSlotPhoto ? (
              <View
                style={[styles.modalCanvas, { width: editorSize, height: editorSize, backgroundColor: getSectionStyle(selectedPage.id).backgroundColor }]}
                onTouchStart={(event) => beginEditorGesture(event.nativeEvent.touches)}
                onTouchMove={(event) => updateEditorGesture(event.nativeEvent.touches)}
                onTouchEnd={() => {
                  editorGestureRef.current.mode = undefined;
                }}
                onTouchCancel={() => {
                  editorGestureRef.current.mode = undefined;
                }}
              >
                {(() => {
                  const photoMetrics = getPhotoRenderMetrics({
                    containerAspect: selectedSlot.frame.width / Math.max(0.0001, selectedSlot.frame.height),
                    imageAspect: getPhotoAspect(selectedSlotPhoto),
                    fitMode: selectedSlot.fitMode,
                    scale: selectedSlot.photoScale ?? 1,
                    offsetX: selectedSlot.photoOffsetX ?? 0,
                    offsetY: selectedSlot.photoOffsetY ?? 0
                  });
                  return (
                    <>
                <View style={styles.modalDimLayer} />
                <View
                  style={[
                    styles.modalCropFrame,
                    {
                      left: modalCrop.left,
                      top: modalCrop.top,
                      width: modalCrop.width,
                      height: modalCrop.height,
                      borderColor: getSectionStyle(selectedPage.id).slotBorderColor,
                      borderWidth: getSectionStyle(selectedPage.id).slotBorderWidth,
                      borderRadius: getSectionStyle(selectedPage.id).slotCornerRadius
                    }
                  ]}
                >
                  <Image
                    source={{ uri: selectedSlotPhoto.uri }}
                    style={[
                      styles.modalCropImage,
                      {
                        width: `${photoMetrics.width * 100}%`,
                        height: `${photoMetrics.height * 100}%`,
                        left: `${photoMetrics.leftPercent}%`,
                        top: `${photoMetrics.topPercent}%`
                      }
                    ]}
                    resizeMode="stretch"
                  />
                </View>
                    </>
                  );
                })()}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a1220"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#20304d"
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTextWrap: {
    flex: 1,
    alignItems: "flex-end"
  },
  topBarTitle: {
    color: "#f8fbff",
    fontSize: 20,
    fontWeight: "800"
  },
  topBarSubtitle: {
    marginTop: 4,
    color: "#7f90b3",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.1
  },
  topBarGhost: {
    width: 40,
    height: 40
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 18
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
    borderColor: "#e2e8f0",
    padding: 14
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  meta: {
    marginTop: 2,
    color: "#475569"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  secondaryActionText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#0f766e",
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
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10
  },
  deleteText: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  helpText: {
    color: "#64748b"
  },
  toolbar: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    gap: 8
  },
  toolbarLabel: {
    color: "#334155",
    fontSize: 12
  },
  toolbarButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  toolbarButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc"
  },
  toolbarButtonDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a"
  },
  pageCard: {
    position: "relative",
    backgroundColor: "#101a2d",
    borderWidth: 1,
    borderColor: "#20304d",
    borderRadius: 26,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  activePageCard: {
    alignSelf: "center",
    paddingBottom: 18
  },
  pageInsertMarker: {
    alignSelf: "center",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    marginVertical: 2
  },
  pageCardDropTarget: {
    borderColor: "#2f80ff",
    borderWidth: 2,
    backgroundColor: "#111f37"
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
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center"
  },
  pageHandleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 1
  },
  pageHeaderText: {
    flex: 1
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  pageMeta: {
    marginTop: 2,
    color: "#475569",
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
  composerBar: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#10192c"
  },
  textCompactToolbarShell: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#10192c",
    overflow: "hidden"
  },
  textCompactToolbarScroll: {
    flexGrow: 0
  },
  textCompactToolbar: {
    gap: 12,
    padding: 16,
    paddingBottom: 18
  },
  textCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  fontDropdown: {
    flex: 1,
    flexDirection: "row",
    gap: 6
  },
  fontDropdownOption: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b",
    alignItems: "center"
  },
  fontDropdownOptionActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  fontDropdownText: {
    color: "#eef4ff",
    fontWeight: "600"
  },
  toggleChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b",
    alignItems: "center",
    justifyContent: "center"
  },
  toggleChipActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  toggleChipText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#eef4ff"
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
    color: "#8fa4cd",
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
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b",
    alignItems: "center",
    justifyContent: "center"
  },
  sliderButtonText: {
    color: "#eef4ff",
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
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b",
    alignItems: "center",
    justifyContent: "center"
  },
  alignButtonActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  alignButtonText: {
    fontSize: 16,
    color: "#eef4ff"
  },
  pageDeleteCornerButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#6f2432",
    backgroundColor: "#28131a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30
  },
  iconOrb: {
    width: 64,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#243452",
    backgroundColor: "#1a2740",
    alignItems: "center",
    justifyContent: "center"
  },
  iconOrbActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  iconOrbGraphic: {
    width: 28,
    height: 28,
    position: "relative"
  },
  layoutGlyphBlock: {
    position: "absolute",
    borderRadius: 3,
    backgroundColor: "#f8fbff"
  },
  textGlyphLine: {
    position: "absolute",
    left: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#f8fbff"
  },
  borderGlyphFrame: {
    position: "absolute",
    inset: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#f8fbff",
    alignItems: "center",
    justifyContent: "center"
  },
  borderGlyphInner: {
    width: 12,
    height: 8,
    borderRadius: 3,
    backgroundColor: "rgba(248, 251, 255, 0.2)"
  },
  backgroundGlyphBack: {
    position: "absolute",
    left: 2,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#2f80ff"
  },
  backgroundGlyphFront: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#f0b54a",
    borderWidth: 1,
    borderColor: "#f8fbff"
  },
  iconOrbLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: "#d6e0f6",
    textAlign: "center",
    maxWidth: 62
  },
  iconOrbLabelActive: {
    color: "#ffffff"
  },
  inspectorArea: {
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#20304d",
    backgroundColor: "#10192c",
    padding: 14
  },
  templateRow: {
    gap: 10,
    paddingRight: 10
  },
  templateChoice: {
    borderWidth: 1,
    borderColor: "#243452",
    borderRadius: 16,
    backgroundColor: "#17243c",
    padding: 8
  },
  templateChoiceActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  templateChoiceLabel: {
    paddingHorizontal: 10,
    paddingVertical: 20,
    fontWeight: "700",
    color: "#d6e0f6"
  },
  templateMiniCard: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#0f182a",
    position: "relative",
    overflow: "hidden"
  },
  templateMiniCardActive: {
    backgroundColor: "#17243c"
  },
  templateMiniBlock: {
    position: "absolute",
    borderRadius: 4,
    backgroundColor: "rgba(191, 205, 228, 0.78)"
  },
  templateMiniHero: {
    backgroundColor: "#f0b54a"
  },
  textInspector: {
    gap: 12
  },
  textInspectorHelp: {
    color: "#94a6cb",
    textAlign: "center"
  },
  addTextButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb"
  },
  addTextButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  controlGroup: {
    gap: 8
  },
  controlGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8fa4cd",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  metricText: {
    minWidth: 42,
    textAlign: "center",
    fontWeight: "700",
    color: "#eef4ff",
    alignSelf: "center"
  },
  paletteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent"
  },
  colorSwatchActive: {
    borderColor: "#2563eb"
  },
  controlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  stepperButton: {
    borderWidth: 1,
    borderColor: "#2a3b5d",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#18243b"
  },
  stepperButtonActive: {
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  stepperButtonText: {
    color: "#eef4ff",
    fontWeight: "600"
  },
  stepperButtonTextActive: {
    color: "#ffffff"
  },
  canvasWrap: {
    alignSelf: "center",
    position: "relative",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14
  },
  primaryCanvasWrap: {
    marginTop: 4
  },
  slotFrameWrap: {
    position: "absolute"
  },
  slotFrame: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#16233b"
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
  textBoxFrameSelected: {
    borderColor: "#2563eb",
    borderWidth: 2,
    shadowColor: "#0f172a",
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
    borderColor: "#2563eb",
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
    borderColor: "#2563eb",
    backgroundColor: "#ffffff",
    zIndex: 30
  },
  slotDropTarget: {
    borderColor: "#2563eb",
    borderWidth: 3
  },
  slotDragging: {
    opacity: 0.32
  },
  slotSelected: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 10
  },
  slotImage: {
    position: "absolute"
  },
  tinyButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc"
  },
  tinyButtonDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2"
  },
  grid: {
    gap: 10
  },
  empty: {
    color: "#8ea4cf"
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
    borderColor: "#0f766e",
    backgroundColor: "#f0fdfa"
  },
  photoCardDropTarget: {
    borderColor: "#1d4ed8",
    borderWidth: 2
  },
  photoCardDragging: {
    opacity: 0.25
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  photoMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  photoMeta: {
    fontSize: 12,
    color: "#475569"
  },
  primaryBadge: {
    fontSize: 11,
    color: "#115e59",
    backgroundColor: "#ccfbf1",
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
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#10192c",
    borderWidth: 1,
    borderColor: "#20304d"
  },
  stagingStripActive: {
    borderColor: "#2f80ff",
    borderWidth: 2
  },
  stagingBlock: {
    marginTop: 4,
    gap: 12
  },
  blockLabel: {
    marginLeft: 4,
    color: "#7f90b3",
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
    width: 76,
    height: 76,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#17233b",
    borderWidth: 1,
    borderColor: "#243452"
  },
  addPhotoTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#243046",
    borderStyle: "dashed"
  },
  removePhotoTileActive: {
    borderColor: "#2f80ff",
    borderWidth: 3,
    backgroundColor: "#22385e"
  },
  addPhotoTileText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#eef4ff"
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
    borderColor: "#2f80ff",
    backgroundColor: "#22385e"
  },
  thumbCardDropTarget: {
    borderColor: "#2f80ff",
    borderWidth: 2
  },
  thumbCardDragging: {
    opacity: 0.25
  },
  gallerySwapTarget: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#2f80ff",
    backgroundColor: "rgba(47, 128, 255, 0.18)"
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
    backgroundColor: "#14b8a6"
  },
  pageRail: {
    paddingVertical: 4
  },
  pageRailSection: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#20304d"
  },
  pageRailList: {
    flexGrow: 0
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
    width: 92,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  pageRailCard: {
    width: 92,
    minHeight: 96,
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
    width: 92,
    height: 72,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#243452",
    backgroundColor: "#17233b"
  },
  pageRailPreviewSelected: {
    borderColor: "#2f80ff"
  },
  pageRailPlaceholderPreview: {
    opacity: 0.28,
    borderStyle: "dashed"
  },
  pageRailAddPreview: {
    borderStyle: "dashed",
    borderColor: "#4d6288",
    alignItems: "center",
    justifyContent: "center"
  },
  pageRailPreviewBlock: {
    position: "absolute",
    backgroundColor: "rgba(191, 205, 228, 0.4)",
    borderRadius: 4
  },
  pageRailAddText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#d7e2ff"
  },
  pageRailLabel: {
    marginTop: 6,
    textAlign: "center",
    color: "#8ea4cf",
    fontSize: 12,
    fontWeight: "600"
  },
  pageRailLabelActive: {
    color: "#2f80ff"
  },
  pageRailLabelPlaceholder: {
    opacity: 0
  },
  pageRailInsertMarker: {
    width: 10,
    height: 72,
    borderRadius: 999,
    backgroundColor: "#2563eb"
  },
  floatingActionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
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
    backgroundColor: "#e2e8f0"
  },
  floatingTitleWrap: {
    flex: 1
  },
  floatingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  floatingSubtitle: {
    marginTop: 1,
    color: "#64748b",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc"
  },
  floatingButtonText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  floatingDangerButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fef2f2"
  },
  floatingDangerText: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  dragPreview: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#0f766e",
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
    borderColor: "#2563eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pageDragPreviewText: {
    fontWeight: "700",
    color: "#0f172a"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.64)",
    justifyContent: "flex-end"
  },
  deleteBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 14, 0.76)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  deletePopover: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: "#0f182a",
    borderWidth: 1,
    borderColor: "#223456",
    padding: 18,
    gap: 12,
    alignItems: "center"
  },
  deletePreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: "#e2e8f0"
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fbff"
  },
  deleteCopy: {
    color: "#8ea4cf",
    textAlign: "center"
  },
  deleteActions: {
    flexDirection: "row",
    gap: 10
  },
  deleteCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b"
  },
  deleteCancelText: {
    color: "#eef4ff",
    fontWeight: "600"
  },
  deleteConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#b91c1c"
  },
  deleteConfirmText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  modalSheet: {
    backgroundColor: "#0f182a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#223456",
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
    borderColor: "#2a3b5d",
    backgroundColor: "#18243b",
    alignItems: "center",
    justifyContent: "center"
  },
  modalUndoGlyph: {
    fontSize: 24,
    lineHeight: 24,
    color: "#0f172a",
    fontWeight: "700"
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fbff",
    textAlign: "center"
  },
  modalDone: {
    color: "#7db6ff",
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
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 12
  }
});

