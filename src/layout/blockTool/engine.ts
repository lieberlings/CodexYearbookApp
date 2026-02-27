import { LayoutSlot } from "../schemas";
import { SlotOverride } from "../../state/editorStore";
import { clampToBounds, inflate, intersects, minSeparationVector } from "./geometry";
import { scoreCandidate } from "./scoring";
import { solvePlacement } from "./solver";
import {
  DEFAULT_ENHANCE_PARAMS,
  DEFAULT_ENGINE_PARAMS,
  EnhanceParams,
  EngineInput,
  EngineOutput,
  EngineParams,
  RectN,
  SlotMeta,
  hasGeometryOverride,
  isUserLocked
} from "./types";

const EPS = 1e-6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeRect(rect: RectN): RectN {
  const width = Math.max(EPS, rect.width);
  const height = Math.max(EPS, rect.height);
  return {
    x: clamp01(rect.x),
    y: clamp01(rect.y),
    width: clamp01(width),
    height: clamp01(height)
  };
}

function mergeRectWithOverride(frame: RectN, override?: SlotOverride): RectN {
  return {
    x: override?.x ?? frame.x,
    y: override?.y ?? frame.y,
    width: override?.width ?? frame.width,
    height: override?.height ?? frame.height
  };
}

function resolveMeta(id: string, frame: RectN, metasById: Record<string, SlotMeta>): SlotMeta {
  const fallbackAspect = frame.width / Math.max(EPS, frame.height);
  const fallbackWeight = Math.max(EPS, frame.width * frame.height);
  const meta = metasById[id];
  return {
    baseAspect: Math.max(EPS, meta?.baseAspect ?? fallbackAspect),
    weight: Math.max(EPS, meta?.weight ?? fallbackWeight),
    preferredCenter: meta?.preferredCenter
  };
}

function subtractAreas(area: number, rects: RectN[]): number {
  const used = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  return Math.max(EPS, area - used);
}

function insetBounds(pageBounds: RectN, gap: number): RectN {
  return clampToBounds(
    {
      x: pageBounds.x + gap / 2,
      y: pageBounds.y + gap / 2,
      width: pageBounds.width - gap,
      height: pageBounds.height - gap
    },
    pageBounds
  );
}

function boundsEqual(a: RectN, b: RectN): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  );
}

function rectCenter(rect: RectN): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function scaleRectFromCenter(rect: RectN, scale: number): RectN {
  const c = rectCenter(rect);
  const width = Math.max(EPS, rect.width * scale);
  const height = Math.max(EPS, rect.height * scale);
  return {
    x: c.x - width / 2,
    y: c.y - height / 2,
    width,
    height
  };
}

function buildRolesById(baseSlots: EngineInput["baseSlots"]): Record<string, "hero" | "photo"> {
  return Object.fromEntries(baseSlots.map((slot) => [slot.id, slot.role] as const));
}

function resolveMoveWeight(cfg: EngineParams): number {
  return cfg.wMove ?? cfg.alpha;
}

function resolveSlackWeight(cfg: EngineParams): number {
  return cfg.wSlack ?? cfg.gamma;
}

function buildScaleCandidates(preferred: number[]): { preferred: number[]; fallback: number[] } {
  const dedupe = new Set<number>();
  const normalize = (scale: number) => Math.round(Math.max(0.3, Math.min(1, scale)) * 1000) / 1000;
  const preferredScales = preferred
    .map(normalize)
    .filter((scale, index, arr) => scale > 0 && arr.indexOf(scale) === index)
    .sort((a, b) => b - a);

  const fallback: number[] = [];
  const start = preferredScales.length > 0
    ? Math.round((Math.min(...preferredScales) - 0.05) * 1000) / 1000
    : 0.95;
  for (let scale = start; scale >= 0.3 - EPS; scale -= 0.05) {
    const normalized = normalize(scale);
    if (preferredScales.includes(normalized) || dedupe.has(normalized)) {
      continue;
    }
    dedupe.add(normalized);
    fallback.push(normalized);
  }
  return { preferred: preferredScales, fallback };
}

function makeDefaultSlot(id: string, role: "hero" | "photo", frame: RectN): LayoutSlot {
  return {
    id,
    role,
    fitMode: "cover",
    photoScale: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    frame
  };
}

export function buildInitialGridFrames(
  n: number,
  roleStrategy: "heroFirst" | "allPhoto" = "heroFirst",
  pageOrientation: "portrait" | "landscape" = "landscape"
): LayoutSlot[] {
  const count = Math.max(0, n);
  if (count === 0) {
    return [];
  }
  const pageAspect = pageOrientation === "portrait" ? 210 / 297 : 297 / 210;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * pageAspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const gap = 0.02;
  const bounds = {
    x: gap / 2,
    y: gap / 2,
    width: 1 - gap,
    height: 1 - gap
  };
  const cellWidth = (bounds.width - Math.max(0, cols - 1) * gap) / cols;
  const cellHeight = (bounds.height - Math.max(0, rows - 1) * gap) / rows;

  const slots: LayoutSlot[] = [];
  let slotIndex = 0;
  for (let row = 0; row < rows && slotIndex < count; row += 1) {
    const remaining = count - slotIndex;
    const itemsInRow = Math.min(cols, remaining);
    const isPartialLastRow = row === rows - 1 && itemsInRow < cols;
    const rowWidth = itemsInRow * cellWidth + Math.max(0, itemsInRow - 1) * gap;
    const rowStartX = isPartialLastRow
      ? bounds.x + (bounds.width - rowWidth) / 2
      : bounds.x;
    const rowY = bounds.y + row * (cellHeight + gap);

    for (let col = 0; col < itemsInRow; col += 1) {
      const frame = normalizeRect({
        x: rowStartX + col * (cellWidth + gap),
        y: rowY,
        width: cellWidth,
        height: cellHeight
      });
      const role: "hero" | "photo" =
        roleStrategy === "heroFirst" && slotIndex === 0 ? "hero" : "photo";
      slots.push(makeDefaultSlot(`slot-${slotIndex + 1}`, role, frame));
      slotIndex += 1;
    }
  }
  return slots;
}

export function snapRectToValid(args: {
  candidate: RectN;
  bounds: RectN;
  lockedRects: RectN[];
  gap: number;
  iterations?: number;
}): { ok: boolean; rect?: RectN; reason?: string } {
  const { candidate, bounds, lockedRects, gap, iterations = 50 } = args;
  if (candidate.width > bounds.width + EPS || candidate.height > bounds.height + EPS) {
    return { ok: false, reason: "too_large_for_bounds" };
  }
  const pad = gap / 2;
  const inflatedLocked = lockedRects.map((rect) => inflate(rect, pad));
  let rect = clampToBounds(candidate, bounds);

  for (let step = 0; step < iterations; step += 1) {
    const inflated = inflate(rect, pad);
    let worst: { dx: number; dy: number; penetration: number } | null = null;
    for (const lock of inflatedLocked) {
      const separation = minSeparationVector(inflated, lock);
      if (separation.penetration > (worst?.penetration ?? 0)) {
        worst = separation;
      }
    }
    if (!worst || worst.penetration <= EPS) {
      return { ok: true, rect };
    }
    rect = clampToBounds(
      {
        ...rect,
        x: rect.x + worst.dx,
        y: rect.y + worst.dy
      },
      bounds
    );
  }

  const inflated = inflate(rect, pad);
  const hasOverlap = inflatedLocked.some((lock) => intersects(inflated, lock));
  if (hasOverlap) {
    return { ok: false, reason: "no_valid_position" };
  }
  return { ok: true, rect };
}

export function validateUserPlacement(options: {
  pageBounds: RectN;
  gap: number;
  candidateRect: RectN;
  lockedRects: RectN[];
  selfId?: string;
}): { ok: boolean; reason?: string; corrected?: RectN } {
  const { pageBounds, gap, candidateRect, lockedRects } = options;
  const usableBounds = insetBounds(pageBounds, gap);
  const corrected = clampToBounds(candidateRect, usableBounds);
  if (!boundsEqual(candidateRect, corrected)) {
    return {
      ok: false,
      reason: "out_of_bounds",
      corrected
    };
  }
  const snap = snapRectToValid({
    candidate: corrected,
    bounds: usableBounds,
    lockedRects,
    gap
  });
  if (!snap.ok || !snap.rect) {
    return {
      ok: false,
      reason: "overlap_locked",
      corrected
    };
  }
  return { ok: true, corrected };
}

export function recomputeFrames(
  input: EngineInput,
  params: Partial<EngineParams> = {}
): EngineOutput {
  const cfg: EngineParams = { ...DEFAULT_ENGINE_PARAMS, ...params };
  const gap = Math.max(0, Math.min(0.08, cfg.gap));
  const pageBounds = { x: 0, y: 0, width: 1, height: 1 };
  const usableBounds = insetBounds(pageBounds, gap);
  const rolesById = buildRolesById(input.baseSlots);

  const previousById: Record<string, RectN> = Object.fromEntries(
    input.baseSlots.map((slot) => {
      const previous = input.previousFramesById[slot.id] ?? slot.frame;
      return [slot.id, clampToBounds(normalizeRect(previous), usableBounds)] as const;
    })
  );

  const lockedIds = input.baseSlots
    .map((slot) => slot.id)
    .filter((slotId) => isUserLocked(slotId, input.userLockedOverridesById));

  const lockedFramesById: Record<string, RectN> = Object.fromEntries(
    lockedIds.map((slotId) => {
      const base = previousById[slotId];
      const override = input.userLockedOverridesById[slotId];
      const frame = clampToBounds(normalizeRect(mergeRectWithOverride(base, override)), usableBounds);
      return [slotId, frame] as const;
    })
  );

  const autoSlots = input.baseSlots.filter((slot) => !lockedIds.includes(slot.id));
  const lockedRects = [...Object.values(lockedFramesById), ...(input.obstacles ?? [])];
  const freeArea = subtractAreas(usableBounds.width * usableBounds.height, lockedRects);

  if (autoSlots.length === 0) {
    return {
      framesBySlotId: { ...previousById, ...lockedFramesById },
      score: 0,
      fill: 0,
      move: 0,
      slackImbalance: 0,
      centroidError: 0,
      axisError: 0,
      alignBonus: 0,
      usedScale: 1,
      hadOverlaps: false
    };
  }

  let bestValid: {
    framesBySlotId: Record<string, RectN>;
    score: number;
    fill: number;
    move: number;
    slackImbalance: number;
    centroidError: number;
    axisError: number;
    alignBonus: number;
    usedScale: number;
    hadOverlaps: boolean;
  } | null = null;
  let bestInvalid: {
    framesBySlotId: Record<string, RectN>;
    score: number;
    fill: number;
    move: number;
    slackImbalance: number;
    centroidError: number;
    axisError: number;
    alignBonus: number;
    usedScale: number;
    hadOverlaps: boolean;
  } | null = null;

  const scaleCandidates = buildScaleCandidates(cfg.scales);
  const evaluateScales = (scales: number[]): void => {
    for (const scale of scales) {
      const autos = autoSlots.map((slot) => {
        const baseFrame = previousById[slot.id];
        const meta = resolveMeta(slot.id, baseFrame, input.metasById);
        const area = Math.max(EPS, meta.weight * scale);
        const width = Math.sqrt(area * meta.baseAspect);
        const height = width / meta.baseAspect;
        const startCenter = {
          x: baseFrame.x + baseFrame.width / 2,
          y: baseFrame.y + baseFrame.height / 2
        };
        return {
          id: slot.id,
          width,
          height,
          startCenter,
          preferredCenter: meta.preferredCenter ?? startCenter
        };
      });

      const solved = solvePlacement({
        bounds: usableBounds,
        gap,
        autos,
        lockedRects,
        iterations: cfg.iterations,
        springK: cfg.springK,
        epsilon: cfg.epsilon
      });

      const framesBySlotId: Record<string, RectN> = {
        ...previousById,
        ...lockedFramesById,
        ...solved.rectsById
      };

      const autoRects = autos
        .map((item) => framesBySlotId[item.id])
        .filter((rect): rect is RectN => Boolean(rect));
      const isValid = !solved.hadOverlaps && solved.outOfBounds <= cfg.epsilon && solved.residual <= cfg.epsilon;
      const score = scoreCandidate({
        wFill: cfg.wFill,
        wMove: resolveMoveWeight(cfg),
        wSlack: resolveSlackWeight(cfg),
        wCentroid: cfg.wCentroid,
        wAxis: cfg.wAxis,
        wAlign: cfg.wAlign,
        centroidTargetY: cfg.centroidTargetY,
        alignTol: cfg.alignTol ?? gap * 0.5,
        autoIds: autos.map((item) => item.id),
        previousById,
        nextById: framesBySlotId,
        rolesById,
        usableBounds,
        autoRects,
        allRects: Object.values(framesBySlotId),
        freeArea,
        overlapResidual: Math.max(0, solved.residual - solved.outOfBounds),
        outOfBounds: solved.outOfBounds,
        isValid
      });

      const candidate = {
        framesBySlotId,
        score: score.score,
        fill: score.fill,
        move: score.move,
        slackImbalance: score.slackImbalance,
        centroidError: score.centroidError,
        axisError: score.axisError,
        alignBonus: score.alignBonus,
        usedScale: scale,
        hadOverlaps: !isValid
      };
      if (isValid) {
        if (!bestValid || candidate.score > bestValid.score) {
          bestValid = candidate;
        }
      } else if (!bestInvalid || candidate.score > bestInvalid.score) {
        bestInvalid = candidate;
      }
    }
  };

  evaluateScales(scaleCandidates.preferred);
  if (!bestValid && scaleCandidates.fallback.length > 0) {
    evaluateScales(scaleCandidates.fallback);
  }

  return (
    bestValid ?? bestInvalid ?? {
      framesBySlotId: { ...previousById, ...lockedFramesById },
      score: Number.NEGATIVE_INFINITY,
      fill: 0,
      move: 0,
      slackImbalance: 1,
      centroidError: 1,
      axisError: 1,
      alignBonus: 0,
      usedScale: 1,
      hadOverlaps: true
    }
  );
}

export function enhanceLayout(
  input: EngineInput,
  params: Partial<EngineParams> = {},
  enhance: Partial<EnhanceParams> = {}
): EngineOutput {
  const cfg: EngineParams = { ...DEFAULT_ENGINE_PARAMS, ...params };
  const enh: EnhanceParams = { ...DEFAULT_ENHANCE_PARAMS, ...enhance };
  const target = { x: 0.5, y: cfg.centroidTargetY };
  const usableBounds = insetBounds({ x: 0, y: 0, width: 1, height: 1 }, cfg.gap);
  const baseOutput = recomputeFrames(input, cfg);
  if (baseOutput.hadOverlaps) {
    return baseOutput;
  }

  const lockedIds = input.baseSlots
    .map((slot) => slot.id)
    .filter((id) => hasGeometryOverride(input.userLockedOverridesById[id]));
  if (lockedIds.length === 0) {
    return baseOutput;
  }

  const rolesById = buildRolesById(input.baseSlots);
  const originalFramesById: Record<string, RectN> = Object.fromEntries(
    lockedIds.map((id) => [id, baseOutput.framesBySlotId[id]] as const)
  );

  const sortedLocked = [...lockedIds].sort((a, b) => {
    const heroA = rolesById[a] === "hero" ? 1 : 0;
    const heroB = rolesById[b] === "hero" ? 1 : 0;
    if (enh.preferHero && heroA !== heroB) {
      return heroB - heroA;
    }
    const areaA = baseOutput.framesBySlotId[a].width * baseOutput.framesBySlotId[a].height;
    const areaB = baseOutput.framesBySlotId[b].width * baseOutput.framesBySlotId[b].height;
    return areaB - areaA;
  });

  const candidateLockedIds = sortedLocked
    .filter((id, index) => {
      if (index === 0) {
        return true;
      }
      if (!enh.onlyNearCenter) {
        return true;
      }
      const c = rectCenter(baseOutput.framesBySlotId[id]);
      return Math.hypot(c.x - target.x, c.y - target.y) <= enh.nearCenterThreshold;
    })
    .slice(0, 3);
  if (candidateLockedIds.length === 0) {
    return baseOutput;
  }

  let currentOutput = baseOutput;
  let currentOverrides = { ...input.userLockedOverridesById };
  const obstacleRects = input.obstacles ?? [];

  const isWithinLimits = (candidate: RectN, original: RectN): boolean => {
    const c0 = rectCenter(original);
    const c1 = rectCenter(candidate);
    const move = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    if (move > enh.maxLockedMove + EPS) {
      return false;
    }
    const area0 = Math.max(EPS, original.width * original.height);
    const area1 = Math.max(EPS, candidate.width * candidate.height);
    const scaleDelta = Math.abs(area1 / area0 - 1);
    return scaleDelta <= enh.maxLockedScale + EPS;
  };

  const buildProposals = (baseRect: RectN): RectN[] => {
    const steps = [0, -enh.maxLockedMove / 2, enh.maxLockedMove / 2, -enh.maxLockedMove, enh.maxLockedMove];
    const scales = [1, 1 - enh.maxLockedScale / 2, 1 + enh.maxLockedScale / 2, 1 - enh.maxLockedScale, 1 + enh.maxLockedScale];
    const proposals: RectN[] = [];
    const targetDelta = {
      dx: clamp(target.x - rectCenter(baseRect).x, -enh.maxLockedMove, enh.maxLockedMove),
      dy: clamp(target.y - rectCenter(baseRect).y, -enh.maxLockedMove, enh.maxLockedMove)
    };
    for (const scale of scales) {
      const scaled = scaleRectFromCenter(baseRect, scale);
      for (const dx of [...steps, targetDelta.dx]) {
        for (const dy of [...steps, targetDelta.dy]) {
          proposals.push(
            clampToBounds(
              {
                ...scaled,
                x: scaled.x + dx,
                y: scaled.y + dy
              },
              usableBounds
            )
          );
        }
      }
    }
    return proposals;
  };

  for (let iter = 0; iter < enh.iterations; iter += 1) {
    let improved = false;

    for (const slotId of candidateLockedIds) {
      const currentRect = currentOutput.framesBySlotId[slotId];
      const originalRect = originalFramesById[slotId];
      if (!currentRect || !originalRect) {
        continue;
      }
      let bestLocal = currentOutput;
      let bestRect: RectN | undefined;
      const proposals = buildProposals(currentRect);

      for (const proposal of proposals) {
        if (!isWithinLimits(proposal, originalRect)) {
          continue;
        }
        const otherLockedRects = lockedIds
          .filter((id) => id !== slotId)
          .map((id) => currentOutput.framesBySlotId[id])
          .filter((rect): rect is RectN => Boolean(rect));
        const snapped = snapRectToValid({
          candidate: proposal,
          bounds: usableBounds,
          lockedRects: [...otherLockedRects, ...obstacleRects],
          gap: cfg.gap
        });
        if (!snapped.ok || !snapped.rect) {
          continue;
        }

        const trialOverrides = {
          ...currentOverrides,
          [slotId]: {
            ...(currentOverrides[slotId] ?? {}),
            x: snapped.rect.x,
            y: snapped.rect.y,
            width: snapped.rect.width,
            height: snapped.rect.height
          }
        };
        const trialOutput = recomputeFrames(
          {
            ...input,
            previousFramesById: currentOutput.framesBySlotId,
            userLockedOverridesById: trialOverrides
          },
          cfg
        );
        if (trialOutput.hadOverlaps) {
          continue;
        }
        if (trialOutput.score > bestLocal.score + 1e-6) {
          bestLocal = trialOutput;
          bestRect = snapped.rect;
        }
      }

      if (bestRect) {
        currentOverrides = {
          ...currentOverrides,
          [slotId]: {
            ...(currentOverrides[slotId] ?? {}),
            x: bestRect.x,
            y: bestRect.y,
            width: bestRect.width,
            height: bestRect.height
          }
        };
        currentOutput = bestLocal;
        improved = true;
      }
    }
    if (!improved) {
      break;
    }
  }

  return currentOutput;
}

export function framesToSlotOverrides(
  baseSlots: { id: string; frame: RectN }[],
  nextFramesById: Record<string, RectN>
): Record<string, SlotOverride> {
  const result: Record<string, SlotOverride> = {};
  for (const slot of baseSlots) {
    const next = nextFramesById[slot.id];
    if (!next) {
      continue;
    }
    const changed =
      Math.abs(next.x - slot.frame.x) > EPS ||
      Math.abs(next.y - slot.frame.y) > EPS ||
      Math.abs(next.width - slot.frame.width) > EPS ||
      Math.abs(next.height - slot.frame.height) > EPS;
    if (changed) {
      result[slot.id] = {
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height
      };
    }
  }
  return result;
}
