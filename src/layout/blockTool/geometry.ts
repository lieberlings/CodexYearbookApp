import { PointN, RectN } from "./types";

export function center(rect: RectN): PointN {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

export function inflate(rect: RectN, pad: number): RectN {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2
  };
}

export function clampToBounds(rect: RectN, bounds: RectN): RectN {
  const width = Math.min(Math.max(rect.width, 0.0001), bounds.width);
  const height = Math.min(Math.max(rect.height, 0.0001), bounds.height);
  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = bounds.x + bounds.width - width;
  const maxY = bounds.y + bounds.height - height;
  return {
    x: Math.min(Math.max(rect.x, minX), maxX),
    y: Math.min(Math.max(rect.y, minY), maxY),
    width,
    height
  };
}

export function intersects(a: RectN, b: RectN): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

type SeparationVector = {
  dx: number;
  dy: number;
  penetration: number;
};

export function minSeparationVector(a: RectN, b: RectN): SeparationVector {
  if (!intersects(a, b)) {
    return { dx: 0, dy: 0, penetration: 0 };
  }

  const aCx = a.x + a.width / 2;
  const aCy = a.y + a.height / 2;
  const bCx = b.x + b.width / 2;
  const bCy = b.y + b.height / 2;

  const overlapX = a.width / 2 + b.width / 2 - Math.abs(aCx - bCx);
  const overlapY = a.height / 2 + b.height / 2 - Math.abs(aCy - bCy);

  if (overlapX <= 0 || overlapY <= 0) {
    return { dx: 0, dy: 0, penetration: 0 };
  }

  if (overlapX < overlapY) {
    const sign = aCx < bCx ? -1 : 1;
    return {
      dx: sign * overlapX,
      dy: 0,
      penetration: overlapX
    };
  }

  const sign = aCy < bCy ? -1 : 1;
  return {
    dx: 0,
    dy: sign * overlapY,
    penetration: overlapY
  };
}
