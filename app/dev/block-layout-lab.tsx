import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  PanResponderInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  RectN,
  buildInitialGridFrames,
  enhanceLayout,
  recomputeFrames,
  snapRectToValid
} from "../../src/layout/blockTool";
import { clampToBounds } from "../../src/layout/blockTool/geometry";
import { SlotOverride } from "../../src/state/editorStore";

type Orientation = "portrait" | "landscape";

type LabSlot = {
  id: string;
  role: "hero" | "photo";
  frame: RectN;
};

const BLOCK_COUNT_MIN = 1;
const BLOCK_COUNT_MAX = 12;
const RESIZE_STEP = 0.02;
const GAP_MIN = 0;
const GAP_MAX = 0.06;
const ALPHA_MIN = 0;
const ALPHA_MAX = 2;
const PAGE_BOUNDS: RectN = { x: 0, y: 0, width: 1, height: 1 };
const EMPTY_OBSTACLES: RectN[] = [];
const RESIZE_MIN = 0.05;
const RESIZE_MAX = 0.98;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasGeometryOverride(override?: SlotOverride): boolean {
  if (!override) {
    return false;
  }
  return (
    override.x !== undefined ||
    override.y !== undefined ||
    override.width !== undefined ||
    override.height !== undefined
  );
}

function mergeRectWithOverride(frame: RectN, override?: SlotOverride): RectN {
  return {
    x: override?.x ?? frame.x,
    y: override?.y ?? frame.y,
    width: override?.width ?? frame.width,
    height: override?.height ?? frame.height
  };
}

function createFrameMap(slots: { id: string; frame: RectN }[]): Record<string, RectN> {
  return Object.fromEntries(slots.map((slot) => [slot.id, slot.frame] as const));
}

function usableBoundsForGap(gap: number): RectN {
  return {
    x: PAGE_BOUNDS.x + gap / 2,
    y: PAGE_BOUNDS.y + gap / 2,
    width: PAGE_BOUNDS.width - gap,
    height: PAGE_BOUNDS.height - gap
  };
}

function applyResize(frame: RectN, axis: "w" | "h", delta: number, keepAspect: boolean): RectN {
  const aspect = frame.width / Math.max(0.0001, frame.height);
  let width = frame.width;
  let height = frame.height;
  if (axis === "w") {
    width = clamp(frame.width + delta, RESIZE_MIN, RESIZE_MAX);
    if (keepAspect) {
      height = width / aspect;
    }
  } else {
    height = clamp(frame.height + delta, RESIZE_MIN, RESIZE_MAX);
    if (keepAspect) {
      width = height * aspect;
    }
  }
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height
  };
}

function NormalizedSlider({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(1);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const ratio = clamp(evt.nativeEvent.locationX / trackWidth, 0, 1);
          const raw = min + ratio * (max - min);
          const next = Math.round(raw / step) * step;
          onChange(clamp(next, min, max));
        },
        onPanResponderMove: (evt) => {
          const ratio = clamp(evt.nativeEvent.locationX / trackWidth, 0, 1);
          const raw = min + ratio * (max - min);
          const next = Math.round(raw / step) * step;
          onChange(clamp(next, min, max));
        }
      }),
    [max, min, onChange, step, trackWidth]
  );

  const ratio = (value - min) / Math.max(0.0001, max - min);

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.labelText}>
        {label}: {value.toFixed(3)}
      </Text>
      <View
        style={styles.sliderTrack}
        onLayout={(evt) => setTrackWidth(Math.max(1, evt.nativeEvent.layout.width))}
        {...responder.panHandlers}
      >
        <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

export default function BlockLayoutLabScreen() {
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [heroFirst, setHeroFirst] = useState(true);
  const [blockCount, setBlockCount] = useState(6);
  const [gap, setGap] = useState(0.02);
  const [alpha, setAlpha] = useState(0.8);
  const [keepAspect, setKeepAspect] = useState(true);
  const [enhanceStrength, setEnhanceStrength] = useState(1);
  const [balanceWeight, setBalanceWeight] = useState(1);
  const [alignWeight, setAlignWeight] = useState(1);

  const [baseSlots, setBaseSlots] = useState<LabSlot[]>([]);
  const [committedFramesById, setCommittedFramesById] = useState<Record<string, RectN>>({});
  const [userLockedOverridesBySlotId, setUserLockedOverridesBySlotId] = useState<Record<string, SlotOverride>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined);

  const [draggingSlotId, setDraggingSlotId] = useState<string | undefined>(undefined);
  const [draggingFrame, setDraggingFrame] = useState<RectN | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [debugGesture, setDebugGesture] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [pageWidthPx, setPageWidthPx] = useState(1);
  const [pageHeightPx, setPageHeightPx] = useState(1);
  const [stats, setStats] = useState<{
    fill: number;
    move: number;
    score: number;
    scale: number;
    slack: number;
    centroid: number;
    axis: number;
    align: number;
  }>({
    fill: 0,
    move: 0,
    score: 0,
    scale: 1,
    slack: 0,
    centroid: 0,
    axis: 0,
    align: 0
  });

  const selectedSlotIdRef = useRef<string | undefined>(undefined);
  const baseSlotsRef = useRef<LabSlot[]>([]);
  const committedFramesByIdRef = useRef<Record<string, RectN>>({});
  const pageWidthPxRef = useRef(1);
  const pageHeightPxRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartFrameRef = useRef<RectN | null>(null);
  const draggingFrameRef = useRef<RectN | null>(null);
  const pendingDragFrameRef = useRef<RectN | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const commitUserGeometryRef = useRef<(slotId: string, candidateFrame: RectN) => boolean>(() => false);

  const pageAspect = orientation === "portrait" ? 210 / 297 : 297 / 210;
  const obstacles = EMPTY_OBSTACLES;

  const selectedSlot = useMemo(
    () => baseSlots.find((slot) => slot.id === selectedSlotId),
    [baseSlots, selectedSlotId]
  );

  useEffect(() => {
    selectedSlotIdRef.current = selectedSlotId;
  }, [selectedSlotId]);

  useEffect(() => {
    baseSlotsRef.current = baseSlots;
  }, [baseSlots]);

  useEffect(() => {
    committedFramesByIdRef.current = committedFramesById;
  }, [committedFramesById]);

  useEffect(() => {
    pageWidthPxRef.current = pageWidthPx;
    pageHeightPxRef.current = pageHeightPx;
  }, [pageWidthPx, pageHeightPx]);

  function resolveCommittedFrameFromRefs(slotId: string): RectN | undefined {
    return committedFramesByIdRef.current[slotId] ?? baseSlotsRef.current.find((slot) => slot.id === slotId)?.frame;
  }

  function clampToRawPageBounds(frame: RectN): RectN {
    return clampToBounds(frame, PAGE_BOUNDS);
  }

  function flushPendingDragFrame(): RectN | null {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    const pending = pendingDragFrameRef.current;
    if (pending) {
      setDraggingFrame(pending);
      draggingFrameRef.current = pending;
      pendingDragFrameRef.current = null;
      return pending;
    }
    return draggingFrameRef.current;
  }

  function clearDragState() {
    isDraggingRef.current = false;
    setIsDragging(false);
    setDraggingSlotId(undefined);
    setDraggingFrame(undefined);
    dragStartFrameRef.current = null;
    draggingFrameRef.current = null;
    pendingDragFrameRef.current = null;
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }

  function getCommittedFrame(slotId: string): RectN | undefined {
    return committedFramesById[slotId] ?? baseSlots.find((slot) => slot.id === slotId)?.frame;
  }

  function getRenderFrame(slotId: string): RectN | undefined {
    if (draggingSlotId === slotId && draggingFrame) {
      return draggingFrame;
    }
    return getCommittedFrame(slotId);
  }

  function getLockedRectsForValidation(excludingSlotId?: string): RectN[] {
    const locked: RectN[] = [];
    for (const slot of baseSlots) {
      if (slot.id === excludingSlotId) {
        continue;
      }
      const override = userLockedOverridesBySlotId[slot.id];
      if (!hasGeometryOverride(override)) {
        continue;
      }
      const base = getCommittedFrame(slot.id) ?? slot.frame;
      locked.push(mergeRectWithOverride(base, override));
    }
    return [...locked, ...obstacles];
  }

  function getEngineParams() {
    return {
      gap,
      alpha,
      wMove: Math.max(0.05, alpha * 0.1),
      wCentroid: 0.2 * balanceWeight,
      wAxis: 0.1 * balanceWeight,
      wAlign: 0.05 * alignWeight
    };
  }

  function runRecompute(
    nextUserLockedOverridesBySlotId: Record<string, SlotOverride>,
    previousFramesById: Record<string, RectN>
  ): boolean {
    const metasById = Object.fromEntries(
      baseSlots.map((slot) => [
        slot.id,
        {
          baseAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
          weight: Math.max(0.0001, slot.frame.width * slot.frame.height)
        }
      ] as const)
    );
    const output = recomputeFrames(
      {
        pageId: "block-layout-lab",
        baseSlots,
        previousFramesById,
        userLockedOverridesById: nextUserLockedOverridesBySlotId,
        metasById,
        obstacles
      },
      getEngineParams()
    );
    if (output.hadOverlaps) {
      // Never commit/render a layout that still has overlaps.
      return false;
    }
    setCommittedFramesById(output.framesBySlotId);
    setStats({
      fill: output.fill,
      move: output.move,
      score: output.score,
      scale: output.usedScale,
      slack: output.slackImbalance,
      centroid: output.centroidError,
      axis: output.axisError,
      align: output.alignBonus
    });
    return true;
  }

  function commitUserGeometry(slotId: string, candidateFrame: RectN): boolean {
    const currentCommitted = getCommittedFrame(slotId);
    if (!currentCommitted) {
      return false;
    }
    const snapped = snapRectToValid({
      candidate: candidateFrame,
      bounds: usableBoundsForGap(gap),
      lockedRects: getLockedRectsForValidation(slotId)
        .map((rect) => clampToBounds(rect, usableBoundsForGap(gap))),
      gap
    });
    if (!snapped.ok || !snapped.rect) {
      // Keep existing committed position when no legal placement exists.
      setCommittedFramesById((prev) => ({
        ...prev,
        [slotId]: currentCommitted
      }));
      return false;
    }
    const corrected = snapped.rect;
    const nextUserLocked = {
      ...userLockedOverridesBySlotId,
      [slotId]: {
        ...(userLockedOverridesBySlotId[slotId] ?? {}),
        x: corrected.x,
        y: corrected.y,
        width: corrected.width,
        height: corrected.height
      }
    };
    const nextPreviousFramesById = {
      ...committedFramesById,
      [slotId]: corrected
    };
    const recomputed = runRecompute(nextUserLocked, nextPreviousFramesById);
    if (!recomputed) {
      return false;
    }
    setUserLockedOverridesBySlotId(nextUserLocked);
    return true;
  }
  commitUserGeometryRef.current = commitUserGeometry;

  function unlockSelectedSlot() {
    if (!selectedSlotId) {
      return;
    }
    if (!hasGeometryOverride(userLockedOverridesBySlotId[selectedSlotId])) {
      return;
    }
    const nextUserLocked = { ...userLockedOverridesBySlotId };
    delete nextUserLocked[selectedSlotId];
    setUserLockedOverridesBySlotId(nextUserLocked);
    void runRecompute(nextUserLocked, committedFramesById);
  }

  function resetLayout() {
    const nextSlots = buildInitialGridFrames(blockCount, heroFirst ? "heroFirst" : "allPhoto", orientation).map(
      (slot) => ({
        id: slot.id,
        role: slot.role,
        frame: slot.frame
      })
    );
    const initialFramesById = createFrameMap(nextSlots);
    setBaseSlots(nextSlots);
    setCommittedFramesById(initialFramesById);
    setUserLockedOverridesBySlotId({});
    setSelectedSlotId(nextSlots[0]?.id);
    clearDragState();

    const metasById = Object.fromEntries(
      nextSlots.map((slot) => [
        slot.id,
        {
          baseAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
          weight: Math.max(0.0001, slot.frame.width * slot.frame.height)
        }
      ] as const)
    );
    const output = recomputeFrames(
      {
        pageId: "block-layout-lab",
        baseSlots: nextSlots,
        previousFramesById: initialFramesById,
        userLockedOverridesById: {},
        metasById,
        obstacles
      },
      getEngineParams()
    );
    setCommittedFramesById(output.framesBySlotId);
    setStats({
      fill: output.fill,
      move: output.move,
      score: output.score,
      scale: output.usedScale,
      slack: output.slackImbalance,
      centroid: output.centroidError,
      axis: output.axisError,
      align: output.alignBonus
    });
  }

  useEffect(() => {
    resetLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockCount, heroFirst, orientation]);

  useEffect(() => {
    if (baseSlots.length === 0) {
      return;
    }
    runRecompute(userLockedOverridesBySlotId, committedFramesById);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap, alpha, balanceWeight, alignWeight]);

  function enhanceCurrentLayout() {
    if (baseSlots.length === 0) {
      return;
    }
    const metasById = Object.fromEntries(
      baseSlots.map((slot) => [
        slot.id,
        {
          baseAspect: slot.frame.width / Math.max(0.0001, slot.frame.height),
          weight: Math.max(0.0001, slot.frame.width * slot.frame.height)
        }
      ] as const)
    );
    const output = enhanceLayout(
      {
        pageId: "block-layout-lab",
        baseSlots,
        previousFramesById: committedFramesById,
        userLockedOverridesById: userLockedOverridesBySlotId,
        metasById,
        obstacles
      },
      getEngineParams(),
      {
        maxLockedMove: 0.03 * enhanceStrength,
        maxLockedScale: 0.08 * enhanceStrength
      }
    );
    if (output.hadOverlaps) {
      return;
    }
    const nextLocked = { ...userLockedOverridesBySlotId };
    for (const slot of baseSlots) {
      if (!hasGeometryOverride(nextLocked[slot.id])) {
        continue;
      }
      const frame = output.framesBySlotId[slot.id];
      if (!frame) {
        continue;
      }
      nextLocked[slot.id] = {
        ...(nextLocked[slot.id] ?? {}),
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height
      };
    }
    setUserLockedOverridesBySlotId(nextLocked);
    setCommittedFramesById(output.framesBySlotId);
    setStats({
      fill: output.fill,
      move: output.move,
      score: output.score,
      scale: output.usedScale,
      slack: output.slackImbalance,
      centroid: output.centroidError,
      axis: output.axisError,
      align: output.alignBonus
    });
  }

  const dragPanResponderRef = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(selectedSlotIdRef.current),
      onStartShouldSetPanResponderCapture: () => Boolean(selectedSlotIdRef.current),
      onMoveShouldSetPanResponder: () => Boolean(selectedSlotIdRef.current),
      onMoveShouldSetPanResponderCapture: () => Boolean(selectedSlotIdRef.current),
      onPanResponderGrant: (_evt) => {
        const slotId = selectedSlotIdRef.current;
        if (!slotId) {
          return;
        }
        const start = resolveCommittedFrameFromRefs(slotId);
        if (!start) {
          return;
        }
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartFrameRef.current = start;
        draggingFrameRef.current = start;
        pendingDragFrameRef.current = null;
        setDebugGesture({ dx: 0, dy: 0 });
        setDraggingSlotId(slotId);
        setDraggingFrame(start);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const slotId = selectedSlotIdRef.current;
        const start = dragStartFrameRef.current;
        if (!slotId || !start || !isDraggingRef.current) {
          return;
        }

        // Drag must be derived from captured start frame + gesture delta only.
        const dxN = gestureState.dx / Math.max(1, pageWidthPxRef.current);
        const dyN = gestureState.dy / Math.max(1, pageHeightPxRef.current);
        const dxPx = gestureState.dx;
        const dyPx = gestureState.dy;
        const next = clampToRawPageBounds({
          ...start,
          x: start.x + dxN,
          y: start.y + dyN
        });

        pendingDragFrameRef.current = next;
        if (dragRafRef.current === null) {
          dragRafRef.current = requestAnimationFrame(() => {
            dragRafRef.current = null;
            const frame = pendingDragFrameRef.current;
            if (!frame) {
              return;
            }
            pendingDragFrameRef.current = null;
            draggingFrameRef.current = frame;
            setDraggingFrame(frame);
            setDebugGesture({ dx: dxPx, dy: dyPx });
          });
        }
      },
      onPanResponderRelease: () => {
        const slotId = selectedSlotIdRef.current;
        const candidate = flushPendingDragFrame();
        if (slotId && candidate) {
          void commitUserGeometryRef.current(slotId, candidate);
        }
        clearDragState();
      },
      onPanResponderTerminate: () => {
        clearDragState();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true
    })
  );

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
    };
  }, []);

  function onPageLayout(evt: LayoutChangeEvent) {
    setPageWidthPx(Math.max(1, evt.nativeEvent.layout.width));
    setPageHeightPx(Math.max(1, evt.nativeEvent.layout.height));
  }

  function resizeSelected(axis: "w" | "h", delta: number) {
    if (!selectedSlot) {
      return;
    }
    const current = getCommittedFrame(selectedSlot.id);
    if (!current) {
      return;
    }
    const candidate = applyResize(current, axis, delta, keepAspect);
    void commitUserGeometry(selectedSlot.id, candidate);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      scrollEnabled={!isDragging}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Block Layout Lab</Text>

      <View style={styles.controlsCard}>
        <View style={styles.row}>
          <Text style={styles.labelText}>Blocks: {blockCount}</Text>
          <Pressable
            style={styles.button}
            onPress={() => setBlockCount((prev) => clamp(prev - 1, BLOCK_COUNT_MIN, BLOCK_COUNT_MAX))}
          >
            <Text>-</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => setBlockCount((prev) => clamp(prev + 1, BLOCK_COUNT_MIN, BLOCK_COUNT_MAX))}
          >
            <Text>+</Text>
          </Pressable>
        </View>

        <View style={styles.rowWrap}>
          <Pressable style={styles.button} onPress={() => setOrientation("portrait")}>
            <Text style={orientation === "portrait" ? styles.bold : undefined}>Portrait</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setOrientation("landscape")}>
            <Text style={orientation === "landscape" ? styles.bold : undefined}>Landscape</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setHeroFirst((prev) => !prev)}>
            <Text>{heroFirst ? "Hero First: On" : "Hero First: Off"}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={resetLayout}>
            <Text>Reset layout</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={enhanceCurrentLayout}>
            <Text>Enhance layout</Text>
          </Pressable>
        </View>

        <NormalizedSlider label="Gap" value={gap} min={GAP_MIN} max={GAP_MAX} step={0.002} onChange={setGap} />
        <NormalizedSlider label="Alpha" value={alpha} min={ALPHA_MIN} max={ALPHA_MAX} step={0.05} onChange={setAlpha} />
        <NormalizedSlider
          label="Enhance"
          value={enhanceStrength}
          min={0.5}
          max={1.5}
          step={0.05}
          onChange={setEnhanceStrength}
        />
        <NormalizedSlider
          label="Balance W"
          value={balanceWeight}
          min={0}
          max={2}
          step={0.05}
          onChange={setBalanceWeight}
        />
        <NormalizedSlider
          label="Align W"
          value={alignWeight}
          min={0}
          max={2}
          step={0.05}
          onChange={setAlignWeight}
        />

        <Text style={styles.statText}>
          fill={stats.fill.toFixed(3)} move={stats.move.toFixed(3)} score={stats.score.toFixed(3)} slack={stats.slack.toFixed(3)}
        </Text>
        <Text style={styles.statText}>
          centroid={stats.centroid.toFixed(4)} axis={stats.axis.toFixed(4)} align={stats.align.toFixed(3)} scale={stats.scale.toFixed(2)}
        </Text>
        <Text style={styles.noteText}>
          drag={isDragging ? "on" : "off"} dx={debugGesture.dx.toFixed(1)} dy={debugGesture.dy.toFixed(1)} frame=
          {draggingFrame ? `${draggingFrame.x.toFixed(3)},${draggingFrame.y.toFixed(3)}` : "none"} page=
          {pageWidthPx}x{pageHeightPx}
        </Text>
      </View>

      <View style={[styles.page, { aspectRatio: pageAspect }]} onLayout={onPageLayout}>
        {baseSlots.map((slot) => {
          const frame = getRenderFrame(slot.id) ?? slot.frame;
          const selected = selectedSlotId === slot.id;
          const locked = hasGeometryOverride(userLockedOverridesBySlotId[slot.id]);
          const isDraggingSelected = selected && draggingSlotId === slot.id;
          return (
            <Pressable
              key={slot.id}
              onPressIn={() => setSelectedSlotId(slot.id)}
              pointerEvents={isDragging && !selected ? "none" : "auto"}
              style={[
                styles.blockWrap,
                {
                  left: `${frame.x * 100}%`,
                  top: `${frame.y * 100}%`,
                  width: `${frame.width * 100}%`,
                  height: `${frame.height * 100}%`,
                  zIndex: selected ? 999 : 1
                }
              ]}
            >
              <View
                style={[
                  styles.block,
                  slot.role === "hero" ? styles.heroBlock : styles.photoBlock,
                  selected && styles.selectedBlock,
                  isDraggingSelected && styles.draggingBlock
                ]}
                {...(selected ? dragPanResponderRef.current.panHandlers : {})}
              >
                <Text style={styles.blockText}>{slot.id}</Text>
                <Text style={styles.blockText}>{slot.role}</Text>
                {locked ? <Text style={styles.lockText}>locked</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.controlsCard}>
        <Text style={styles.labelText}>Selected: {selectedSlotId ?? "none"}</Text>
        <View style={styles.rowWrap}>
          <Pressable style={styles.button} onPress={() => resizeSelected("w", RESIZE_STEP)} disabled={!selectedSlot}>
            <Text>+W</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => resizeSelected("w", -RESIZE_STEP)} disabled={!selectedSlot}>
            <Text>-W</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => resizeSelected("h", RESIZE_STEP)} disabled={!selectedSlot}>
            <Text>+H</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => resizeSelected("h", -RESIZE_STEP)} disabled={!selectedSlot}>
            <Text>-H</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setKeepAspect((prev) => !prev)}>
            <Text>{keepAspect ? "Keep aspect: On" : "Keep aspect: Off"}</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={unlockSelectedSlot}
            disabled={!selectedSlotId || !hasGeometryOverride(userLockedOverridesBySlotId[selectedSlotId])}
          >
            <Text>Unlock selected</Text>
          </Pressable>
        </View>

        <Text style={styles.noteText}>
          `userLockedOverridesBySlotId` stores only user-locked geometry. `committedFramesById` stores latest recomputed
          layout.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a"
  },
  controlsCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  button: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc"
  },
  bold: {
    fontWeight: "700"
  },
  labelText: {
    color: "#334155",
    fontWeight: "600"
  },
  statText: {
    color: "#334155"
  },
  page: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    position: "relative"
  },
  blockWrap: {
    position: "absolute"
  },
  block: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#64748b",
    borderRadius: 6,
    padding: 4
  },
  heroBlock: {
    backgroundColor: "#cffafe"
  },
  photoBlock: {
    backgroundColor: "#dbeafe"
  },
  selectedBlock: {
    borderColor: "#0f766e",
    borderWidth: 2
  },
  draggingBlock: {
    opacity: 0.85
  },
  blockText: {
    fontSize: 10,
    color: "#0f172a"
  },
  lockText: {
    marginTop: 2,
    fontSize: 10,
    color: "#b91c1c"
  },
  noteText: {
    fontSize: 12,
    color: "#64748b"
  },
  sliderRow: {
    gap: 6
  },
  sliderTrack: {
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center"
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#99f6e4",
    borderRadius: 10
  },
  sliderThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: "#0f766e"
  }
});
