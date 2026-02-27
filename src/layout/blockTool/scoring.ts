import { center } from "./geometry";
import { RectN } from "./types";

type ScoreInput = {
  wFill: number;
  wMove: number;
  wSlack: number;
  wCentroid: number;
  wAxis: number;
  wAlign: number;
  centroidTargetY: number;
  alignTol: number;
  autoIds: string[];
  previousById: Record<string, RectN>;
  nextById: Record<string, RectN>;
  rolesById: Record<string, "hero" | "photo">;
  usableBounds: RectN;
  autoRects: RectN[];
  allRects: RectN[];
  freeArea: number;
  overlapResidual: number;
  outOfBounds: number;
  isValid: boolean;
};

export type ScoreResult = {
  fill: number;
  move: number;
  slackImbalance: number;
  centroidError: number;
  axisError: number;
  alignBonus: number;
  score: number;
};

function boundsOfRects(rects: RectN[]): RectN | undefined {
  if (rects.length === 0) {
    return undefined;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

export function computeSlackImbalance(usableBounds: RectN, placedRects: RectN[]): number {
  const bbox = boundsOfRects(placedRects);
  if (!bbox) {
    return 0;
  }
  const leftSlack = Math.max(0, bbox.x - usableBounds.x);
  const rightSlack = Math.max(0, usableBounds.x + usableBounds.width - (bbox.x + bbox.width));
  const topSlack = Math.max(0, bbox.y - usableBounds.y);
  const bottomSlack = Math.max(0, usableBounds.y + usableBounds.height - (bbox.y + bbox.height));
  const slacks = [leftSlack, rightSlack, topSlack, bottomSlack];
  return Math.max(...slacks) - Math.min(...slacks);
}

export function computeAreaWeightedCentroid(
  framesById: Record<string, RectN>,
  rolesById: Record<string, "hero" | "photo">
): { x: number; y: number } {
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  for (const [id, rect] of Object.entries(framesById)) {
    const roleWeight = rolesById[id] === "hero" ? 1.25 : 1;
    const weight = Math.max(1e-6, rect.width * rect.height * roleWeight);
    const c = center(rect);
    weightedX += c.x * weight;
    weightedY += c.y * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 1e-6) {
    return { x: 0.5, y: 0.5 };
  }
  return { x: weightedX / totalWeight, y: weightedY / totalWeight };
}

function computeAxisError(allRects: RectN[]): number {
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  let total = 0;
  for (const rect of allRects) {
    const area = Math.max(1e-6, rect.width * rect.height);
    const c = center(rect);
    if (c.x < 0.5) {
      left += area;
    } else {
      right += area;
    }
    if (c.y < 0.5) {
      top += area;
    } else {
      bottom += area;
    }
    total += area;
  }
  if (total <= 1e-6) {
    return 0;
  }
  const lr = (left - right) / total;
  const tb = (top - bottom) / total;
  return lr * lr + tb * tb;
}

function computeAlignBonus(allRects: RectN[], tol: number): number {
  if (allRects.length < 2) {
    return 0;
  }
  const safeTol = Math.max(1e-4, tol);
  let bonus = 0;
  const maxPairs = (allRects.length * (allRects.length - 1)) / 2;
  for (let i = 0; i < allRects.length; i += 1) {
    const a = allRects[i];
    const ax = center(a).x;
    const ay = center(a).y;
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    for (let j = i + 1; j < allRects.length; j += 1) {
      const b = allRects[j];
      const bx = center(b).x;
      const by = center(b).y;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;

      if (Math.abs(a.x - b.x) <= safeTol) {
        bonus += 1;
      }
      if (Math.abs(aRight - bRight) <= safeTol) {
        bonus += 1;
      }
      if (Math.abs(ax - bx) <= safeTol) {
        bonus += 1;
      }
      if (Math.abs(a.y - b.y) <= safeTol) {
        bonus += 1;
      }
      if (Math.abs(aBottom - bBottom) <= safeTol) {
        bonus += 1;
      }
      if (Math.abs(ay - by) <= safeTol) {
        bonus += 1;
      }
    }
  }
  return Math.min(bonus / Math.max(1, maxPairs * 6), 1);
}

export function scoreCandidate(input: ScoreInput): ScoreResult {
  const {
    wFill,
    wMove,
    wSlack,
    wCentroid,
    wAxis,
    wAlign,
    centroidTargetY,
    alignTol,
    autoIds,
    previousById,
    nextById,
    rolesById,
    usableBounds,
    autoRects,
    allRects,
    freeArea,
    overlapResidual,
    outOfBounds,
    isValid
  } = input;
  if (autoIds.length === 0) {
    return {
      fill: 0,
      move: 0,
      slackImbalance: 0,
      centroidError: 0,
      axisError: 0,
      alignBonus: 0,
      score: isValid ? 0 : Number.NEGATIVE_INFINITY
    };
  }

  const totalArea = autoIds.reduce((sum, id) => {
    const rect = nextById[id];
    if (!rect) {
      return sum;
    }
    return sum + rect.width * rect.height;
  }, 0);
  const fill = freeArea > 0 ? totalArea / freeArea : 0;

  const diagonal = Math.sqrt(2);
  const move = autoIds.reduce((sum, id) => {
    const prev = previousById[id];
    const next = nextById[id];
    if (!prev || !next) {
      return sum;
    }
    const c1 = center(prev);
    const c2 = center(next);
    const distance = Math.hypot(c2.x - c1.x, c2.y - c1.y);
    return sum + distance / diagonal;
  }, 0) / autoIds.length;

  const slackImbalance = computeSlackImbalance(usableBounds, autoRects);
  const centroid = computeAreaWeightedCentroid(nextById, rolesById);
  const centroidError =
    (centroid.x - 0.5) * (centroid.x - 0.5) +
    (centroid.y - centroidTargetY) * (centroid.y - centroidTargetY);
  const axisError = computeAxisError(allRects);
  const alignBonus = computeAlignBonus(allRects, alignTol);
  const overlapPenalty = overlapResidual * 220;
  const outOfBoundsPenalty = outOfBounds * 320;
  if (!isValid) {
    return {
      fill,
      move,
      slackImbalance,
      centroidError,
      axisError,
      alignBonus,
      score: -1e9 - overlapPenalty - outOfBoundsPenalty
    };
  }
  return {
    fill,
    move,
    slackImbalance,
    centroidError,
    axisError,
    alignBonus,
    score:
      wFill * fill -
      wMove * move -
      wSlack * slackImbalance -
      wCentroid * centroidError -
      wAxis * axisError +
      wAlign * alignBonus -
      overlapPenalty -
      outOfBoundsPenalty
  };
}
