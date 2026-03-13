export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DragLifecycle = "idle" | "pressing" | "dragging" | "dropping" | "canceling";

export type DragType = "page-photo" | "gallery-photo" | "page-thumbnail";

export type DragPreviewData =
  | {
      kind: "photo";
      uri: string;
    }
  | {
      kind: "page-thumbnail";
      label: string;
      backgroundColor?: string;
      blocks: Rect[];
    };

export type DragPayload = {
  dragType: DragType;
  itemId: string;
  sourcePageId?: string;
  sourceSlotId?: string;
  sourceGalleryIndex?: number;
  sourcePageIndex?: number;
  sourceRect: Rect;
  previewData: DragPreviewData;
};

export type DropTargetType =
  | "page-slot"
  | "page-photo"
  | "page-canvas"
  | "gallery-strip"
  | "gallery-remove"
  | "gallery-photo"
  | "page-thumbnail-gap"
  | "none";

export type DropTarget = {
  id: string;
  targetType: DropTargetType;
  rect: Rect;
  priority: number;
  targetPageId?: string;
  targetSlotId?: string;
  targetPhotoId?: string;
  targetGalleryIndex?: number;
  targetPageIndex?: number;
  hitSlop?: number;
  stickySlop?: number;
};

export type DragResolution =
  | { action: "swap-page-photo"; sourcePageId: string; sourceSlotId: string; targetPageId: string; targetSlotId: string }
  | { action: "move-page-photo"; sourcePageId: string; sourceSlotId: string; targetPageId: string; targetSlotId: string }
  | { action: "remove-to-gallery"; sourcePageId: string; sourceSlotId: string }
  | { action: "swap-with-gallery-photo"; sourcePageId: string; sourceSlotId: string; targetPhotoId: string }
  | { action: "add-to-page"; targetPageId: string; photoId: string }
  | { action: "swap-with-page-photo"; targetPageId: string; targetSlotId: string; photoId: string }
  | { action: "reorder-page"; pageId: string; fromIndex: number; toIndex: number }
  | { action: "cancel" };

export type DragSession = {
  lifecycle: DragLifecycle;
  payload?: DragPayload;
  startPoint?: Point;
  currentPoint?: Point;
  hoveredTarget?: DropTarget;
  resolution?: DragResolution;
  grabOffset?: Point;
};
