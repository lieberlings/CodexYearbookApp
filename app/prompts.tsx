import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppData } from "../src/context/AppContext";
import { generatePrompts } from "../src/services/promptEngine";

export default function PromptsScreen() {
  const { memories, photos, getMemoryById } = useAppData();
  const prompts = generatePrompts(memories, photos);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Prompt Center</Text>
      <Text style={styles.subtitle}>Suggestions based on time, photo volume, and location metadata.</Text>

      <View style={styles.list}>
        {prompts.map((prompt) => {
          const memory = prompt.memoryId ? getMemoryById(prompt.memoryId) : undefined;
          return (
            <View key={prompt.id} style={styles.card}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    marginTop: 6,
    color: "#475569"
  },
  list: {
    marginTop: 14,
    gap: 10
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12
  },
  cardTitle: {
    fontWeight: "600",
    color: "#0f172a"
  },
  message: {
    marginTop: 6,
    color: "#334155"
  },
  link: {
    marginTop: 8,
    color: "#0f766e",
    fontWeight: "600"
  }
});
