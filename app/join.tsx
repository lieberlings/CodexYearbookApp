import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useCloud } from "../src/cloud/CloudContext";
import { acceptInvite, formatInviteCode, normalizeInviteCode } from "../src/cloud/sharing";
import { cloudStyles as styles, errorMessage } from "../src/features/cloud/styles";
import { useAppData } from "../src/context/AppContext";
import { Button } from "../src/ui/Button";

// Opened from an invite link (yearbookapp://join?code=...) or the Account screen.
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normalizeInviteCode(typeof params.code === "string" ? params.code : "");
  const { configured, userId, syncNow } = useCloud();
  const { projects } = useAppData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const joined = joinedId ? projects.find((project) => project.id === joinedId) : undefined;

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const projectId = await acceptInvite(code);
      setJoinedId(projectId);
      await syncNow();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Join a project" }} />
      <View style={styles.card}>
        {!configured ? (
          <Text style={styles.body}>This version of the app can’t join shared projects yet.</Text>
        ) : !userId ? (
          <>
            <Text style={styles.heading}>Sign in to join</Text>
            <Text style={styles.body}>You were invited to a shared project. Sign in first, then come back to this link.</Text>
            <Button
              label="Sign in"
              variant="primary"
              onPress={() => router.push({ pathname: "/account", params: { next: `/join?code=${code}` } })}
            />
          </>
        ) : joinedId ? (
          <>
            <Text style={styles.heading}>{joined ? `You joined "${joined.name}"` : "You're in"}</Text>
            <Text style={styles.body}>
              {joined ? "It's on your projects list now. Photos keep downloading in the background." : "The project is downloading. It shows up on your projects list in a moment."}
            </Text>
            <Button
              label={joined ? "Open project" : "Go to projects"}
              variant="primary"
              onPress={() => (joined ? router.replace({ pathname: "/project/[id]", params: { id: joined.id } }) : router.replace("/"))}
            />
          </>
        ) : (
          <>
            <Text style={styles.heading}>Join with code {formatInviteCode(code)}?</Text>
            <Text style={styles.body}>The project will appear on your projects list, and its photos download to this phone.</Text>
            <Button label="Join project" variant="primary" busy={busy} disabled={code.length !== 8} onPress={() => void join()} />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}
