import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useCloud } from "../../../src/cloud/CloudContext";
import {
  answerControlRequest,
  ControlRequest,
  createInvite,
  formatInviteCode,
  InviteRole,
  inviteMessage,
  listControlRequests,
  listInvites,
  listMembers,
  ProjectInvite,
  ProjectMember,
  removeMember,
  revokeInvite,
  setMemberRole,
  transferMemoryControl
} from "../../../src/cloud/sharing";
import { useAppData } from "../../../src/context/AppContext";
import { cloudStyles as styles, errorMessage, ROLE_LABELS } from "../../../src/features/cloud/styles";
import { Button } from "../../../src/ui/Button";
import { SegmentedControl } from "../../../src/ui/SegmentedControl";

export default function ShareProjectScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { projects, memories, deleteProject } = useAppData();
  const { configured, userId, status, enableBackup, syncNow } = useCloud();
  const project = projects.find((item) => item.id === projectId);
  const projectMemories = useMemo(
    () => memories.filter((memory) => memory.projectId === projectId && !memory.bookRole).sort((a, b) => a.order - b.order),
    [memories, projectId]
  );
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [requests, setRequests] = useState<ControlRequest[]>([]);
  const [inviteRole, setInviteRole] = useState<InviteRole>("contributor");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloud = project?.cloud;
  const isOwner = cloud?.role === "owner";
  const uploaded = Boolean(cloud) && members.length > 0;

  const refresh = useCallback(async () => {
    if (!projectId || !userId || !cloud || cloud.accessRemovedAt) return;
    try {
      const nextMembers = await listMembers(projectId);
      setMembers(nextMembers);
      if (cloud.role === "owner" && nextMembers.length > 0) setInvites(await listInvites(projectId));
      setRequests(cloud.role === "viewer" ? [] : await listControlRequests(projectId));
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [cloud, projectId, userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function act(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
      await refresh();
    } catch (caught) {
      Alert.alert("That didn't work", errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (id: string | null | undefined) =>
    !id ? "the owner" : id === userId ? "you" : members.find((member) => member.userId === id)?.displayName ?? "someone";

  if (!project || !projectId) {
    return <Stack.Screen options={{ title: "Share" }} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Share" }} />

      {!configured ? (
        <View style={styles.card}>
          <Text style={styles.body}>This version of the app isn’t connected to a cloud service, so sharing is off.</Text>
        </View>
      ) : !userId ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Back up and share this book</Text>
          <Text style={styles.body}>Sign in to keep a copy of this project in the cloud and invite people to add photos.</Text>
          <Button label="Sign in" variant="primary" onPress={() => router.push({ pathname: "/account", params: { next: `/project/${projectId}/share` } })} />
        </View>
      ) : !cloud ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Back up this project first</Text>
          <Text style={styles.body}>
            Its memories, pages and print-quality copies of its photos upload to your account. Exact photo locations stay on this phone. Then you can invite people.
          </Text>
          <Button label="Back up project" variant="primary" icon="cloud-upload-outline" onPress={() => enableBackup(projectId)} />
        </View>
      ) : cloud.accessRemovedAt ? (
        <View style={styles.card}>
          <Text style={styles.heading}>You no longer have access</Text>
          <Text style={styles.body}>The owner removed you or stopped sharing. The copy on this phone stays, but it won’t update.</Text>
          <Button label="Remove from this phone" variant="danger" onPress={() => removeLocalCopy()} />
        </View>
      ) : (
        <>
          {isOwner && !uploaded ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Uploading…</Text>
              <Text style={styles.body}>
                {status.state === "syncing" && status.progress?.phase === "uploading"
                  ? `Photo ${status.progress.done + 1} of ${status.progress.total}`
                  : "The first backup is on its way. Invites open up once it's done."}
              </Text>
              <Button label="Check again" size="sm" busy={status.state === "syncing"} onPress={() => void syncNow().then(refresh)} />
            </View>
          ) : null}

          {isOwner && uploaded ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Invite people</Text>
              <SegmentedControl
                options={[
                  { value: "contributor", label: "Can add photos" },
                  { value: "viewer", label: "Can view" }
                ]}
                value={inviteRole}
                onChange={setInviteRole}
                accessibilityLabel="What invited people can do"
              />
              <Text style={styles.muted}>
                {inviteRole === "contributor"
                  ? "They see the whole book, add photos to memories, and can make memories of their own."
                  : "They see the whole book and its photos, but can't change anything."}{" "}
                The invite works for 7 days.
              </Text>
              <Button
                label="Create invite and share"
                variant="primary"
                icon="share-social-outline"
                busy={busy}
                onPress={() =>
                  void act(async () => {
                    const code = await createInvite(projectId, inviteRole);
                    setLastCode(code);
                    await Share.share({ message: inviteMessage(project.name, code, inviteRole) });
                  })
                }
              />
              {lastCode ? <Text style={styles.body}>Latest code: {formatInviteCode(lastCode)}</Text> : null}
              {invites.length > 0 ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.label}>Open invites</Text>
                  {invites.map((invite) => (
                    <View key={invite.id} style={styles.rowBetween}>
                      <Text style={[styles.muted, { flex: 1 }]}>
                        {ROLE_LABELS[invite.role]} · used {invite.useCount} of {invite.maxUses} · until {new Date(invite.expiresAt).toLocaleDateString()}
                      </Text>
                      <Button label="Cancel" variant="link" size="sm" onPress={() => void act(() => revokeInvite(invite.id))} />
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          {members.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.heading}>People</Text>
              {members.map((member) => (
                <View key={member.userId} style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.body}>{member.userId === userId ? `${member.displayName} (you)` : member.displayName}</Text>
                    <Text style={styles.muted}>{ROLE_LABELS[member.role]}</Text>
                  </View>
                  {isOwner && member.role !== "owner" ? (
                    <Pressable hitSlop={8} onPress={() => openMemberMenu(member)}>
                      <Text style={styles.pillText}>Change</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {requests.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Requests to edit</Text>
              {requests.map((request) => {
                const memory = projectMemories.find((item) => item.id === request.memoryId);
                return (
                  <View key={request.id} style={{ gap: 8 }}>
                    <Text style={styles.body}>
                      {nameOf(request.requestedBy)} wants to edit &quot;{memory?.title ?? "a memory"}&quot;.
                    </Text>
                    <View style={styles.row}>
                      <Button label="Hand it over" size="sm" variant="primary" onPress={() => void act(async () => {
                        await answerControlRequest(request, projectId, true);
                        await syncNow();
                      })} />
                      <Button label="Not now" size="sm" onPress={() => void act(() => answerControlRequest(request, projectId, false))} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {projectMemories.length > 0 && uploaded && cloud.role !== "viewer" ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Who edits each memory</Text>
              <Text style={styles.muted}>One person edits a memory&apos;s pages at a time. Everyone can still add photos to it.</Text>
              {projectMemories.map((memory) => {
                const controller = memory.cloud?.controllerId ?? null;
                const mine = controller === userId || (isOwner && !controller);
                return (
                  <View key={memory.id} style={styles.rowBetween}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.body} numberOfLines={1}>{memory.title}</Text>
                      <Text style={styles.muted}>{controller ? `Edited by ${nameOf(controller)}` : "Edited by the owner"}</Text>
                    </View>
                    {isOwner && controller ? (
                      <Button label="Take back" size="sm" variant="link" onPress={() => void act(async () => {
                        await transferMemoryControl(projectId, memory.id, null);
                        await syncNow();
                      })} />
                    ) : mine && members.some((member) => member.role === "contributor") ? (
                      <Button label="Hand over" size="sm" variant="link" onPress={() => chooseNewEditor(memory.id)} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {!isOwner ? (
            <View style={styles.card}>
              <Button label="Leave this project" variant="danger" onPress={() => confirmLeave()} />
            </View>
          ) : null}
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );

  function openMemberMenu(member: ProjectMember) {
    const otherRole: InviteRole = member.role === "contributor" ? "viewer" : "contributor";
    Alert.alert(member.displayName, ROLE_LABELS[member.role], [
      { text: `Change to "${ROLE_LABELS[otherRole]}"`, onPress: () => void act(() => setMemberRole(projectId!, member.userId, otherRole)) },
      {
        text: "Remove from project",
        style: "destructive",
        onPress: () =>
          Alert.alert(`Remove ${member.displayName}?`, "They lose access right away. Photos they added stay in the book.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => void act(() => removeMember(projectId!, member.userId)) }
          ])
      },
      { text: "Cancel", style: "cancel" }
    ]);
  }

  function chooseNewEditor(memoryId: string) {
    const candidates = members.filter((member) => member.role !== "viewer" && member.userId !== userId);
    Alert.alert("Hand over editing", "Who should edit this memory's pages?", [
      ...candidates.map((member) => ({
        text: member.displayName,
        onPress: () =>
          void act(async () => {
            await transferMemoryControl(projectId!, memoryId, member.role === "owner" ? null : member.userId);
            await syncNow();
          })
      })),
      { text: "Cancel", style: "cancel" as const }
    ]);
  }

  function confirmLeave() {
    Alert.alert("Leave this project?", "It's removed from this phone. Photos you added stay in the book unless you remove them first.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          void act(async () => {
            await removeMember(projectId!, userId!);
            deleteProject(projectId!);
            router.replace("/");
          })
      }
    ]);
  }

  function removeLocalCopy() {
    Alert.alert("Remove this project from your phone?", "You can't get it back unless you're invited again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          deleteProject(projectId!);
          router.replace("/");
        }
      }
    ]);
  }
}
