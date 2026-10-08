import { useRef } from "react";
import { PanResponder, Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { snapRotation } from "../layout/freestyle";

type Geometry = { x: number; y: number; width: number; height: number; rotation?: number };
export function ObjectHandles({ geometry, size, onChange, onBegin, onEnd, onDelete }: {
  onDelete?: () => void;
  geometry: Geometry; size: number; onChange: (patch: Partial<Geometry>) => void; onBegin: () => void; onEnd: () => void;
}) {
  const current = useRef({ geometry, onChange, onBegin, onEnd, size });
  current.current = { geometry, onChange, onBegin, onEnd, size };
  const start = useRef(geometry);
  const center = useRef({ x: 0, y: 0, angle: 0 });
  const make = (mode: "resize" | "rotate") => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      start.current = current.current.geometry;
      current.current.onBegin();
      const g = start.current;
      const rad = (g.rotation ?? 0) * Math.PI / 180;
      const vx = 0, vy = -g.height * current.current.size / 2 - 18;
      center.current = { x: event.nativeEvent.pageX - (vx * Math.cos(rad) - vy * Math.sin(rad)),
        y: event.nativeEvent.pageY - (vx * Math.sin(rad) + vy * Math.cos(rad)), angle: rad - Math.PI / 2 };
    },
    onPanResponderMove: (event, gesture) => {
      const g = start.current;
      if (mode === "rotate") {
        const angle = Math.atan2(event.nativeEvent.pageY - center.current.y, event.nativeEvent.pageX - center.current.x);
        current.current.onChange({ rotation: snapRotation((g.rotation ?? 0) + (angle - center.current.angle) * 180 / Math.PI) });
      } else {
        const rad = (g.rotation ?? 0) * Math.PI / 180;
        const dx = (gesture.dx * Math.cos(rad) + gesture.dy * Math.sin(rad)) / current.current.size;
        const dy = (-gesture.dx * Math.sin(rad) + gesture.dy * Math.cos(rad)) / current.current.size;
        current.current.onChange({ width: Math.max(.08, Math.min(1 - g.x, g.width + dx)), height: Math.max(.08, Math.min(1 - g.y, g.height + dy)) });
      }
    },
    onPanResponderRelease: () => current.current.onEnd(),
    onPanResponderTerminate: () => current.current.onEnd()
  });
  const resize = useRef(make("resize")).current;
  const rotate = useRef(make("rotate")).current;
  return <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: "#6B5BD2" }]}>
    {onDelete && <Pressable accessibilityRole="button" accessibilityLabel="Delete selected object" onPress={event => { event.stopPropagation(); onDelete(); }} hitSlop={8} style={[styles.handle, { top: -26, right: -26, backgroundColor: "#A33636" }]}><Ionicons name="trash-outline" color="white" size={14} /></Pressable>}
    <View accessibilityLabel="Rotate object" {...rotate.panHandlers} style={[styles.handle, { top: -30, left: "50%", marginLeft: -12 }]}><Ionicons name="refresh" color="white" size={16} /></View>
    <View accessibilityLabel="Resize object" {...resize.panHandlers} style={[styles.handle, { bottom: -12, right: -12 }]}><Ionicons name="resize" color="white" size={16} /></View>
  </View>;
}
const styles = StyleSheet.create({ handle: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#6B5BD2", alignItems: "center", justifyContent: "center" } });
