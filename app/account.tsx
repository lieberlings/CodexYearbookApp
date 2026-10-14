import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { deleteAccount, sendEmailCode, signInWithGoogle, signOut, updateDisplayName, verifyEmailCode } from "../src/cloud/auth";
import { useCloud } from "../src/cloud/CloudContext";
import { normalizeInviteCode } from "../src/cloud/sharing";
import { getSupabase } from "../src/cloud/supabaseClient";
import { cloudStyles as styles, errorMessage } from "../src/features/cloud/styles";
import { Button } from "../src/ui/Button";

function formatTime(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not yet";
}

export default function AccountScreen() {
  const { configured, userId, email, status, syncNow } = useCloud();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" ? params.next : undefined;

  if (!configured) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: "Account" }} />
        <View style={styles.card}>
          <Text style={styles.heading}>Accounts aren’t available yet</Text>
          <Text style={styles.body}>
            This version of the app isn’t connected to a cloud service, so backup and sharing are off. Your projects are saved on this phone.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Account" }} />
      {userId ? (
        <SignedIn email={email} userId={userId} status={status} onSyncNow={syncNow} />
      ) : (
        <SignIn onSignedIn={() => (next ? router.replace(next as never) : undefined)} />
      )}
      <JoinCard signedIn={Boolean(userId)} />
    </ScrollView>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "send" | "verify" | "google", task: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Sign in</Text>
      <Text style={styles.body}>
        You only need an account to back up your projects or share them. Everything else works without one.
      </Text>
      <Button
        label="Continue with Google"
        icon="logo-google"
        variant="primary"
        busy={busy === "google"}
        disabled={busy !== null && busy !== "google"}
        onPress={() =>
          void run("google", async () => {
            if (await signInWithGoogle()) onSignedIn();
          })
        }
      />
      <View style={styles.divider} />
      {sentTo ? (
        <>
          <Text style={styles.body}>We emailed a 6-digit code to {sentTo}. Enter it here.</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="123456"
            maxLength={6}
          />
          <Button
            label="Sign in"
            variant="primary"
            busy={busy === "verify"}
            disabled={code.length < 6 || busy !== null}
            onPress={() =>
              void run("verify", async () => {
                await verifyEmailCode(sentTo, code);
                onSignedIn();
              })
            }
          />
          <Button label="Use a different email" variant="link" onPress={() => { setSentTo(null); setCode(""); }} />
        </>
      ) : (
        <>
          <Text style={styles.label}>Or sign in with your email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Button
            label="Email me a code"
            busy={busy === "send"}
            disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || busy !== null}
            onPress={() =>
              void run("send", async () => {
                await sendEmailCode(email);
                setSentTo(email.trim().toLowerCase());
              })
            }
          />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function SignedIn({ email, userId, status, onSyncNow }: {
  email: string | null;
  userId: string;
  status: ReturnType<typeof useCloud>["status"];
  onSyncNow: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSupabase()
      ?.from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const value = (data?.display_name as string | undefined) ?? "";
        setName(value);
        setSavedName(value);
      });
  }, [userId]);

  const statusLine =
    status.state === "syncing"
      ? status.progress?.phase === "uploading"
        ? `Uploading photos (${status.progress.done + 1} of ${status.progress.total})…`
        : status.progress?.phase === "downloading"
          ? `Downloading shared photos (${status.progress.done + 1} of ${status.progress.total})…`
          : "Syncing…"
      : status.state === "error"
        ? `Last sync had a problem: ${status.message ?? "unknown error"}`
        : `Last synced at ${formatTime(status.lastSyncedAt)}`;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>Your account</Text>
        <Text style={styles.body}>Signed in as {email ?? "your account"}</Text>
        <Text style={styles.label}>Name other people see</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" maxLength={80} />
        {name.trim() !== savedName ? (
          <Button
            label="Save name"
            size="sm"
            onPress={() =>
              void updateDisplayName(userId, name)
                .then(() => setSavedName(name.trim()))
                .catch((error) => Alert.alert("Couldn't save your name", errorMessage(error)))
            }
          />
        ) : null}
        <View style={styles.divider} />
        <Text style={status.state === "error" ? styles.error : styles.muted}>{statusLine}</Text>
        <Button label="Sync now" icon="sync-outline" size="sm" busy={status.state === "syncing"} onPress={() => void onSyncNow()} />
      </View>
      <View style={styles.card}>
        <Button
          label="Sign out"
          onPress={() =>
            Alert.alert("Sign out?", "Your projects stay on this phone. Backup and sharing pause until you sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", onPress: () => void signOut().catch((error) => Alert.alert("Couldn't sign out", errorMessage(error))) }
            ])
          }
        />
        <Button
          label="Delete account"
          variant="link"
          busy={busy}
          onPress={() =>
            Alert.alert(
              "Delete your account?",
              "This deletes your account, the cloud copies of projects you own (for everyone you shared them with), and the photos you added to other people's projects. Projects on this phone stay here.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete account",
                  style: "destructive",
                  onPress: () => {
                    setBusy(true);
                    void deleteAccount()
                      .catch((error) => Alert.alert("Couldn't delete your account", errorMessage(error)))
                      .finally(() => setBusy(false));
                  }
                }
              ]
            )
          }
        />
      </View>
    </>
  );
}

function JoinCard({ signedIn }: { signedIn: boolean }) {
  const [code, setCode] = useState("");
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Join a shared project</Text>
      <Text style={styles.body}>Enter the 8-character code from the invite you received.</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        value={code}
        onChangeText={(text) => setCode(normalizeInviteCode(text).slice(0, 8))}
        autoCapitalize="characters"
        placeholder="ABCD2345"
        maxLength={9}
      />
      <Button
        label={signedIn ? "Join" : "Sign in above, then join"}
        variant="primary"
        disabled={!signedIn || code.length !== 8}
        onPress={() => router.push({ pathname: "/join", params: { code } })}
      />
    </View>
  );
}
