import { LayoutPage } from "./schemas";
import { SlotOverride } from "../state/editorStore";

export function applySlotOverridesToPage(
  page: LayoutPage,
  overrides?: Record<string, SlotOverride>
): LayoutPage {
  if (!overrides) {
    return page;
  }
  return {
    ...page,
    slots: page.slots.map((slot) => {
      const patch = overrides[slot.id];
      if (!patch) {
        return slot;
      }
      return {
        ...slot,
        photoId: patch.photoId !== undefined ? patch.photoId ?? undefined : slot.photoId,
        fitMode: patch.fitMode ?? slot.fitMode,
        photoScale: patch.photoScale ?? slot.photoScale,
        photoOffsetX: patch.photoOffsetX ?? slot.photoOffsetX,
        photoOffsetY: patch.photoOffsetY ?? slot.photoOffsetY,
        frame: {
          x: patch.x ?? slot.frame.x,
          y: patch.y ?? slot.frame.y,
          width: patch.width ?? slot.frame.width,
          height: patch.height ?? slot.frame.height
        }
      };
    })
  };
}
