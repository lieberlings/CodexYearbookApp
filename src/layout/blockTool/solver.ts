import { center, clampToBounds, inflate, minSeparationVector } from "./geometry";
import { RectN, SolverInput, SolverOutput } from "./types";

function toRectFromCenter(cx: number, cy: number, width: number, height: number): RectN {
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height
  };
}

function maxOutOfBoundsDistance(rect: RectN, bounds: RectN): number {
  const left = Math.max(0, bounds.x - rect.x);
  const top = Math.max(0, bounds.y - rect.y);
  const right = Math.max(0, rect.x + rect.width - (bounds.x + bounds.width));
  const bottom = Math.max(0, rect.y + rect.height - (bounds.y + bounds.height));
  return Math.max(left, top, right, bottom);
}

function computeOverlapResidual(autos: RectN[], locked: RectN[]): number {
  let maxPenetration = 0;
  for (let i = 0; i < autos.length; i += 1) {
    for (let j = i + 1; j < autos.length; j += 1) {
      const sep = minSeparationVector(autos[i], autos[j]);
      if (sep.penetration > maxPenetration) {
        maxPenetration = sep.penetration;
      }
    }
    for (const lock of locked) {
      const sep = minSeparationVector(autos[i], lock);
      if (sep.penetration > maxPenetration) {
        maxPenetration = sep.penetration;
      }
    }
  }
  return maxPenetration;
}

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

function recenterAutos(
  autos: { rect: RectN }[],
  bounds: RectN
): void {
  const bbox = boundsOfRects(autos.map((item) => item.rect));
  if (!bbox) {
    return;
  }
  const leftSlack = Math.max(0, bbox.x - bounds.x);
  const rightSlack = Math.max(0, bounds.x + bounds.width - (bbox.x + bbox.width));
  const topSlack = Math.max(0, bbox.y - bounds.y);
  const bottomSlack = Math.max(0, bounds.y + bounds.height - (bbox.y + bbox.height));
  const dx = (rightSlack - leftSlack) / 2;
  const dy = (bottomSlack - topSlack) / 2;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return;
  }
  for (const auto of autos) {
    auto.rect = clampToBounds(
      {
        ...auto.rect,
        x: auto.rect.x + dx,
        y: auto.rect.y + dy
      },
      bounds
    );
  }
}

export function solvePlacement(input: SolverInput): SolverOutput {
  const {
    bounds,
    gap,
    autos,
    lockedRects,
    iterations,
    springK,
    epsilon
  } = input;
  const inflation = gap / 2;

  const autoState = autos.map((slot) => {
    const startRect = toRectFromCenter(
      slot.startCenter.x,
      slot.startCenter.y,
      slot.width,
      slot.height
    );
    return {
      id: slot.id,
      rect: clampToBounds(startRect, bounds),
      preferredCenter: slot.preferredCenter
    };
  });

  const inflatedLocked = lockedRects.map((rect) => inflate(rect, inflation));
  let overlapResidual = Number.POSITIVE_INFINITY;
  let outOfBounds = Number.POSITIVE_INFINITY;

  for (let iter = 0; iter < iterations; iter += 1) {
    for (const auto of autoState) {
      auto.rect = clampToBounds(auto.rect, bounds);
    }

    for (let i = 0; i < autoState.length; i += 1) {
      const ai = autoState[i];
      const aiInflated = inflate(ai.rect, inflation);

      for (const lock of inflatedLocked) {
        const sep = minSeparationVector(aiInflated, lock);
        if (sep.penetration > 0) {
          ai.rect = {
            ...ai.rect,
            x: ai.rect.x + sep.dx,
            y: ai.rect.y + sep.dy
          };
        }
      }
      ai.rect = clampToBounds(ai.rect, bounds);
    }

    for (let i = 0; i < autoState.length; i += 1) {
      for (let j = i + 1; j < autoState.length; j += 1) {
        const ai = autoState[i];
        const aj = autoState[j];
        const sep = minSeparationVector(inflate(ai.rect, inflation), inflate(aj.rect, inflation));
        if (sep.penetration > 0) {
          ai.rect = {
            ...ai.rect,
            x: ai.rect.x + sep.dx * 0.5,
            y: ai.rect.y + sep.dy * 0.5
          };
          aj.rect = {
            ...aj.rect,
            x: aj.rect.x - sep.dx * 0.5,
            y: aj.rect.y - sep.dy * 0.5
          };
        }
      }
      autoState[i].rect = clampToBounds(autoState[i].rect, bounds);
    }

    for (const auto of autoState) {
      const c = center(auto.rect);
      const dx = auto.preferredCenter.x - c.x;
      const dy = auto.preferredCenter.y - c.y;
      auto.rect = {
        ...auto.rect,
        x: auto.rect.x + dx * springK,
        y: auto.rect.y + dy * springK
      };
      auto.rect = clampToBounds(auto.rect, bounds);
    }

    overlapResidual = computeOverlapResidual(
      autoState.map((item) => inflate(item.rect, inflation)),
      inflatedLocked
    );
    outOfBounds = autoState.reduce((maxDistance, item) => {
      return Math.max(maxDistance, maxOutOfBoundsDistance(item.rect, bounds));
    }, 0);
    if (overlapResidual < epsilon && outOfBounds < epsilon) {
      break;
    }
  }

  // Spread leftover whitespace more evenly after overlap resolution.
  recenterAutos(autoState, bounds);

  // Short stabilization pass after recenter shift.
  for (let iter = 0; iter < 24; iter += 1) {
    for (const auto of autoState) {
      auto.rect = clampToBounds(auto.rect, bounds);
    }
    for (let i = 0; i < autoState.length; i += 1) {
      const ai = autoState[i];
      const aiInflated = inflate(ai.rect, inflation);
      for (const lock of inflatedLocked) {
        const sep = minSeparationVector(aiInflated, lock);
        if (sep.penetration > 0) {
          ai.rect = {
            ...ai.rect,
            x: ai.rect.x + sep.dx,
            y: ai.rect.y + sep.dy
          };
        }
      }
      ai.rect = clampToBounds(ai.rect, bounds);
    }
    for (let i = 0; i < autoState.length; i += 1) {
      for (let j = i + 1; j < autoState.length; j += 1) {
        const ai = autoState[i];
        const aj = autoState[j];
        const sep = minSeparationVector(inflate(ai.rect, inflation), inflate(aj.rect, inflation));
        if (sep.penetration > 0) {
          ai.rect = {
            ...ai.rect,
            x: ai.rect.x + sep.dx * 0.5,
            y: ai.rect.y + sep.dy * 0.5
          };
          aj.rect = {
            ...aj.rect,
            x: aj.rect.x - sep.dx * 0.5,
            y: aj.rect.y - sep.dy * 0.5
          };
        }
      }
      autoState[i].rect = clampToBounds(autoState[i].rect, bounds);
    }
  }
  overlapResidual = computeOverlapResidual(
    autoState.map((item) => inflate(item.rect, inflation)),
    inflatedLocked
  );
  outOfBounds = autoState.reduce((maxDistance, item) => {
    return Math.max(maxDistance, maxOutOfBoundsDistance(item.rect, bounds));
  }, 0);

  return {
    rectsById: Object.fromEntries(autoState.map((item) => [item.id, item.rect] as const)),
    residual: overlapResidual + outOfBounds,
    outOfBounds,
    hadOverlaps: overlapResidual > epsilon
  };
}
