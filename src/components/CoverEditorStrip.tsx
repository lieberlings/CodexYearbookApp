import { router } from "expo-router";
import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useAppData } from "../context/AppContext";
import { useEditorStore } from "../state/editorStore";
import type { CoverPanel } from "../types";
import { CoverSpread } from "./CoverSpread";
import { useProjectBook } from "./useProjectBook";

export function CoverEditorStrip({ projectId, panel }: { projectId: string; panel: "front" | "back" }) {
  const book = useProjectBook(projectId);
  const { createMemory } = useAppData();
  const opening = useRef(false);
  async function select(next: CoverPanel) {
    if (next === panel || opening.current) return;
    if (next === "spine") {
      router.navigate({ pathname: "/project/[id]/cover", params: { id: projectId, panel: "spine" } });
      return;
    }
    opening.current = true;
    try {
      const role = next === "front" ? "front-cover" : "back-cover";
      const existing = book.memories.find(memory => memory.bookRole === role);
      const id = existing?.id ?? await createMemory(projectId, next === "front" ? "Front cover" : "Back cover", { bookRole: role });
      useEditorStore.getState().setSelection(existing ? book.sections[existing.id]?.[0]?.id : undefined, undefined);
      router.replace({ pathname: "/memory/[id]", params: { id } });
    } catch (error) { Alert.alert("Unable to open cover", (error as Error).message); }
    finally { opening.current = false; }
  }
  if (!book.project) return null;
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 6 }}>
    <CoverSpread {...book} project={book.project} width={132} selected={panel} onSelect={next => void select(next)} />
    <View>{(["back", "spine", "front"] as const).map(next => <Pressable key={next} accessibilityLabel={`Edit ${next}`} onPress={() => void select(next)} style={{ paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: "#6B5BD2", fontSize: 12, fontWeight: next === panel ? "700" : "400" }}>{next === "spine" ? "Spine" : `${next === "front" ? "Front" : "Back"} cover`}</Text></Pressable>)}</View>
  </View>;
}
