import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { useAppData } from "../../src/context/AppContext";
import { DragOverlay } from "../../src/editor/drag/DragOverlay";
import { DragTargetRegistry } from "../../src/editor/drag/dragTargets";
import { useDragInteraction } from "../../src/editor/drag/useDragInteraction";
import { DragPayload, DragResolution, DropTarget, Rect } from "../../src/editor/drag/types";
import { buildLayoutDocument } from "../../src/layout/engine";
import { applySlotOverridesToPage } from "../../src/layout/overrides";
import { listTemplatesForPhotoCount, TemplateDefinition } from "../../src/layout/templates";
import { SlotOverride, useEditorStore } from "../../src/state/editorStore";
import { MemoryPageSection } from "../../src/types";

type InspectorKind = "layout" | "background" | "border" | "text";
type IconKind = "layout" | "text" | "border" | "background";

type PhotoEditorState = {
  pageId: string;
  slotId: string;
};

const COLOR_PALETTE = ["#ffffff", "#fff7ed", "#fef3c7", "#ecfccb", "#e0f2fe", "#ede9fe", "#fce7f3", "#f1f5f9"];
const BORDER_COLORS = ["#e2e8f0", "#0f172a", "#334155", "#0f766e", "#c2410c", "#b91c1c"];
const TEXT_COLORS = ["#0f172a", "#334155", "#0f766e", "#7c3aed", "#c2410c", "#be185d"];
const FONT_FAMILIES = ["System", "serif", "sans-serif", "monospace"];
const FONT_WEIGHTS = ["400", "500", "600", "700"];
const DRAG_HOLD_MS = 220;

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
  const { width, height } = useWindowDimensions();
  const {
    getProjectById,
    getMemoryById,
    getPhotosByMemoryId,
    getPageSectionsByMemoryId,
    addPhotosToMemory,
    createPageSection,
    reorderPageSection,
    movePhotoToPage,
    removePhotoFromPage,
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
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [openInspector, setOpenInspector] = useState<{ pageId: string; kind: InspectorKind } | undefined>(undefined);
  const [photoEditor, setPhotoEditor] = useState<PhotoEditorState | undefined>(undefined);
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
  const canvasSize = Math.min(width - 64, height * 0.33, 352);
  const pageCardWidth = Math.min(width - 30, 460);
  const editorSize = Math.min(width - 32, height * 0.56);
  const stageButtonSize = 64;
  const stagingPhotos = useMemo(() => photos.filter((photo) => !assignedPhotoIds.has(photo.id)), [assignedPhotoIds, photos]);
  const modalFocus = useMemo(() => {
    if (!selectedSlot) {
      return {
        pageSize: editorSize,
        left: 0,
        top: 0
      };
    }
    const available = 0.82;
    const focusScale = clamp(
      Math.min(
        available / Math.max(0.18, selectedSlot.frame.width),
        available / Math.max(0.18, selectedSlot.frame.height)
      ),
      1,
      3.25
    );
    const pageSize = editorSize * focusScale;
    const centerX = selectedSlot.frame.x + selectedSlot.frame.width / 2;
    const centerY = selectedSlot.frame.y + selectedSlot.frame.height / 2;
    return {
      pageSize,
      left: editorSize / 2 - centerX * pageSize,
      top: editorSize / 2 - centerY * pageSize
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
    setSelectedPhotoIds((prev) => {
      const next = prev.filter((photoId) => Boolean(photosById[photoId]));
      return next.length === prev.length ? prev : next;
    });
  }, [photosById]);

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
    if (activePageId && activePageId !== selectedPageId) {
      setSelection(activePageId, undefined);
    }
  }, [activePageId, selectedPageId, setSelection]);

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]));
  }

  function onPhotoPress(photoId: string) {
    if (suppressNextPressPhotoIdRef.current === photoId) {
      suppressNextPressPhotoIdRef.current = undefined;
      return;
    }
    togglePhotoSelection(photoId);
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

  function setSelectedFitMode(mode: "contain" | "cover") {
    if (!selectedPageId || !selectedSlotId) {
      return;
    }
    setSlotOverride(selectedPageId, selectedSlotId, { fitMode: mode });
  }

  function nudgeSelectedScale(delta: number) {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    setSlotOverride(selectedPageId, selectedSlot.id, {
      photoScale: clamp((selectedSlot.photoScale ?? 1) + delta, 0.5, 3)
    });
  }

  function nudgeSelectedOffset(deltaX: number, deltaY: number) {
    if (!selectedPageId || !selectedSlot) {
      return;
    }
    setSlotOverride(selectedPageId, selectedSlot.id, {
      photoOffsetX: clamp((selectedSlot.photoOffsetX ?? 0) + deltaX, -1, 1),
      photoOffsetY: clamp((selectedSlot.photoOffsetY ?? 0) + deltaY, -1, 1)
    });
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
    const slotWidthPx = Math.max(1, modalFocus.pageSize * selectedSlot.frame.width);
    const slotHeightPx = Math.max(1, modalFocus.pageSize * selectedSlot.frame.height);
    if (touches.length >= 2 && gesture.mode === "pinch") {
      const [a, b] = touches;
      const distance = Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
      const scale = clamp(gesture.startScale * (distance / Math.max(1, gesture.startDistance)), 0.5, 3);
      setSlotOverride(selectedPageId, selectedSlot.id, { photoScale: scale });
      return;
    }
    const [touch] = touches;
    if (!touch || gesture.mode !== "pan") {
      return;
    }
    const deltaX = (touch.pageX - gesture.startX) / slotWidthPx;
    const deltaY = (touch.pageY - gesture.startY) / slotHeightPx;
    setSlotOverride(selectedPageId, selectedSlot.id, {
      photoOffsetX: clamp(gesture.startOffsetX + deltaX, -1, 1),
      photoOffsetY: clamp(gesture.startOffsetY + deltaY, -1, 1)
    });
  }

  async function onAddPhotos() {
    try {
      setAdding(true);
      const count = await addPhotosToMemory(memoryId);
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
        rect: {
          x: stagingRectRef.current.x + stageButtonSize + 14,
          y: stagingRectRef.current.y,
          width: Math.max(0, stagingRectRef.current.width - stageButtonSize - 14),
          height: stagingRectRef.current.height
        },
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
      <Stack.Screen options={{ title: memory.title }} />
      <View style={styles.container}>
        {activeSection && activeRenderedPage ? (() => {
          const section = activeSection;
          const renderedPage = activeRenderedPage;
          const pageStyle = getSectionStyle(section.id);
          const inspectorOpen = openInspector?.pageId === section.id ? openInspector.kind : undefined;
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
              <View
                ref={pageCanvasRef}
                collapsable={false}
                style={[styles.canvasWrap, styles.primaryCanvasWrap, { width: canvasSize, height: canvasSize, backgroundColor: pageStyle.backgroundColor }]}
              >
                {renderedPage.slots.map((slot) => {
                  const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                  const isSelected = selectedPageId === renderedPage.id && selectedSlotId === slot.id;
                  const sizePercent = slot.photoScale * 100;
                  const leftPercent = 50 - slot.photoScale * 50 + slot.photoOffsetX * 100;
                  const topPercent = 50 - slot.photoScale * 50 + slot.photoOffsetY * 100;
                  const slotRefKey = `${renderedPage.id}:${slot.id}`;
                  const slotPanHandlers = photo
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
                  const slotPressHandlers = photo
                    ? slotPanHandlers
                    : {
                        onPress: () => openSlotEditor(renderedPage.id, slot.id)
                      };
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
                                width: `${sizePercent}%`,
                                height: `${sizePercent}%`,
                                left: `${leftPercent}%`,
                                top: `${topPercent}%`
                              }
                            ]}
                            resizeMode={slot.fitMode}
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>

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
                  onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "text" ? undefined : { pageId: section.id, kind: "text" }))}
                />
                <IconOrb
                  label="BORDER"
                  kind="border"
                  active={inspectorOpen === "border"}
                  onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "border" ? undefined : { pageId: section.id, kind: "border" }))}
                />
                <IconOrb
                  label="BG"
                  kind="background"
                  active={inspectorOpen === "background"}
                  onPress={() => setOpenInspector((prev) => (prev?.pageId === section.id && prev.kind === "background" ? undefined : { pageId: section.id, kind: "background" }))}
                />
              </View>

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
                      <Text>- Border</Text>
                    </Pressable>
                    <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotBorderWidth: clamp((section.slotBorderWidth ?? 1) + 1, 0, 12) })}>
                      <Text>+ Border</Text>
                    </Pressable>
                    <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotCornerRadius: clamp((section.slotCornerRadius ?? 10) - 2, 0, 28) })}>
                      <Text>- Corner</Text>
                    </Pressable>
                    <Pressable style={styles.stepperButton} onPress={() => updatePageSectionStyle(section.id, { slotCornerRadius: clamp((section.slotCornerRadius ?? 10) + 2, 0, 28) })}>
                      <Text>+ Corner</Text>
                    </Pressable>
                  </View>
                ) : null}

                {inspectorOpen === "text" ? (
                  <View style={styles.controlRow}>
                    {TEXT_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        style={[styles.colorSwatch, { backgroundColor: color }, pageStyle.textColor === color ? styles.colorSwatchActive : null]}
                        onPress={() => updatePageSectionStyle(section.id, { textColor: color })}
                      />
                    ))}
                    {FONT_FAMILIES.map((fontFamily) => (
                      <Pressable
                        key={fontFamily}
                        style={[styles.stepperButton, pageStyle.textFontFamily === fontFamily ? styles.stepperButtonActive : null]}
                        onPress={() => updatePageSectionStyle(section.id, { textFontFamily: fontFamily })}
                      >
                        <Text style={{ fontFamily }}>{fontFamily}</Text>
                      </Pressable>
                    ))}
                    {FONT_WEIGHTS.map((weight) => (
                      <Pressable
                        key={weight}
                        style={[styles.stepperButton, pageStyle.textWeight === weight ? styles.stepperButtonActive : null]}
                        onPress={() => updatePageSectionStyle(section.id, { textWeight: weight })}
                      >
                        <Text style={{ fontWeight: weight as "400" | "500" | "600" | "700" }}>{weight}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })() : (
          <Text style={styles.empty}>No page selected.</Text>
        )}

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
              const selected = selectedPhotoIds.includes(photo.id);
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
                  style={[styles.stagingTile, selected ? styles.thumbCardSelected : null, isDragging ? styles.thumbCardDragging : null]}
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
                    <View style={[styles.pageRailPreview, { backgroundColor: getSectionStyle(item.id).backgroundColor }]}>
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
                    <Text style={styles.pageRailLabel}>Page {(index >= 0 ? index : 0) + 1}</Text>
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

        {photos.length === 0 ? (
          <Text style={styles.empty}>No photos in this memory yet. Use Add Photos to begin.</Text>
        ) : null}
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <DragOverlay session={drag.session} style={drag.overlayStyle} />
      </View>

      <Modal
        visible={Boolean(photoEditor && selectedPage && selectedSlot && selectedSlotPhoto)}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoEditor(undefined)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
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
                <View
                  style={[
                    styles.modalPageFocus,
                    {
                      width: modalFocus.pageSize,
                      height: modalFocus.pageSize,
                      left: modalFocus.left,
                      top: modalFocus.top,
                      backgroundColor: getSectionStyle(selectedPage.id).backgroundColor
                    }
                  ]}
                >
                  {selectedPage.slots.map((slot) => {
                    const photo = slot.photoId ? photosById[slot.photoId] : undefined;
                    const isFocused = slot.id === selectedSlot.id;
                    return (
                      <View
                        key={slot.id}
                        style={[
                          styles.modalSlotFrame,
                          !isFocused ? styles.modalSlotFrameMuted : null,
                          isFocused ? styles.modalSlotFrameFocused : null,
                          {
                            left: `${slot.frame.x * 100}%`,
                            top: `${slot.frame.y * 100}%`,
                            width: `${slot.frame.width * 100}%`,
                            height: `${slot.frame.height * 100}%`,
                            borderColor: getSectionStyle(selectedPage.id).slotBorderColor,
                            borderWidth: getSectionStyle(selectedPage.id).slotBorderWidth,
                            borderRadius: getSectionStyle(selectedPage.id).slotCornerRadius
                          }
                        ]}
                      >
                        {photo ? (
                          <Image
                            source={{ uri: photo.uri }}
                            style={[
                              styles.modalSlotImage,
                              {
                                width: `${slot.photoScale * 100}%`,
                                height: `${slot.photoScale * 100}%`,
                                left: `${50 - slot.photoScale * 50 + slot.photoOffsetX * 100}%`,
                                top: `${50 - slot.photoScale * 50 + slot.photoOffsetY * 100}%`
                              }
                            ]}
                            resizeMode={slot.fitMode}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Text style={styles.modalHelp}>Tap Fill or Fit, then use the directional nudges and zoom controls below.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalAction} onPress={() => setSelectedFitMode("cover")}>
                <Text style={styles.modalActionText}>Fill</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => setSelectedFitMode("contain")}>
                <Text style={styles.modalActionText}>Fit</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedScale(-0.1)}>
                <Text style={styles.modalActionText}>Zoom -</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedScale(0.1)}>
                <Text style={styles.modalActionText}>Zoom +</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedOffset(-0.05, 0)}>
                <Text style={styles.modalActionText}>Left</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedOffset(0.05, 0)}>
                <Text style={styles.modalActionText}>Right</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedOffset(0, -0.05)}>
                <Text style={styles.modalActionText}>Up</Text>
              </Pressable>
              <Pressable style={styles.modalAction} onPress={() => nudgeSelectedOffset(0, 0.05)}>
                <Text style={styles.modalActionText}>Down</Text>
              </Pressable>
              <Pressable
                style={styles.modalAction}
                onPress={() => {
                  if (selectedPage && selectedSlot) {
                    clearSlotOverride(selectedPage.id, selectedSlot.id);
                  }
                }}
              >
                <Text style={styles.modalActionText}>Undo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    padding: 10
  },
  activePageCard: {
    alignSelf: "center",
    paddingBottom: 14
  },
  pageInsertMarker: {
    alignSelf: "center",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    marginVertical: 2
  },
  pageCardDropTarget: {
    borderColor: "#0f766e",
    borderWidth: 2,
    backgroundColor: "#f0fdfa"
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
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12
  },
  iconOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center"
  },
  iconOrbActive: {
    borderColor: "#2563eb",
    backgroundColor: "#e0f2fe"
  },
  iconOrbGraphic: {
    width: 28,
    height: 28,
    position: "relative"
  },
  layoutGlyphBlock: {
    position: "absolute",
    borderRadius: 3,
    backgroundColor: "#0f172a"
  },
  textGlyphLine: {
    position: "absolute",
    left: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#0f172a"
  },
  borderGlyphFrame: {
    position: "absolute",
    inset: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  borderGlyphInner: {
    width: 12,
    height: 8,
    borderRadius: 3,
    backgroundColor: "rgba(15, 23, 42, 0.14)"
  },
  backgroundGlyphBack: {
    position: "absolute",
    left: 2,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#bfdbfe"
  },
  backgroundGlyphFront: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#fde68a",
    borderWidth: 1,
    borderColor: "#0f172a"
  },
  iconOrbLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "700",
    color: "#334155"
  },
  iconOrbLabelActive: {
    color: "#1d4ed8"
  },
  inspectorArea: {
    minHeight: 98,
    justifyContent: "center",
    marginBottom: 8
  },
  templateRow: {
    gap: 10,
    paddingRight: 10
  },
  templateChoice: {
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 8
  },
  templateChoiceActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff"
  },
  templateChoiceLabel: {
    paddingHorizontal: 10,
    paddingVertical: 20,
    fontWeight: "700",
    color: "#334155"
  },
  templateMiniCard: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    position: "relative",
    overflow: "hidden"
  },
  templateMiniCardActive: {
    backgroundColor: "#dbeafe"
  },
  templateMiniBlock: {
    position: "absolute",
    borderRadius: 4,
    backgroundColor: "#cbd5e1"
  },
  templateMiniHero: {
    backgroundColor: "#94a3b8"
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
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc"
  },
  stepperButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff"
  },
  canvasWrap: {
    alignSelf: "center",
    position: "relative",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10
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
    backgroundColor: "#f8fafc"
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
    color: "#64748b"
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
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "#ecfdf3",
    borderWidth: 1,
    borderColor: "#86efac"
  },
  stagingStripActive: {
    borderColor: "#16a34a",
    borderWidth: 2
  },
  stagingPhotosRow: {
    gap: 10,
    paddingRight: 8,
    alignItems: "center"
  },
  stagingTile: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#86efac"
  },
  addPhotoTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4"
  },
  removePhotoTileActive: {
    borderColor: "#2563eb",
    borderWidth: 3,
    backgroundColor: "#dbeafe"
  },
  addPhotoTileText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#166534"
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
    borderColor: "#0f766e",
    backgroundColor: "#f0fdfa"
  },
  thumbCardDropTarget: {
    borderColor: "#1d4ed8",
    borderWidth: 2
  },
  thumbCardDragging: {
    opacity: 0.25
  },
  gallerySwapTarget: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#2563eb",
    backgroundColor: "rgba(37, 99, 235, 0.12)"
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
    marginTop: 14,
    paddingVertical: 8
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
    borderColor: "#2563eb",
    backgroundColor: "#ffffff"
  },
  pageRailPlaceholderPreview: {
    opacity: 0.28,
    borderStyle: "dashed"
  },
  pageRailAddPreview: {
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center"
  },
  pageRailPreviewBlock: {
    position: "absolute",
    backgroundColor: "rgba(148, 163, 184, 0.7)",
    borderRadius: 4
  },
  pageRailAddText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#475569"
  },
  pageRailLabel: {
    marginTop: 6,
    textAlign: "center",
    color: "#334155",
    fontSize: 12,
    fontWeight: "600"
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
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    alignItems: "center"
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  modalDone: {
    color: "#2563eb",
    fontWeight: "700"
  },
  modalCanvas: {
    borderRadius: 18,
    position: "relative",
    overflow: "hidden"
  },
  modalPageFocus: {
    position: "absolute"
  },
  modalSlotFrame: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#ffffff"
  },
  modalSlotFrameMuted: {
    opacity: 0.42
  },
  modalSlotFrameFocused: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 12
  },
  modalSlotImage: {
    position: "absolute"
  },
  modalHelp: {
    color: "#64748b",
    textAlign: "center"
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center"
  },
  modalAction: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc"
  },
  modalActionText: {
    fontWeight: "700",
    color: "#0f172a"
  }
});
