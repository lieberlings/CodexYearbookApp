export type PhotoLike = {
  width?: number;
  height?: number;
};

export type SlotFitMode = "contain" | "cover";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getPhotoScaleBounds(fitMode: SlotFitMode) {
  return fitMode === "cover" ? { min: 1, max: 6 } : { min: 0.5, max: 6 };
}

export function getPhotoAspect(photo?: PhotoLike) {
  const width = photo?.width ?? 0;
  const height = photo?.height ?? 0;
  if (width <= 0 || height <= 0) {
    return 1;
  }
  return width / height;
}

function getPhotoBaseScale(containerAspect: number, imageAspect: number, fitMode: SlotFitMode) {
  if (fitMode === "cover") {
    if (imageAspect > containerAspect) {
      return { width: imageAspect / containerAspect, height: 1 };
    }
    return { width: 1, height: containerAspect / Math.max(0.0001, imageAspect) };
  }
  if (imageAspect > containerAspect) {
    return { width: 1, height: containerAspect / Math.max(0.0001, imageAspect) };
  }
  return { width: imageAspect / Math.max(0.0001, containerAspect), height: 1 };
}

export function getPhotoRenderMetrics({
  containerAspect,
  imageAspect,
  fitMode,
  scale,
  offsetX,
  offsetY
}: {
  containerAspect: number;
  imageAspect: number;
  fitMode: SlotFitMode;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const base = getPhotoBaseScale(containerAspect, imageAspect, fitMode);
  const width = base.width * scale;
  const height = base.height * scale;
  const maxOffsetX = fitMode === "cover" ? Math.max(0, (width - 1) / 2) : 1;
  const maxOffsetY = fitMode === "cover" ? Math.max(0, (height - 1) / 2) : 1;
  const safeOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
  const safeOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);
  return {
    width,
    height,
    offsetX: safeOffsetX,
    offsetY: safeOffsetY,
    leftPercent: 50 - width * 50 + safeOffsetX * 100,
    topPercent: 50 - height * 50 + safeOffsetY * 100
  };
}

export function clampPhotoOffset(
  axis: "x" | "y",
  offset: number,
  scale: number,
  fitMode: SlotFitMode,
  containerAspect: number,
  imageAspect: number
) {
  if (fitMode !== "cover") {
    return clamp(offset, -1, 1);
  }
  const metrics = getPhotoRenderMetrics({
    containerAspect,
    imageAspect,
    fitMode,
    scale,
    offsetX: axis === "x" ? offset : 0,
    offsetY: axis === "y" ? offset : 0
  });
  return axis === "x" ? metrics.offsetX : metrics.offsetY;
}
