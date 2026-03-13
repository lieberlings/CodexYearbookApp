import { DragPayload, DragResolution, DropTarget, Rect } from "./types";

export function resolveDropAction(payload: DragPayload, target?: DropTarget): DragResolution {
  if (!payload || !target) {
    return { action: "cancel" };
  }

  if (payload.dragType === "page-thumbnail") {
    if (target.targetType !== "page-thumbnail-gap" || target.targetPageIndex === undefined || payload.sourcePageIndex === undefined) {
      return { action: "cancel" };
    }
    return {
      action: "reorder-page",
      pageId: payload.itemId,
      fromIndex: payload.sourcePageIndex,
      toIndex: target.targetPageIndex
    };
  }

  if (payload.dragType === "page-photo") {
    if (!payload.sourcePageId || !payload.sourceSlotId) {
      return { action: "cancel" };
    }
    if (target.targetType === "page-photo" && target.targetPageId && target.targetSlotId) {
      if (target.targetPageId === payload.sourcePageId && target.targetSlotId === payload.sourceSlotId) {
        return { action: "cancel" };
      }
      return {
        action: "swap-page-photo",
        sourcePageId: payload.sourcePageId,
        sourceSlotId: payload.sourceSlotId,
        targetPageId: target.targetPageId,
        targetSlotId: target.targetSlotId
      };
    }
    if (target.targetType === "page-slot" && target.targetPageId && target.targetSlotId) {
      if (target.targetPageId === payload.sourcePageId && target.targetSlotId === payload.sourceSlotId) {
        return { action: "cancel" };
      }
      return {
        action: "move-page-photo",
        sourcePageId: payload.sourcePageId,
        sourceSlotId: payload.sourceSlotId,
        targetPageId: target.targetPageId,
        targetSlotId: target.targetSlotId
      };
    }
    if (target.targetType === "gallery-photo" && target.targetPhotoId) {
      return {
        action: "swap-with-gallery-photo",
        sourcePageId: payload.sourcePageId,
        sourceSlotId: payload.sourceSlotId,
        targetPhotoId: target.targetPhotoId
      };
    }
    if (target.targetType === "gallery-strip" || target.targetType === "gallery-remove") {
      return {
        action: "remove-to-gallery",
        sourcePageId: payload.sourcePageId,
        sourceSlotId: payload.sourceSlotId
      };
    }
    return { action: "cancel" };
  }

  if (target.targetType === "page-photo" && target.targetPageId && target.targetSlotId) {
    return {
      action: "swap-with-page-photo",
      targetPageId: target.targetPageId,
      targetSlotId: target.targetSlotId,
      photoId: payload.itemId
    };
  }

  if (
    (target.targetType === "page-slot" || target.targetType === "page-canvas") &&
    target.targetPageId
  ) {
    return {
      action: "add-to-page",
      targetPageId: target.targetPageId,
      photoId: payload.itemId
    };
  }

  return { action: "cancel" };
}

export function getSettleRect(payload: DragPayload, target?: DropTarget): Rect {
  if (!target) {
    return payload.sourceRect;
  }
  return target.rect;
}
