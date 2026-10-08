import { useState } from "react";
import { View } from "react-native";
import { buildLayoutPage } from "../layout/engine";
import { applySlotOverridesToPage } from "../layout/overrides";
import type { Memory, MemoryPageSection, PhotoItem } from "../types";
import type { SlotOverride } from "../state/editorStore";
import { BookPageCanvas } from "./BookPageCanvas";

export function BookPartPreview({ memory, section, photos, overrides }: {
  memory: Memory; section: MemoryPageSection; photos: PhotoItem[]; overrides?: Record<string, SlotOverride>;
}) {
  const [size, setSize] = useState(280);
  const page = applySlotOverridesToPage(buildLayoutPage(memory, section, photos.filter(photo => section.photoIds.includes(photo.id)), 0, 1), overrides);
  return <View pointerEvents="none" onLayout={event => setSize(event.nativeEvent.layout.width)} style={{ width: "100%", aspectRatio: 1, overflow: "hidden", borderRadius: 10 }}>
    <BookPageCanvas page={page} photosById={Object.fromEntries(photos.map(photo => [photo.id, photo]))} size={size} />
  </View>;
}
