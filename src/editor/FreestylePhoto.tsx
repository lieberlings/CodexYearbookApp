import { useRef } from "react";
import { Image, PanResponder, View } from "react-native";
import { LayoutSlot } from "../layout/schemas";
import { PhotoItem } from "../types";
import { getPhotoAspect, getPhotoRenderMetrics } from "../layout/photoMetrics";
import { ObjectShape } from "../components/ObjectShape";
import { ObjectHandles } from "./ObjectHandles";

export function FreestylePhoto(props: { slot: LayoutSlot; photo?: PhotoItem; selected: boolean; size: number;
  borderColor: string; borderWidth: number; cornerRadius: number;
  onSelect: () => void; onEdit: () => void; onChange: (slot: LayoutSlot) => void; onBegin: () => void; onEnd: () => void }) {
  const current = useRef(props); current.current = props;
  const origin = useRef(props.slot);
  const selectedAtStart = useRef(false);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      origin.current = current.current.slot; selectedAtStart.current = current.current.selected;
      current.current.onBegin(); current.current.onSelect();
    },
    onPanResponderMove: (_, g) => {
      if (!selectedAtStart.current) return;
      const p = current.current, s = origin.current;
      p.onChange({ ...s, frame: { ...s.frame, x: Math.max(0, Math.min(1 - s.frame.width, s.frame.x + g.dx / p.size)), y: Math.max(0, Math.min(1 - s.frame.height, s.frame.y + g.dy / p.size)) } });
    },
    onPanResponderRelease: (_, g) => {
      current.current.onEnd();
      if (selectedAtStart.current && Math.hypot(g.dx, g.dy) < 5) current.current.onEdit();
    },
    onPanResponderTerminate: () => current.current.onEnd()
  })).current;
  const { slot, photo } = props;
  const m = getPhotoRenderMetrics({ containerAspect: slot.frame.width / slot.frame.height, imageAspect: getPhotoAspect(photo), fitMode: slot.fitMode, scale: slot.photoScale, offsetX: slot.photoOffsetX, offsetY: slot.photoOffsetY });
  return <View style={{ position: "absolute", left: `${slot.frame.x * 100}%`, top: `${slot.frame.y * 100}%`, width: `${slot.frame.width * 100}%`, height: `${slot.frame.height * 100}%`, transform: [{ rotate: `${slot.rotation ?? 0}deg` }], zIndex: slot.zIndex ?? 2 }}>
    <View {...pan.panHandlers} style={{ flex: 1, overflow: "hidden", borderRadius: slot.shape && slot.shape !== "rectangle" ? 0 : props.cornerRadius, borderWidth: slot.shape && slot.shape !== "rectangle" ? 0 : props.borderWidth, borderColor: props.borderColor }}>
      {slot.shape && slot.shape !== "rectangle" ? <ObjectShape shape={slot.shape} uri={photo?.uri} metrics={m} border={props.borderColor} borderWidth={props.borderWidth} /> : photo ? <Image source={{ uri: photo.uri }} resizeMode="cover" style={{ position: "absolute", width: `${m.width * 100}%`, height: `${m.height * 100}%`, left: `${m.leftPercent}%`, top: `${m.topPercent}%` }} /> : <View style={{ flex: 1, backgroundColor: "#eee" }} />}
    </View>
    {props.selected && <ObjectHandles geometry={{ ...slot.frame, rotation: slot.rotation }} size={props.size} onBegin={props.onBegin} onEnd={props.onEnd} onChange={patch => props.onChange({ ...slot, rotation: patch.rotation ?? slot.rotation, frame: { ...slot.frame, ...Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "rotation")) } })} />}
  </View>;
}
