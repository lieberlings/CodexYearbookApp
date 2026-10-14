import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useCloud } from "../../src/cloud/CloudContext";
import { Button } from "../../src/ui/Button";
import { colors, radii, spacing } from "../../src/ui/theme";

// Opened by an invite link (yearbookapp://invite/<token>). Joins the shared
// project once signed in, then opens it.
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const cloud = useCloud();
  const [error, setError] = useState<string | undefined>();
  const started = useRef(false);
  const { joinWithInvite } = cloud;
  const signedIn = Boolean(cloud.user);

  useEffect(() => {
    if (!signedIn || started.current || !token) return;
    started.current = true;
    void joinWithInvite(token)
      .then((projectId) => router.replace({ pathname: "/shared/[id]", params: { id: projectId } }))
      .catch((joinError: Error) => setError(joinError.message));
  }, [joinWithInvite, signedIn, token]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Join a project" }} />
      <View style={styles.card}>
        {!cloud.enabled ? (
          <Text style={styles.body}>This build of the app can’t join shared projects.</Text>
        ) : !cloud.ready ? (
          <ActivityIndicator color={colors.brand} />
        ) : !signedIn ? (
          <>
            <Text style={styles.heading}>Sign in to join</Text>
            <Text style={styles.body}>Someone invited you to add photos to their yearbook. Sign in first, then open the invite again.</Text>
            <Button label="Sign in" variant="primary" onPress={() => router.push("/account")} />
          </>
        ) : error ? (
          <>
            <Text style={styles.heading}>Couldn’t join</Text>
            <Text style={styles.body}>{error}</Text>
            <Button label="Back to your books" onPress={() => router.replace("/")} />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.body}>Joining and loading the project…</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: spacing.lg },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.textBody }
});
