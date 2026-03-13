import { DragPayload, DropTarget, Point, Rect } from "./types";

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function expandRect(rect: Rect, value: number): Rect {
  return {
    x: rect.x - value,
    y: rect.y - value,
    width: rect.width + value * 2,
    height: rect.height + value * 2
  };
}

function distanceToRectCenter(point: Point, rect: Rect): number {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return Math.hypot(point.x - centerX, point.y - centerY);
}

function acceptsTarget(dragType: DragPayload["dragType"], targetType: DropTarget["targetType"]): boolean {
  if (dragType === "page-thumbnail") {
    return targetType === "page-thumbnail-gap";
  }
  if (dragType === "page-photo") {
    return (
      targetType === "page-slot" ||
      targetType === "page-photo" ||
      targetType === "gallery-strip" ||
      targetType === "gallery-remove" ||
      targetType === "gallery-photo"
    );
  }
  return (
    targetType === "page-slot" ||
    targetType === "page-photo" ||
    targetType === "page-canvas"
  );
}

export class DragTargetRegistry {
  private targets = new Map<string, DropTarget>();

  replace(nextTargets: DropTarget[]) {
    this.targets = new Map(nextTargets.map((target) => [target.id, target] as const));
  }

  clear() {
    this.targets.clear();
  }

  getAll(): DropTarget[] {
    return [...this.targets.values()];
  }
}

export function resolveHoverTarget(
  payload: DragPayload,
  point: Point,
  targets: DropTarget[],
  previous?: DropTarget
): DropTarget | undefined {
  const previousCandidate = previous
    ? targets.find((target) => target.id === previous.id)
    : undefined;

  if (
    previousCandidate &&
    acceptsTarget(payload.dragType, previousCandidate.targetType) &&
    previousCandidate.targetType !== "page-thumbnail-gap" &&
    pointInRect(point, expandRect(previousCandidate.rect, previousCandidate.stickySlop ?? 18))
  ) {
    return previousCandidate;
  }

  return targets
    .filter(
      (target) =>
        acceptsTarget(payload.dragType, target.targetType) &&
        pointInRect(point, expandRect(target.rect, target.hitSlop ?? 10))
    )
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const distanceDelta = distanceToRectCenter(point, a.rect) - distanceToRectCenter(point, b.rect);
      if (Math.abs(distanceDelta) > 0.001) {
        return distanceDelta;
      }
      return a.rect.width * a.rect.height - b.rect.width * b.rect.height;
    })[0];
}
