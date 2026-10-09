import { CoverEditorStrip } from "../../src/components/CoverEditorStrip";
import { CoverAwarePageBackground } from "../../src/components/CoverAwarePageBackground";
import { getShapeTextLayout } from "../../src/layout/shapeText";
import { usePageHistory } from "../../src/editor/usePageHistory";
import { FreestylePhoto } from "../../src/editor/FreestylePhoto";
import { ObjectHandles } from "../../src/editor/ObjectHandles";
import { ObjectShape } from "../../src/components/ObjectShape";
import { objectShapes, getShapeDefinition } from "../../src/layout/objectShapes";
import { droppedPhoto, unlockPage, stepLayer } from "../../src/layout/freestyle";
import { LayoutSlot } from "../../src/layout/schemas";
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
  Platform,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaLibrarySelectionModal } from "../../src/components/MediaLibrarySelectionModal";
import { useAppData } from "../../src/context/AppContext";
import { DragOverlay } from "../../src/editor/drag/DragOverlay";
import { DragTargetRegistry } from "../../src/editor/drag/dragTargets";
import { useDragInteraction } from "../../src/editor/drag/useDragInteraction";
import { DragPayload, DragResolution, DropTarget, Rect } from "../../src/editor/drag/types";
import { buildLayoutDocument } from "../../src/layout/engine";
import { getBackgroundAssetSelection } from "../../src/layout/backgroundAssets";
import { Button } from "../../src/ui/Button";
import { Chip } from "../../src/ui/Chip";
import { applySlotOverridesToPage } from "../../src/layout/overrides";
import { clampPhotoOffset, getPhotoAspect, getPhotoRenderMetrics, getPhotoScaleBounds } from "../../src/layout/photoMetrics";
import { useEditorStore } from "../../src/state/editorStore";
import { pickImagesWithAndroidPhotoPicker } from "../../src/services/androidPhotoPicker";
import { pickPhotosFromMediaLibraryByAssetIds } from "../../src/services/photoService";
import { MemoryPageSection, PageTextBox } from "../../src/types";
import { PHOTO_PICKER_SELECTION_LIMIT, ANDROID_PHOTO_PICKER_IMPORTS_ENABLED, DRAG_HOLD_MS, applyColorOpacity, sameSectionOrder, sectionOrderKey, clamp, TEXT_PLACEHOLDER, estimateTextBoxSize } from "../../src/features/memoryEditor/helpers";
import type { InspectorKind } from "../../src/features/memoryEditor/helpers";
import { IconOrb } from "../../src/features/memoryEditor/EditorControls";
import { styles } from "../../src/features/memoryEditor/styles";
import { BackgroundPanel } from "../../src/features/memoryEditor/panels/BackgroundPanel";
import { BordersPanel } from "../../src/features/memoryEditor/panels/BordersPanel";
import { PagesPanel } from "../../src/features/memoryEditor/panels/PagesPanel";
import { LayoutPanel } from "../../src/features/memoryEditor/panels/LayoutPanel";
import { TextBoxPanel } from "../../src/features/memoryEditor/panels/TextBoxPanel";


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

export default function MemoryDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const memoryId = Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? "");
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const {
    getProjectById,
    getMemoriesByProjectId,
    createMemory,
    getMemoryById,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    addPhotoAssetsToMemory,
    createPageSection,
    deletePageSection,
    deletePhotos,
    reorderPageSection,
    assignPhotoToPageSlot,
    removePhotoFromPageSlot,
    addPageTextBox,
    updatePageTextBox,
    deletePageTextBox,
    setPageSectionTemplate,
    updatePageSectionStyle: savePageSectionStyle,
    updateProject,
    updatePageSectionExport,
    patchPageSection,
    replaceMemoryPages
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
  const [photoShapesOpen, setPhotoShapesOpen] = useState(false);
  const textPressOrigin = useRef({ x: 0, y: 0 });
  const [photoEditor, setPhotoEditor] = useState<PhotoEditorState | undefined>(undefined);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | undefined>(undefined);
  const [editorHeight, setEditorHeight] = useState(0);
  const [textControl, setTextControl] = useState<"font" | undefined>(undefined);
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
  const canvasRectRef = useRef<Rect | undefined>(undefined);
  const pageCanvasRef = useRef<View | null>(null);
  const removePhotoTileRef = useRef<View | null>(null);
  const stagingRectRef = useRef<Rect | undefined>(undefined);
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
  const suppressTextTapRef = useRef(false);
  const textTapWasSelectedRef = useRef(false);
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
  const initialInspectorMemory = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activePageId && initialInspectorMemory.current !== memoryId) {
      initialInspectorMemory.current = memoryId;
      setOpenInspector({ pageId: activePageId, kind: "pages" });
    }
  }, [activePageId, memoryId]);
  const activeRenderedPage = activePageId ? renderedPageById[activePageId] : undefined;
  const freestyle = activeSection?.templateId === "freestyle";
  const unlocked = freestyle && !activeSection?.layoutLocked;
  const historyOverrides = Object.fromEntries(pageSections.map(section => [section.id, slotOverridesByPage[section.id] ?? {}]));
  const history = usePageHistory(memory?.id ?? "loading", { sections: pageSections, photos, overrides: historyOverrides }, snapshot => {
    Keyboard.dismiss(); setSelectedTextBoxId(undefined); setPhotoEditor(undefined);
    const restoredPage = snapshot.sections.find(section => JSON.stringify(section) !== JSON.stringify(pageSections.find(current => current.id === section.id)));
    setSelection(restoredPage?.id ?? activeSection?.id ?? snapshot.sections[0]?.id, undefined);
    replaceMemoryPages(memoryId, snapshot.sections, snapshot.photos);
    const other = { ...useEditorStore.getState().slotOverridesByPage };
    pageSections.forEach(section => delete other[section.id]);
    useEditorStore.setState({ slotOverridesByPage: { ...other, ...snapshot.overrides } });
  });
  function enableFreestyle() {
    if (!activeSection || !activeRenderedPage) return;
    patchPageSection(activeSection.id, unlockPage(activeSection, activeRenderedPage));
    clearPageOverrides(activeSection.id);
    setSelection(activeSection.id, undefined);
  }
  function changeTemplate(templateId?: string) {
    if (!activeSection) return;
    clearPageOverrides(activeSection.id);
    setPageSectionTemplate(activeSection.id, templateId);
    setSelection(activeSection.id, undefined);
  }
  function changeFreeSlot(slot: LayoutSlot) {
    if (!activeSection) return;
    patchPageSection(activeSection.id, { freestyleSlots: (activeSection.freestyleSlots ?? []).map(old => old.id === slot.id ? slot : old) });
  }
  function orderObject(id: string, forward: boolean, text: boolean) {
    if (!activeSection || !activeRenderedPage) return;
    const layers = [...activeRenderedPage.slots.map(slot => ({ id: slot.id, text: false, z: slot.zIndex ?? 2 })), ...activeTextBoxes.map(box => ({ id: box.id, text: true, z: box.zIndex ?? 20 }))].sort((a, b) => a.z - b.z);
    const moving = layers.find(layer => layer.id === id && layer.text === text);
    if (!moving) return;
    const ordered = stepLayer(layers, layers.indexOf(moving), forward);
    const z = (objectId: string, isText: boolean) => ordered.findIndex(layer => layer.id === objectId && layer.text === isText) + 2;
    patchPageSection(activeSection.id, { freestyleSlots: activeSection.freestyleSlots?.map(slot => ({ ...slot, zIndex: z(slot.id, false) })), textBoxes: activeTextBoxes.map(box => ({ ...box, zIndex: z(box.id, true) })) });
  }

  const activeSlotTextBoxBySlotId = useMemo(
    () =>
      Object.fromEntries(
        activeTextBoxes
          .filter((textBox) => Boolean(textBox.anchorSlotId))
          .map((textBox) => [textBox.anchorSlotId, textBox] as const)
      ),
    [activeTextBoxes]
  );
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
  // Size against the actual safe-area workspace, including Android keyboard resizing.
  // The preview keeps the same allocation when switching or closing tool panels.
  const workspaceHeight = editorHeight || height - insets.top - insets.bottom - 100;
  const canvasSize = Math.max(80, Math.min(width - 32, (workspaceHeight - 100) * 0.58, 430));
  const pageCardWidth = Math.min(width - 24, 480);
  const editorSize = Math.min(width - 32, height * 0.56);
  const stageButtonSize = 84;
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

  function handleAddTextBox(
    slot?: { id: string; frame: { x: number; y: number; width: number; height: number } }
  ) {
    if (!activeSection) {
      return;
    }
    const sectionStyle = getSectionStyle(activeSection.id);
    const defaultFontSize = Math.max(18, sectionStyle.textSize);
    const defaultSize = estimateTextBoxSize("", defaultFontSize, canvasSize);
    const width = slot ? slot.frame.width : defaultSize.width;
    const height = slot ? slot.frame.height : defaultSize.height;
    const createdId = addPageTextBox(activeSection.id, {
      anchorSlotId: slot?.id,
      textColor: sectionStyle.textColor,
      fontFamily: sectionStyle.textFontFamily,
      fontWeight: sectionStyle.textWeight,
      fontSize: defaultFontSize,
      fontStyle: "normal",
      fillColor: "#ffffff",
      fillOpacity: 0,
      textAlign: "center",
      borderWidth: 1,
      borderColor: sectionStyle.textColor,
      cornerRadius: 8,
      x: slot ? slot.frame.x : undefined,
      y: slot ? slot.frame.y : undefined,
      width,
      height,
      autoSize: false
    });
    if (!createdId) {
      return;
    }
    setSelectedTextBoxId(createdId);
    setEditingTextBoxId(undefined);
    setOpenInspector({ pageId: activeSection.id, kind: "text" });
  }

  function openEmptySlotActions(pageId: string, slotId: string) {
    const slot = renderedPageById[pageId]?.slots.find((item) => item.id === slotId);
    const slotTextBox = activeSlotTextBoxBySlotId[slotId];
    setSelection(pageId, slotId);
    if (slotTextBox) {
      selectTextBox(slotTextBox.id);
      return;
    }
    Alert.alert("Empty slot", "Choose what to put here.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Add Text",
        onPress: () => {
          if (slot) {
            handleAddTextBox(slot);
          } else {
            handleAddTextBox();
          }
        }
      },
      {
        text: "Select Slot",
        onPress: () => setOpenInspector(undefined)
      }
    ]);
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

  function selectTextBox(textBoxId: string, wasSelected = selectedTextBoxId === textBoxId) {
    if (!wasSelected) Keyboard.dismiss();
    setSelectedTextBoxId(textBoxId);
    setEditingTextBoxId(wasSelected ? textBoxId : undefined);
    if (activeSection && (!activeTextBoxes.find(box => box.id === textBoxId)?.sticker || wasSelected)) {
      setOpenInspector({ pageId: activeSection.id, kind: "text" });
    }
  }

  function clearTextBoxSelection() {
    setSelectedTextBoxId(undefined);
    setEditingTextBoxId(undefined);
    setTextControl(undefined);
  }

  function stepBackFromTextBox() {
    // Run on press-in/grant, before native input blur can discard the editing state.
    Keyboard.dismiss();
    if (editingTextBoxId) {
      setEditingTextBoxId(undefined);
    } else {
      setSelectedTextBoxId(undefined);
      setTextControl(undefined);
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
    stepBackFromTextBox();
  }

  function revertSelectedTextSlotToPhotoSlot() {
    if (!activeSection || !selectedTextBox?.anchorSlotId) {
      return;
    }
    deletePageTextBox(activeSection.id, selectedTextBox.id);
    setSelectedTextBoxId(undefined);
    setEditingTextBoxId(undefined);
    setSelection(activeSection.id, selectedTextBox.anchorSlotId);
    setOpenInspector(undefined);
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
    history.begin();
    Keyboard.dismiss();
    suppressTextTapRef.current = true;
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
      updatePageTextBox(activeSection.id, gesture.textBoxId, { x: nextX, y: nextY, anchorSlotId: undefined });
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
    history.end();
    textBoxGestureRef.current = {
      startPageX: 0,
      startPageY: 0
    };
  }

  function updatePageSectionStyle(...args: Parameters<typeof savePageSectionStyle>) {
    const panel = memory?.bookRole === "front-cover" ? "front" : memory?.bookRole === "back-cover" ? "back" : undefined;
    if (panel && project?.coverDesign?.background && ("backgroundColor" in args[1] || "backgroundAssetId" in args[1])) {
      updateProject(project.id, { coverDesign: { ...project.coverDesign, panelBackgrounds: { ...project.coverDesign.panelBackgrounds, [panel]: true } } });
    }
    savePageSectionStyle(...args);
  }

  function getSectionStyle(pageSectionId: string) {
    const section = pageSections.find((item) => item.id === pageSectionId);
    return {
      backgroundColor: section?.backgroundColor ?? "#ffffff",
      backgroundAssetId: section?.backgroundAssetId,
      slotBorderColor: section?.slotBorderColor ?? "#e2e8f0",
      slotBorderWidth: section?.slotBorderWidth ?? 1,
      slotCornerRadius: section?.slotCornerRadius ?? 0,
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
    history.begin();
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

    if (Platform.OS === "android" && ANDROID_PHOTO_PICKER_IMPORTS_ENABLED) {
      try {
        setAdding(true);
        const result = await pickImagesWithAndroidPhotoPicker({
          selectionLimit: PHOTO_PICKER_SELECTION_LIMIT
        });
        if (result.available) {
          if (result.assets.length > 0) {
            const createdPhotoIds = await addPhotoAssetsToMemory(memoryId, result.assets);
            const count = createdPhotoIds.length;
            if (count > 0) {
              Alert.alert("Photos added", `${count} photo(s) added to this memory.`);
            }
          }
          return;
        }
      } catch (error) {
        Alert.alert("Unable to add photos", (error as Error).message);
        return;
      } finally {
        setAdding(false);
      }
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
    canvasRectRef.current = await measureNode(pageCanvasRef.current);
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
    removePhotoTileRectRef.current = await measureNode(removePhotoTileRef.current);
  }

  function buildDropTargets() {
    const targets: DropTarget[] = [];

    if (unlocked && activeSection && canvasRectRef.current) targets.push({ id: "freestyle-canvas", targetType: "page-canvas", rect: canvasRectRef.current, priority: 20, targetPageId: activeSection.id, hitSlop: 0, stickySlop: 0 });
    if (activeRenderedPage && !unlocked) {
      activeRenderedPage.slots.forEach((slot) => {
        if (activeSlotTextBoxBySlotId[slot.id]) {
          return;
        }
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
    if (resolution.action === "add-freestyle" && activeSection && activeRenderedPage) {
      const slot = droppedPhoto(resolution.photoId, resolution.x ?? .5, resolution.y ?? .5, `free-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, Math.max(2, ...activeRenderedPage.slots.map(s => s.zIndex ?? 2), ...activeTextBoxes.map(t => t.zIndex ?? 20)) + 1);
      patchPageSection(activeSection.id, { freestyleSlots: [...(activeSection.freestyleSlots ?? []), slot] });
      assignPhotoToPageSlot(activeSection.id, slot.id, resolution.photoId);
      setSelection(activeSection.id, slot.id);
      return;
    }
    if (resolution.action === "cancel") {
      return;
    }
    if (resolution.action === "swap-page-photo") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      const targetSlot = appliedSlotById[`${resolution.targetPageId}:${resolution.targetSlotId}`];
      if (!sourceSlot?.photoId || !targetSlot?.photoId) {
        return;
      }
      clearSlotOverride(resolution.sourcePageId, resolution.sourceSlotId);
      clearSlotOverride(resolution.targetPageId, resolution.targetSlotId);
      assignPhotoToPageSlot(resolution.sourcePageId, resolution.sourceSlotId, targetSlot.photoId);
      assignPhotoToPageSlot(resolution.targetPageId, resolution.targetSlotId, sourceSlot.photoId);
      return;
    }
    if (resolution.action === "move-page-photo") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      const targetSlot = appliedSlotById[`${resolution.targetPageId}:${resolution.targetSlotId}`];
      if (!sourceSlot?.photoId || targetSlot?.photoId) {
        return;
      }
      clearSlotOverride(resolution.sourcePageId, resolution.sourceSlotId);
      clearSlotOverride(resolution.targetPageId, resolution.targetSlotId);
      removePhotoFromPageSlot(resolution.sourcePageId, resolution.sourceSlotId, sourceSlot.photoId);
      assignPhotoToPageSlot(resolution.targetPageId, resolution.targetSlotId, sourceSlot.photoId);
      return;
    }
    if (resolution.action === "remove-to-gallery") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      if (!sourceSlot?.photoId) {
        return;
      }
      clearSlotOverride(resolution.sourcePageId, resolution.sourceSlotId);
      removePhotoFromPageSlot(resolution.sourcePageId, resolution.sourceSlotId, sourceSlot.photoId);
      return;
    }
    if (resolution.action === "swap-with-gallery-photo") {
      const sourceSlot = appliedSlotById[`${resolution.sourcePageId}:${resolution.sourceSlotId}`];
      clearSlotOverride(resolution.sourcePageId, resolution.sourceSlotId);
      if (sourceSlot?.photoId) {
        removePhotoFromPageSlot(resolution.sourcePageId, resolution.sourceSlotId, sourceSlot.photoId);
      }
      assignPhotoToPageSlot(resolution.sourcePageId, resolution.sourceSlotId, resolution.targetPhotoId);
      return;
    }
    if (resolution.action === "add-to-page") {
      clearSlotOverride(resolution.targetPageId, resolution.targetSlotId);
      assignPhotoToPageSlot(resolution.targetPageId, resolution.targetSlotId, resolution.photoId);
      return;
    }
    if (resolution.action === "swap-with-page-photo") {
      const targetSlot = appliedSlotById[`${resolution.targetPageId}:${resolution.targetSlotId}`];
      clearSlotOverride(resolution.targetPageId, resolution.targetSlotId);
      if (targetSlot?.photoId) {
        removePhotoFromPageSlot(resolution.targetPageId, resolution.targetSlotId, targetSlot.photoId);
      }
      assignPhotoToPageSlot(resolution.targetPageId, resolution.targetSlotId, resolution.photoId);
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
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topBarButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={30} color="#241F1B" />
        </Pressable>
        <View style={styles.topBarTextWrap}>
          <Text numberOfLines={1} style={styles.topBarTitle}>
            {memory.title}
          </Text>
          <Text style={styles.topBarSubtitle}>{editingTextBoxId ? "Editing text" : topBarMeta}</Text>
        </View>
        <Pressable accessibilityLabel="Undo" disabled={!history.canUndo} onPress={history.undo} style={{ padding: 8, opacity: history.canUndo ? 1 : .3 }}><Ionicons name="arrow-undo" size={22} color="#6B5BD2" /></Pressable>
        <Pressable accessibilityLabel="Redo" disabled={!history.canRedo} onPress={history.redo} style={{ padding: 8, opacity: history.canRedo ? 1 : .3 }}><Ionicons name="arrow-redo" size={22} color="#6B5BD2" /></Pressable>
        {selectedTextBox ? (
          <Button variant="primary" size="sm" label="Done" onPress={saveTextEditing} />
        ) : <View style={styles.topBarGhost} />}
      </View>
      {(memory.bookRole === "front-cover" || memory.bookRole === "back-cover") && <CoverEditorStrip projectId={memory.projectId} panel={memory.bookRole === "front-cover" ? "front" : "back"} />}
      <View onLayout={(event) => setEditorHeight(event.nativeEvent.layout.height - insets.bottom - 24)} style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
        {activeSection && activeRenderedPage ? (() => {
          const section = activeSection;
          const renderedPage = activeRenderedPage;
          const pageStyle = getSectionStyle(section.id);
          const themeColors = getBackgroundAssetSelection(section.backgroundAssetId)?.asset.palette ?? [];
          const inspectorOpen = openInspector?.pageId === section.id ? openInspector.kind : undefined;
          const textModeActive = inspectorOpen === "text";
          const toggleInspector = (kind: InspectorKind) => {
            if (kind === "text") {
              if (inspectorOpen === "text") {
                if (selectedTextBoxId) stepBackFromTextBox();
                else exitTextMode();
              } else {
                Keyboard.dismiss();
                setEditingTextBoxId(undefined);
                setTextControl(undefined);
                setOpenInspector({ pageId: section.id, kind: "text" });
              }
              return;
            }
            Keyboard.dismiss();
            setSelectedTextBoxId(undefined);
            setEditingTextBoxId(undefined);
            setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === kind ? undefined : { pageId: section.id, kind }));
          };
          return (
            <View
              style={[
                styles.pageCard,
                styles.activePageCard,
                { width: pageCardWidth }
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
                  <Ionicons name="trash-outline" size={20} color="#6B6156" />
                </Pressable>
              ) : null}
              <View
                ref={pageCanvasRef}
                collapsable={false}
                style={[styles.canvasWrap, styles.primaryCanvasWrap, { width: canvasSize, height: canvasSize }]}
              >
                <CoverAwarePageBackground project={project} role={memory.bookRole} width={canvasSize} backgroundAssetId={pageStyle.backgroundAssetId} backgroundColor={pageStyle.backgroundColor} />
                <Pressable accessibilityLabel="Deselect object" style={StyleSheet.absoluteFill} onPress={() => { stepBackFromTextBox(); setSelection(section.id, undefined); }} />
                {renderedPage.slots.map((slot) => {
                  const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                  if (unlocked) return <FreestylePhoto key={slot.id} slot={slot} photo={photo} selected={selectedSlotId === slot.id && !selectedTextBoxId} size={canvasSize}
                    borderColor={pageStyle.slotBorderColor} borderWidth={pageStyle.slotBorderWidth} cornerRadius={pageStyle.slotCornerRadius}
                    onSelect={() => { setSelectedTextBoxId(undefined); setSelection(section.id, slot.id); }}
                    onEdit={() => openSlotEditor(section.id, slot.id)} onChange={changeFreeSlot} onBegin={history.begin} onEnd={history.end} />;

                  const slotTextBox = activeSlotTextBoxBySlotId[slot.id];
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
                    : !textModeActive && slotTextBox
                    ? {
                        onPress: () => selectTextBox(slotTextBox.id)
                      }
                    : !textModeActive
                    ? {
                        onPress: () => openEmptySlotActions(renderedPage.id, slot.id)
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
                          height: `${slot.frame.height * 100}%`,
                          transform: [{ rotate: `${slot.rotation ?? 0}deg` }], zIndex: slot.zIndex ?? 2
                        }
                      ]}
                    >
                      <Pressable
                        {...(slotPressHandlers ?? {})}
                        style={[
                          styles.slotFrame,
                          slotTextBox && !photo ? styles.slotFrameTextOccupied : null,
                          isSelected ? styles.slotSelected : null,
                          drag.session.payload?.dragType === "page-photo" && drag.session.payload.itemId === photo?.id ? styles.slotDragging : null,
                          {
                            backgroundColor: slot.shape && slot.shape !== "rectangle" ? "transparent" : "#F3EBDE",
                            borderColor: pageStyle.slotBorderColor,
                            borderWidth: slot.shape && slot.shape !== "rectangle" ? 0 : pageStyle.slotBorderWidth,
                            borderRadius: pageStyle.slotCornerRadius
                          },
                          hoveredTarget?.targetPageId === renderedPage.id && hoveredTarget.targetSlotId === slot.id ? styles.slotDropTarget : null
                        ]}
                      >
                        {slot.shape && slot.shape !== "rectangle" ? <ObjectShape shape={slot.shape} uri={photo?.uri} metrics={photoMetrics} border={pageStyle.slotBorderColor} borderWidth={pageStyle.slotBorderWidth} /> : photo ? (
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
                            resizeMode="cover"
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
                {selectedTextBoxId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Step back from text editing"
                    style={styles.textTapAwaySurface}
                    onPressIn={stepBackFromTextBox}
                  />
                ) : null}
                {activeTextBoxes.map((textBox) => {
                  const isSelectedTextBox = textBox.id === selectedTextBoxId;
                  const isEditingTextBox = textBox.id === editingTextBoxId;
                  const anchorSlot = textBox.anchorSlotId
                    ? renderedPage.slots.find((slot) => slot.id === textBox.anchorSlotId)
                    : undefined;
                  const textFrame = anchorSlot?.frame ?? {
                    x: textBox.x,
                    y: textBox.y,
                    width: textBox.width,
                    height: textBox.height
                  };
                  const isAnchoredTextBox = Boolean(anchorSlot);
                  const shapeText = getShapeTextLayout(textBox.shape, textBox.text || TEXT_PLACEHOLDER, textFrame.width * canvasSize, textFrame.height * canvasSize, textBox.sticker ? textFrame.height * canvasSize * .7 : textBox.fontSize ?? pageStyle.textSize, textBox.borderWidth);
                  return (
                    <View
                      key={textBox.id}
                      style={[
                        styles.textBoxWrap,
                        {
                          left: `${textFrame.x * 100}%`,
                          top: `${textFrame.y * 100}%`,
                          width: `${textFrame.width * 100}%`,
                          height: `${textFrame.height * 100}%`,
                          transform: [{ rotate: `${textBox.rotation ?? 0}deg` }], zIndex: isSelectedTextBox ? 10001 : textBox.zIndex ?? 20
                        }
                      ]}
                      pointerEvents="box-none"
                    >
                      <Pressable
                        style={[
                          styles.textBoxFrame,
                          isAnchoredTextBox ? styles.textBoxFrameAnchored : null,
                          isSelectedTextBox ? styles.textBoxFrameSelected : null,
                          {
                            paddingHorizontal: textBox.shape && textBox.shape !== "rectangle" ? 0 : textBox.sticker ? 0 : 10,
                            paddingVertical: shapeText || textBox.sticker ? 0 : 6,
                            borderWidth: textBox.shape && textBox.shape !== "rectangle" ? 0 : textBox.borderWidth ?? 0,
                            borderColor: textBox.borderColor ?? "#0f172a",
                            borderRadius: textBox.cornerRadius ?? 8,
                            backgroundColor: (isAnchoredTextBox || (textBox.shape && textBox.shape !== "rectangle"))
                              ? "transparent"
                              : applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)
                          }
                        ]}
                        onPressIn={(event) => {
                          textPressOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
                          suppressTextTapRef.current = false;
                          textTapWasSelectedRef.current = isSelectedTextBox;
                        }}
                        onPress={() => {
                          if (suppressTextTapRef.current || textBoxGestureRef.current.mode) {
                            return;
                          }
                          selectTextBox(textBox.id, textTapWasSelectedRef.current);
                        }}
                        onLongPress={(event) => {
                          if (keyboardVisible) {
                            return;
                          }
                          setSelectedTextBoxId(textBox.id);
                          setOpenInspector({ pageId: section.id, kind: "text" });
                          beginTextBoxGesture("move", { ...textBox, ...textFrame, anchorSlotId: undefined }, event.nativeEvent.pageX, event.nativeEvent.pageY);
                        }}
                        delayLongPress={180}
                        onTouchMove={(event) => {
                          const touch = event.nativeEvent.touches[0];
                          if (keyboardVisible || !touch) return;
                          if (isSelectedTextBox && !textBoxGestureRef.current.mode && Math.hypot(touch.pageX - textPressOrigin.current.x, touch.pageY - textPressOrigin.current.y) > 5) {
                            beginTextBoxGesture("move", { ...textBox, ...textFrame, anchorSlotId: undefined }, textPressOrigin.current.x, textPressOrigin.current.y);
                          }
                          if (textBoxGestureRef.current.mode !== "move") return;
                          if (touch) {
                            updateTextBoxGesture(touch.pageX, touch.pageY);
                          }
                        }}
                        onTouchEnd={endTextBoxGesture}
                        onTouchCancel={endTextBoxGesture}
                      >
                        {textBox.shape && textBox.shape !== "rectangle" && <ObjectShape shape={textBox.shape} fill={applyColorOpacity(textBox.fillColor ?? "#ffffff", textBox.fillOpacity ?? 0)} border={textBox.borderColor} borderWidth={textBox.borderWidth} />}
                        <View style={shapeText ? { position: "absolute", left: shapeText.left, top: shapeText.top, width: shapeText.width, height: shapeText.height, overflow: "hidden", justifyContent: "center" } : { flex: 1, justifyContent: "center" }}>
                        {isEditingTextBox ? (
                          <TextInput
                            ref={textInputRef}
                            value={textBox.text}
                            onChangeText={(text) => updateTextBox(textBox, { text })}
                            onContentSizeChange={(event) =>
                              !shapeText && updateTextBoxFromContentSize(
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
                                fontSize: shapeText?.fontSize ?? (textBox.sticker ? textFrame.height * canvasSize * .7 : textBox.fontSize ?? pageStyle.textSize),
                                ...(shapeText ? { lineHeight: shapeText.lineHeight, includeFontPadding: false } : {}),
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
                            adjustsFontSizeToFit={Boolean(shapeText)}
                            numberOfLines={shapeText?.numberOfLines}
                            minimumFontScale={0.01}
                            style={[
                              styles.textBoxText,
                              {
                                color: textBox.textColor ?? pageStyle.textColor,
                                fontSize: shapeText?.fontSize ?? (textBox.sticker ? textFrame.height * canvasSize * .7 : textBox.fontSize ?? pageStyle.textSize),
                                ...(shapeText ? { lineHeight: shapeText.lineHeight, includeFontPadding: false } : {}),
                                fontFamily: textBox.fontFamily ?? pageStyle.textFontFamily,
                                fontWeight: (textBox.fontWeight as "400" | "500" | "600" | "700") ?? "700",
                                fontStyle: (textBox.fontStyle as "normal" | "italic") ?? "normal",
                                textAlign: (textBox.textAlign ?? "center") as "left" | "center" | "right"
                              }
                            ]}
                          >
                            {textBox.text || TEXT_PLACEHOLDER}
                          </Text>
                        )}
                        </View>
                      </Pressable>
                      {isSelectedTextBox && !isEditingTextBox && <ObjectHandles onDelete={() => { deletePageTextBox(section.id, textBox.id); clearTextBoxSelection(); }} geometry={{ ...textFrame, rotation: textBox.rotation }} size={canvasSize} onBegin={history.begin} onEnd={history.end} onChange={patch => updateTextBox(textBox, { ...textFrame, ...patch, anchorSlotId: undefined, autoSize: false, ...(textBox.sticker && patch.height ? { fontSize: Math.min(72, patch.height * canvasSize * .7) } : {}) })} />}
                    </View>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                <Pressable accessibilityLabel={unlocked ? "Lock layout" : "Unlock layout"} onPress={() => freestyle ? patchPageSection(section.id, { layoutLocked: !section.layoutLocked }) : enableFreestyle()} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name={unlocked ? "lock-open-outline" : "lock-closed-outline"} size={18} color="#6B5BD2" /><Text>{unlocked ? "Lock layout" : "Unlock layout"}</Text></Pressable>
                {unlocked && selectedSlotId && !selectedTextBoxId && <>
                  <Pressable accessibilityLabel="Photo order" onPress={() => Alert.alert("Photo order", "Choose a layer", [{ text: "Cancel", style: "cancel" }, { text: "Send forwards", onPress: () => orderObject(selectedSlotId, true, false) }, { text: "Send backwards", onPress: () => orderObject(selectedSlotId, false, false) }])}><Ionicons name="layers-outline" size={22} color="#6B5BD2" /></Pressable>
                  <Pressable accessibilityLabel="Photo shape" onPress={() => setPhotoShapesOpen(!photoShapesOpen)}><Ionicons name="shapes-outline" size={22} color="#6B5BD2" /></Pressable>
                  <Pressable accessibilityLabel="Remove photo frame" onPress={() => { patchPageSection(section.id, { freestyleSlots: (section.freestyleSlots ?? []).filter(s => s.id !== selectedSlotId) }); removePhotoFromPageSlot(section.id, selectedSlotId, renderedPage.slots.find(s => s.id === selectedSlotId)?.photoId); setSelection(section.id, undefined); }}><Ionicons name="remove-circle-outline" size={22} color="#6B5BD2" /></Pressable>
                </>}
              </View>
              {unlocked && selectedSlotId && !selectedTextBoxId && photoShapesOpen && <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", paddingBottom: 6 }}>{objectShapes.map(shape => <Chip key={shape} label={getShapeDefinition(shape).label} selected={(renderedPage.slots.find(s => s.id === selectedSlotId)?.shape ?? "rectangle") === shape} onPress={() => { const slot = renderedPage.slots.find(s => s.id === selectedSlotId); if (slot) changeFreeSlot({ ...slot, shape }); }} />)}</View>}
              {inspectorOpen ? (
                <View
                  style={styles.inspectorArea}
                >
                  <View style={styles.inspectorHeading}>
                    <Text style={styles.inspectorTitle}>{inspectorOpen === "border" ? "Borders" : inspectorOpen}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Close tools" hitSlop={10} onPress={() => { Keyboard.dismiss(); setEditingTextBoxId(undefined); setOpenInspector(undefined); }}>
                      <Ionicons name="close" size={20} color="#4A4239" />
                    </Pressable>
                  </View>
                  {inspectorOpen === "pages" ? (
                    <PagesPanel
                      header={memory.bookRole === "front-cover" && <Button icon="heart-outline" style={{ alignSelf: "flex-start" }} label={getMemoriesByProjectId(memory.projectId).some(m => m.bookRole === "dedication") ? "Edit dedication page" : "Add dedication page"} onPress={async () => { const existing = getMemoriesByProjectId(memory.projectId).find(m => m.bookRole === "dedication"); const id = existing?.id ?? await createMemory(memory.projectId, "Dedication", { bookRole: "dedication" }); router.push({ pathname: "/memory/[id]", params: { id } }); }} />}
                      pages={pageRailData}
                      activePageId={activePageId}
                      renderedPageById={renderedPageById}
                      photosById={photosById}
                      getPageStyle={getSectionStyle}
                      dragging={pageRailDragging}
                      onDraggingChange={setPageRailDragging}
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
                      onSelectPage={(pageId) => {
                        setSelection(pageId, undefined);
                        setPhotoEditor(undefined);
                      }}
                      onAddPage={onAddPage}
                      pageNumber={section.order + 1}
                      exportToFolder={section.exportToFolder}
                      exportFolderName={section.exportFolderName}
                      onExportChange={(change) => updatePageSectionExport(section.id, change)}
                    />
                  ) : null}

                  {inspectorOpen === "layout" ? (
                    <LayoutPanel freestyle={freestyle} templateId={section.templateId} onFreestyle={enableFreestyle} onChangeTemplate={changeTemplate} />
                  ) : null}

                  {inspectorOpen === "photos" ? (
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
                        {adding ? <ActivityIndicator color="#241F1B" /> : <Text style={styles.addPhotoTileText}>+</Text>}
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
                  ) : null}

                  {inspectorOpen === "background" ? (
                    <BackgroundPanel
                      backgroundColor={section.backgroundColor}
                      backgroundAssetId={section.backgroundAssetId}
                      themeColors={themeColors}
                      onChange={(change) => updatePageSectionStyle(section.id, change)}
                    />
                  ) : null}

                  {inspectorOpen === "border" ? (
                    <BordersPanel value={pageStyle} themeColors={themeColors} onChange={(change) => updatePageSectionStyle(section.id, change)} />
                  ) : null}

                  {inspectorOpen === "text" ? (
                    <>
                    {(!selectedTextBox || (selectedTextBox.sticker && !editingTextBoxId)) && <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                      <Button variant="primary" icon="add" label="Add text box" style={{ flex: 1 }} onPress={() => { Keyboard.dismiss(); handleAddTextBox(); }} />
                      <Button label="Add emoji" leading={<Text style={{ fontSize: 18 }}>😊</Text>} style={{ flex: 1 }} onPress={() => { Keyboard.dismiss(); const id = addPageTextBox(section.id, { sticker: true, text: "😊", fontSize: 48, width: .25, height: .25, borderWidth: 0, autoSize: false }); if (id) { setSelectedTextBoxId(id); setEditingTextBoxId(undefined); } }} />
                    </View>}
                    {selectedTextBox && (!selectedTextBox.sticker || editingTextBoxId) ? (
                      <TextBoxPanel
                        textBox={selectedTextBox}
                        defaultTextColor={pageStyle.textColor}
                        themeColors={themeColors}
                        fontMenuOpen={textControl === "font"}
                        onFontMenuChange={(open) => setTextControl(open ? "font" : undefined)}
                        onChange={updateSelectedTextBox}
                        onRevertToPhotoSlot={revertSelectedTextSlotToPhotoSlot}
                      />
                    ) : (
                      <View style={styles.textInspector}>
                        <Text style={styles.textInspectorHelp}>Add a text box, or tap an existing one to select it. Tap the selected box again to edit its text.</Text>
                      </View>
                    )}
                    </>
                  ) : null}
                </View>
              ) : <View style={styles.idleToolSpace}>
                {photos.length === 0 ? <Text style={styles.empty}>Add photos to start this page.</Text> : null}
              </View>}
              <View style={styles.toolTray} onStartShouldSetResponder={() => Boolean(selectedTextBoxId || (unlocked && selectedSlotId))} onResponderGrant={() => { stepBackFromTextBox(); setSelection(section.id, undefined); }}>
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="always"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.toolRail}
                >
                  <IconOrb label="Pages" icon="albums-outline" active={inspectorOpen === "pages"} onPress={() => toggleInspector("pages")} />
                  <IconOrb label="Layout" icon="grid-outline" active={inspectorOpen === "layout"} onPress={() => toggleInspector("layout")} />
                  <IconOrb label="Photos" icon="images-outline" active={inspectorOpen === "photos"} onPress={() => toggleInspector("photos")} />
                  <IconOrb label="Text" icon="text-outline" active={inspectorOpen === "text"} onPress={() => toggleInspector("text")} />
                  <IconOrb label="Background" icon="color-palette-outline" active={inspectorOpen === "background"} onPress={() => toggleInspector("background")} />
                  <IconOrb label="Borders" icon="scan-outline" active={inspectorOpen === "border"} onPress={() => toggleInspector("border")} />
                </ScrollView>
              </View>

            </View>
          );
        })() : (
          <Text style={styles.empty}>No page selected.</Text>
        )}


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
              <Button label="Cancel" onPress={() => setGalleryDeletePhotoId(undefined)} />
              <Button
                variant="danger"
                label="Delete"
                onPress={() => {
                  if (galleryDeletePhotoId) {
                    deletePhotos([galleryDeletePhotoId]);
                  }
                  setGalleryDeletePhotoId(undefined);
                }}
              />
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
                <Ionicons name="arrow-undo-outline" size={24} color="#241F1B" />
              </Pressable>
              <Text style={styles.modalTitle}>Edit Photo</Text>
              <Pressable onPress={() => setPhotoEditor(undefined)}>
                <Text style={styles.modalDone}>Done</Text>
              </Pressable>
            </View>
            {selectedPage && selectedSlot && selectedSlotPhoto ? (
              <View
                style={[styles.modalCanvas, { width: editorSize, height: editorSize }]}
                onTouchStart={(event) => beginEditorGesture(event.nativeEvent.touches)}
                onTouchMove={(event) => updateEditorGesture(event.nativeEvent.touches)}
                onTouchEnd={(event) => {
                  if (event.nativeEvent.touches.length) beginEditorGesture(event.nativeEvent.touches);
                  else { history.end(); editorGestureRef.current.mode = undefined; }
                }}
                onTouchCancel={() => {
                  history.end();
                  editorGestureRef.current.mode = undefined;
                }}
              >
                <CoverAwarePageBackground project={project} role={memory.bookRole} width={editorSize}
                  backgroundAssetId={getSectionStyle(selectedPage.id).backgroundAssetId}
                  backgroundColor={getSectionStyle(selectedPage.id).backgroundColor}
                />
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
                    resizeMode="cover"
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
