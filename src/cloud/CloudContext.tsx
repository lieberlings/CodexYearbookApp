import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { AppState } from "react-native";
import { useAppData } from "../context/AppContext";
import { deleteCloudAccount } from "./account";
import { cloudEnabled } from "./config";
import { getSupabase } from "./supabaseClient";
import { runSync, type SyncReport } from "./sync/engine";
import { emptySyncState, isEmptyPatch, type SyncState } from "./sync/model";
import { createSupabaseCloudApi } from "./sync/supabaseApi";

// Accounts and cloud backup. Everything here is inert when the build has no
// Supabase config (cloudEnabled is false): no network calls, no UI.

const SYNC_STATE_KEY = "yearbook-cloud-sync-v1";
// Wait for edits to settle before pushing them.
const SYNC_DEBOUNCE_MS = 8000;

export type SyncStatus = "idle" | "syncing" | "error";

type CloudContextValue = {
  enabled: boolean;
  ready: boolean;
  user?: { id: string; email?: string };
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  lastError?: string;
  lastReport?: SyncReport;
  isProjectBackedUp: (projectId: string) => boolean;
  sendSignInCode: (email: string) => Promise<void>;
  verifySignInCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  backUpProject: (projectId: string) => Promise<void>;
  syncNow: () => Promise<void>;
};

const CloudContext = createContext<CloudContextValue | undefined>(undefined);

function stateKey(userId: string) {
  return `${SYNC_STATE_KEY}:${userId}`;
}

async function loadSyncState(userId: string): Promise<SyncState> {
  try {
    const raw = await AsyncStorage.getItem(stateKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as SyncState;
      if (parsed.version === 1 && parsed.userId === userId) {
        return parsed;
      }
    }
  } catch {
    // Unreadable bookkeeping only means the next sync compares everything again.
  }
  return emptySyncState(userId);
}

async function saveSyncState(state: SyncState) {
  await AsyncStorage.setItem(stateKey(state.userId), JSON.stringify(state));
}

export function CloudProvider({ children }: PropsWithChildren) {
  const { loading, projects, memories, pageSections, photos, applyCloudPatch } = useAppData();
  const supabase = getSupabase();
  const [ready, setReady] = useState(!cloudEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState | undefined>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();
  const [lastReport, setLastReport] = useState<SyncReport | undefined>();

  // Sync reads the newest data and state through refs so a running round never
  // works from a stale snapshot captured by an old closure.
  const recordsRef = useRef({ projects, memories, pageSections, photos });
  recordsRef.current = { projects, memories, pageSections, photos };
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;
  const runningRef = useRef<Promise<void> | undefined>(undefined);
  const rerunRef = useRef(false);

  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setSyncState(undefined);
      return;
    }
    let active = true;
    void loadSyncState(userId).then((state) => {
      if (active) setSyncState(state);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const commitState = useCallback(async (state: SyncState) => {
    syncStateRef.current = state;
    setSyncState(state);
    await saveSyncState(state);
  }, []);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!supabase || loading) {
      return;
    }
    if (runningRef.current) {
      // Sync again right after the current round, with whatever changed since.
      rerunRef.current = true;
      return runningRef.current;
    }
    const run = (async () => {
      do {
        rerunRef.current = false;
        const state = syncStateRef.current;
        if (!state) return;
        setSyncStatus("syncing");
        try {
          const result = await runSync(createSupabaseCloudApi(supabase), recordsRef.current, state);
          if (!isEmptyPatch(result.patch)) {
            applyCloudPatch(result.patch);
          }
          await commitState(result.state);
          setLastReport(result.report);
          setLastSyncedAt(new Date().toISOString());
          setLastError(result.report.fileErrors[0]);
          setSyncStatus(result.report.fileErrors.length > 0 ? "error" : "idle");
        } catch (error) {
          setLastError((error as Error).message);
          setSyncStatus("error");
          return;
        }
      } while (rerunRef.current);
    })();
    runningRef.current = run;
    try {
      await run;
    } finally {
      runningRef.current = undefined;
    }
  }, [applyCloudPatch, commitState, loading, supabase]);

  // Sync when signing in (pulls this account's projects) and when the app comes back.
  useEffect(() => {
    if (!syncState || loading) return;
    void syncNow();
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") void syncNow();
    });
    return () => subscription.remove();
    // Only on sign-in / load, not on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncState?.userId, loading]);

  // Push edits to backed-up projects shortly after they happen.
  const hasSyncedProjects = (syncState?.syncedProjectIds.length ?? 0) > 0;
  useEffect(() => {
    if (!hasSyncedProjects || loading) return;
    const timer = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hasSyncedProjects, loading, memories, pageSections, photos, projects, syncNow]);

  const isProjectBackedUp = useCallback(
    (projectId: string) => Boolean(syncState?.syncedProjectIds.includes(projectId)),
    [syncState]
  );

  const backUpProject = useCallback(
    async (projectId: string) => {
      const state = syncStateRef.current;
      if (!state || state.syncedProjectIds.includes(projectId)) return;
      await commitState({ ...state, syncedProjectIds: [...state.syncedProjectIds, projectId] });
      await syncNow();
    },
    [commitState, syncNow]
  );

  const sendSignInCode = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error("Accounts aren't available in this build.");
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) throw new Error(error.message);
    },
    [supabase]
  );

  const verifySignInCode = useCallback(
    async (email: string, code: string) => {
      if (!supabase) throw new Error("Accounts aren't available in this build.");
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) throw new Error(error.message);
    },
    [supabase]
  );

  // Signing out keeps every project on this device; only syncing stops.
  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, [supabase]);

  // Deletes the account and everything it owns in the cloud. Projects on this
  // device stay; they become local-only again.
  const deleteAccount = useCallback(async () => {
    if (!supabase || !userId) return;
    await deleteCloudAccount(supabase, userId);
    await AsyncStorage.removeItem(stateKey(userId));
    await supabase.auth.signOut({ scope: "local" });
  }, [supabase, userId]);

  const value = useMemo<CloudContextValue>(
    () => ({
      enabled: cloudEnabled,
      ready,
      user: session ? { id: session.user.id, email: session.user.email } : undefined,
      syncStatus,
      lastSyncedAt,
      lastError,
      lastReport,
      isProjectBackedUp,
      sendSignInCode,
      verifySignInCode,
      signOut,
      deleteAccount,
      backUpProject,
      syncNow
    }),
    [
      ready,
      session,
      syncStatus,
      lastSyncedAt,
      lastError,
      lastReport,
      isProjectBackedUp,
      sendSignInCode,
      verifySignInCode,
      signOut,
      deleteAccount,
      backUpProject,
      syncNow
    ]
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const value = useContext(CloudContext);
  if (!value) {
    throw new Error("useCloud must be used inside CloudProvider");
  }
  return value;
}
