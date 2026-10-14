import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloud } from "../src/cloud/CloudContext";
import { useAppData } from "../src/context/AppContext";
import { Button } from "../src/ui/Button";
import { colors, radii, spacing, type } from "../src/ui/theme";

function formatTime(iso?: string) {
  if (!iso) return "never";
  const date = new Date(iso);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const cloud = useCloud();
  const { projects } = useAppData();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert("Something went wrong", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const backedUp = projects.filter((project) => cloud.isProjectBackedUp(project.id));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "Account" }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        {!cloud.enabled ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Accounts aren’t set up</Text>
            <Text style={styles.body}>
              This build of the app has no cloud service configured, so everything stays on this phone. Your projects work exactly as before.
            </Text>
          </View>
        ) : !cloud.ready ? (
          <Text style={styles.body}>Loading…</Text>
        ) : cloud.user ? (
          <>
            <View style={styles.card}>
              <Text style={type.label}>Signed in as</Text>
              <Text style={styles.heading}>{cloud.user.email ?? "Your account"}</Text>
              <Text style={styles.body}>
                {backedUp.length === 0
                  ? "No projects are backed up yet. Open a project's menu and choose Back up to cloud."
                  : `${backedUp.length} ${backedUp.length === 1 ? "project is" : "projects are"} backed up: ${backedUp.map((project) => project.name).join(", ")}.`}
              </Text>
              <Text style={type.caption}>
                {cloud.syncStatus === "syncing"
                  ? "Syncing…"
                  : cloud.syncStatus === "error"
                    ? `Last sync had a problem: ${cloud.lastError ?? "unknown error"}`
                    : `Last synced ${formatTime(cloud.lastSyncedAt)}`}
              </Text>
              <Button label="Sync now" icon="sync-outline" busy={cloud.syncStatus === "syncing"} onPress={() => void cloud.syncNow()} />
            </View>
            <View style={styles.card}>
              <Text style={styles.body}>
                Signing out keeps every project on this phone. Backed-up projects stop syncing until you sign in again.
              </Text>
              <Button label="Sign out" onPress={() => void run(cloud.signOut)} disabled={busy} />
            </View>
            <View style={styles.card}>
              <Text style={styles.heading}>Delete account</Text>
              <Text style={styles.body}>
                Permanently deletes your account and every project and photo stored in the cloud. Projects on this phone are kept.
              </Text>
              <Button
                label="Delete account"
                variant="danger"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    "Delete your account?",
                    "Your cloud backups and any projects you share are deleted for everyone. This can't be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => void run(cloud.deleteAccount) }
                    ]
                  )
                }
              />
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.heading}>Sign in</Text>
            <Text style={styles.body}>
              An account backs up your projects and lets you open them on another phone. We’ll email you a 6-digit code; there’s no password.
            </Text>
            <Text style={type.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={(next) => {
                setEmail(next);
                setCodeSent(false);
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {codeSent ? (
              <>
                <Text style={type.label}>Code from the email</Text>
                <TextInput
                  accessibilityLabel="Sign-in code"
                  value={code}
                  onChangeText={(next) => setCode(next.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                <Button
                  label="Sign in"
                  variant="primary"
                  busy={busy}
                  disabled={code.length !== 6}
                  onPress={() => void run(() => cloud.verifySignInCode(email, code))}
                />
                <Button label="Send a new code" variant="link" disabled={busy} onPress={() => void run(() => cloud.sendSignInCode(email))} />
              </>
            ) : (
              <Button
                label="Email me a code"
                variant="primary"
                busy={busy}
                disabled={!validEmail}
                onPress={() =>
                  void run(async () => {
                    await cloud.sendSignInCode(email);
                    setCode("");
                    setCodeSent(true);
                  })
                }
              />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface
  }
});
