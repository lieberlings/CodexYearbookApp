import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CoverSpread } from "./CoverSpread";
import { useProjectBook } from "./useProjectBook";

export function ProjectCoverCard({ projectId }: { projectId: string }) {
  const book = useProjectBook(projectId);
  const [width, setWidth] = useState(280);
  if (!book.project) return null;
  const populated = Boolean(book.front || book.back || book.project.coverDesign);
  return <Pressable accessibilityRole="button" accessibilityLabel="Design cover" onPress={() => router.push({ pathname: "/project/[id]/cover", params: { id: projectId } })}
    style={{ borderWidth: 1, borderStyle: populated ? "solid" : "dashed", borderColor: "#D8CFC2", backgroundColor: "#FBF6EE", borderRadius: 16, padding: 14, marginVertical: 8, gap: 10 }}>
    {populated && <View pointerEvents="none" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ width: "100%", overflow: "hidden", borderRadius: 6 }}><CoverSpread {...book} project={book.project} width={width} /></View>}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="book-outline" size={22} color="#6B5BD2" /><View style={{ flex: 1 }}><Text style={{ color: "#4A4239", fontWeight: "700" }}>Design cover</Text><Text style={{ color: "#796E61", fontSize: 12, marginTop: 3 }}>Front, spine and back</Text></View><Ionicons name="chevron-forward" size={18} color="#6B6156" /></View>
  </Pressable>;
}
