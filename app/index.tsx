import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { PROJECT_TYPES } from "../src/constants/projectTypes";
import { useAppData } from "../src/context/AppContext";
import { ProjectType } from "../src/types";

export default function HomeScreen() {
  const { loading, projects, memories, photos, createProject, pickProjectThumbnail, getMemoriesByProjectId } =
    useAppData();
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("general");
  const [thumbnailUri, setThumbnailUri] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [pickingThumb, setPickingThumb] = useState(false);

  const stats = useMemo(() => {
    return { projectCount: projects.length, memoryCount: memories.length, photoCount: photos.length };
  }, [memories.length, photos.length, projects.length]);

  async function onPickThumbnail() {
    try {
      setPickingThumb(true);
      const uri = await pickProjectThumbnail();
      if (uri) {
        setThumbnailUri(uri);
      }
    } catch (error) {
      Alert.alert("Thumbnail failed", (error as Error).message);
    } finally {
      setPickingThumb(false);
    }
  }

  async function onCreateProject() {
    if (!name.trim()) {
      return;
    }
    try {
      setSubmitting(true);
      const projectId = await createProject(name, projectType, thumbnailUri);
      setName("");
      setProjectType("general");
      setThumbnailUri(undefined);
      router.push({ pathname: "/project/[id]", params: { id: projectId } });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projects</Text>
        <Text style={styles.subtitle}>
          {stats.projectCount} projects | {stats.memoryCount} memories | {stats.photoCount} photos
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create New Project</Text>
        <TextInput
          style={styles.input}
          placeholder="Project name"
          value={name}
          onChangeText={setName}
        />
        <Text style={styles.label}>Project type</Text>
        <View style={styles.typeRow}>
          {PROJECT_TYPES.map((type) => {
            const selected = type.value === projectType;
            return (
              <Pressable
                key={type.value}
                onPress={() => setProjectType(type.value)}
                style={[styles.typeChip, selected && styles.typeChipSelected]}
              >
                <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>{type.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.secondaryButton} onPress={onPickThumbnail} disabled={pickingThumb}>
          <Text style={styles.secondaryButtonText}>{pickingThumb ? "Picking..." : "Pick Thumbnail"}</Text>
        </Pressable>
        {thumbnailUri ? <Image source={{ uri: thumbnailUri }} style={styles.thumbnailPreview} /> : null}
        <Pressable style={styles.primaryButton} onPress={onCreateProject} disabled={submitting}>
          <Text style={styles.primaryButtonText}>{submitting ? "Creating..." : "Create Project"}</Text>
        </Pressable>
      </View>

      <Link href="/prompts" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>View Smart Prompts</Text>
        </Pressable>
      </Link>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Existing Projects</Text>
        {projects.length === 0 ? <Text style={styles.empty}>No projects yet.</Text> : null}
        {projects.map((project) => {
          const memoryCount = getMemoriesByProjectId(project.id).length;
          return (
            <Link key={project.id} href={{ pathname: "/project/[id]", params: { id: project.id } }} asChild>
              <Pressable style={styles.projectRow}>
                {project.thumbnailUri ? (
                  <Image source={{ uri: project.thumbnailUri }} style={styles.thumbnailSmall} />
                ) : (
                  <View style={[styles.thumbnailSmall, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbPlaceholderText}>{project.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.projectTextWrap}>
                  <Text style={styles.projectTitle}>{project.name}</Text>
                  <Text style={styles.projectMeta}>
                    {project.projectType} | {memoryCount} memories
                  </Text>
                </View>
                <Text style={styles.arrow}>{">"}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    marginBottom: 6
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    marginTop: 4,
    color: "#475569"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#0f172a"
  },
  label: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 6,
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  typeChipSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ccfbf1"
  },
  typeChipText: {
    color: "#334155",
    fontSize: 12
  },
  typeChipTextSelected: {
    color: "#115e59",
    fontWeight: "600"
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  empty: {
    color: "#64748b"
  },
  thumbnailPreview: {
    marginTop: 10,
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  projectRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  thumbnailSmall: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  thumbPlaceholderText: {
    fontWeight: "700",
    color: "#475569"
  },
  projectTextWrap: {
    flex: 1
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a"
  },
  projectMeta: {
    marginTop: 2,
    color: "#475569",
    fontSize: 12
  },
  arrow: {
    color: "#64748b",
    fontSize: 16
  }
});
