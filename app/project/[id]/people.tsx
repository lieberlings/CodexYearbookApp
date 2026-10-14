import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloud } from "../../../src/cloud/CloudContext";
import { inviteMessage, type ProjectMember } from "../../../src/cloud/sharing";
import { useAppData } from "../../../src/context/AppContext";
import { Button } from "../../../src/ui/Button";
import { colors, radii, spacing, type } from "../../../src/ui/theme";

// The owner's view of who is in a shared project, with invite and remove.
export default function ProjectPeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const cloud = useCloud();
  const { getProjectById } = useAppData();
  const project = getProjectById(id);
  const [members, setMembers] = useState<ProjectMember[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const { listMembers } = cloud;
  const userId = cloud.user?.id;
  const role = cloud.projectRole(id);

  const load = useCallback(async () => {
    try {
      setError(undefined);
      setMembers(await listMembers(id));
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [listMembers, id]);

  useEffect(() => {
    if (userId && role) void load();
  }, [userId, role, load]);

  async function invite() {
    if (!project) return;
    setBusy(true);
    try {
      const created = await cloud.createInvite(project.id);
      await Share.share({ message: inviteMessage(project.name, created) });
    } catch (inviteError) {
      Alert.alert("Couldn't create an invite", (inviteError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(member: ProjectMember) {
    Alert.alert(
      `Remove ${member.displayName ?? "this person"}?`,
      "They lose access to the project. Photos they already added stay in the book.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void cloud
              .removeMember(id, member.userId)
              .then(load)
              .catch((removeError: Error) => Alert.alert("Couldn't remove", removeError.message))
        }
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
      <Stack.Screen options={{ title: "People" }} />
      {!project ? (
        <Text style={styles.body}>This project isn’t on this phone.</Text>
      ) : !cloud.user ? (
        <Text style={styles.body}>Sign in under Account to share this project.</Text>
      ) : role !== "owner" ? (
        <Text style={styles.body}>Back up this project first (project menu → Back up to cloud), then invite people here.</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>Invite people</Text>
            <Text style={styles.body}>
              People you invite can see “{project.name}” and add their photos to its memories. Only you can change pages, the cover or the
              order, and only you can order the book.
            </Text>
            <Button label="Share an invite" variant="primary" icon="person-add-outline" busy={busy} onPress={() => void invite()} />
            <Text style={type.caption}>Each invite works for 14 days and can be used by anyone you send it to.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>In this project</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!members && !error ? <ActivityIndicator color={colors.brand} /> : null}
            {members?.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <Ionicons name={member.role === "owner" ? "star-outline" : "person-outline"} size={20} color={colors.textBody} />
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>
                    {member.displayName ?? "Unnamed"}
                    {member.userId === cloud.user?.id ? " (you)" : ""}
                  </Text>
                  <Text style={type.caption}>{member.role === "owner" ? "Owner" : "Can add photos"}</Text>
                </View>
                {member.role !== "owner" ? (
                  <Button label="Remove" variant="link" size="sm" onPress={() => confirmRemove(member)} />
                ) : null}
              </View>
            ))}
            {members && members.length === 1 ? <Text style={type.caption}>Nobody else yet.</Text> : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

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
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.textBody },
  error: { fontSize: 14, color: colors.danger },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  memberText: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: "600", color: colors.text }
});
