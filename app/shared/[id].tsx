import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloud } from "../../src/cloud/CloudContext";
import { isCloudPlaceholderUri } from "../../src/cloud/sync/model";
import { useAppData } from "../../src/context/AppContext";
import { Button } from "../../src/ui/Button";
import { colors, radii, spacing, type } from "../../src/ui/theme";

// What a contributor sees for a project someone shared with them: its memories
// and photos, and a way to add their own. Pages, cover and ordering stay with
// the owner, so none of the editing tools appear here.
export default function SharedProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const cloud = useCloud();
  const { getProjectById, getMemoriesByProjectId, getPhotosByMemoryId, addPhotosToMemory } = useAppData();
  const project = getProjectById(id);
  const memories = project ? getMemoriesByProjectId(project.id).filter((memory) => !memory.bookRole) : [];
  const [ownerName, setOwnerName] = useState<string | undefined>();
  const [addingTo, setAddingTo] = useState<string | undefined>();
  const { listMembers, syncNow } = cloud;
  const userId = cloud.user?.id;

  useEffect(() => {
    if (!userId) return;
    void listMembers(id)
      .then((members) => setOwnerName(members.find((member) => member.role === "owner")?.displayName))
      .catch(() => undefined);
  }, [id, listMembers, userId]);

  async function addPhotos(memoryId: string) {
    setAddingTo(memoryId);
    try {
      const added = await addPhotosToMemory(memoryId);
      if (added > 0) {
        await syncNow();
      }
    } catch (error) {
      Alert.alert("Couldn't add photos", (error as Error).message);
    } finally {
      setAddingTo(undefined);
    }
  }

  function confirmLeave() {
    if (!project) return;
    Alert.alert(
      `Leave “${project.name}”?`,
      "It disappears from this phone. Photos you added stay in the book.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () =>
            void cloud
              .leaveProject(project.id)
              .then(() => router.replace("/"))
              .catch((error: Error) => Alert.alert("Couldn't leave", error.message))
        }
      ]
    );
  }

  if (!project) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Stack.Screen options={{ title: "Shared project" }} />
        <Text style={styles.body}>This project isn’t on this phone yet. If you just joined, open Account and tap Sync now.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
      <Stack.Screen options={{ title: project.name }} />
      <View style={styles.card}>
        <Text style={styles.heading}>{project.name}</Text>
        <Text style={styles.body}>
          Shared with you{ownerName ? ` by ${ownerName}` : ""}. Add your photos to any memory; {ownerName ?? "the owner"} arranges them on the
          pages.
        </Text>
      </View>
      {memories.length === 0 ? <Text style={styles.body}>No memories yet.</Text> : null}
      {memories.map((memory) => {
        const photos = getPhotosByMemoryId(memory.id);
        const mine = photos.filter((photo) => photo.addedBy === userId || !photo.addedBy).length;
        return (
          <View key={memory.id} style={styles.card}>
            <Text style={styles.memoryTitle}>{memory.title}</Text>
            <Text style={type.caption}>
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
              {mine > 0 ? ` · ${mine} from you` : ""}
            </Text>
            {photos.length > 0 ? (
              <View style={styles.grid}>
                {photos.slice(0, 12).map((photo) =>
                  isCloudPlaceholderUri(photo.uri) ? (
                    <View key={photo.id} style={[styles.thumb, styles.pending]} accessibilityLabel="Photo downloading" />
                  ) : (
                    <Image key={photo.id} source={{ uri: photo.uri }} style={styles.thumb} />
                  )
                )}
              </View>
            ) : null}
            <Button
              label="Add photos"
              icon="images-outline"
              busy={addingTo === memory.id}
              disabled={Boolean(addingTo)}
              onPress={() => void addPhotos(memory.id)}
            />
          </View>
        );
      })}
      <Button label="Leave this project" variant="link" onPress={confirmLeave} />
    </ScrollView>
  );
}

const THUMB = 72;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  memoryTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.textBody },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  pending: { borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }
});
