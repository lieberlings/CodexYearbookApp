import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Link, Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppData } from "../src/context/AppContext";
import { generatePrompts } from "../src/services/promptEngine";

export default function PromptsScreen() {
  const { memories, photos, getMemoryById } = useAppData();
  const prompts = generatePrompts(memories, photos);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Suggestions", headerStyle: { backgroundColor: "#FBF6EE" }, headerTintColor: "#241F1B", headerShadowVisible: false }} />
      <StatusBar style="dark" />
      <Text style={styles.title}>Ideas from your photos</Text>
      <Text style={styles.subtitle}>A little inspiration for the stories in your book.</Text>

      <View style={styles.list}>
        {prompts.map((prompt) => {
          const memory = prompt.memoryId ? getMemoryById(prompt.memoryId) : undefined;
          return (
            <View key={prompt.id} style={styles.card}>
              <Ionicons name="sparkles-outline" size={22} color="#6B5BD2" />
              <Text style={styles.cardTitle}>{prompt.title}</Text>
              <Text style={styles.message}>{prompt.message}</Text>
              {memory ? (
                <Link href={{ pathname: "/memory/[id]", params: { id: memory.id } }} style={styles.link}>
                  Open {memory.title}
                </Link>
              ) : null}
            </View>
          );
        })}
        {prompts.length === 0 ? (
          <View style={styles.card}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#3F8F6E" />
            <Text style={styles.cardTitle}>All caught up</Text>
            <Text style={styles.message}>Add memories and photos to find more ideas here.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF6EE" },
  container: {
    padding: 16,
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#241F1B",
    letterSpacing: -0.6
  },
  subtitle: {
    marginTop: 6,
    color: "#6B6156",
    lineHeight: 21
  },
  list: {
    marginTop: 22,
    gap: 14
  },
  card: {
    borderWidth: 1,
    borderColor: "#EDE4D6",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 7
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: "#241F1B"
  },
  message: {
    marginTop: 6,
    color: "#4A4239",
    lineHeight: 21
  },
  link: {
    marginTop: 8,
    color: "#4E3FBC",
    fontWeight: "600"
  }
});
