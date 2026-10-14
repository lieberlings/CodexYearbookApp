import type { Session } from "@supabase/supabase-js";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAppData } from "../context/AppContext";
import { openExpoSqliteDriver } from "../data/expoSqliteDriver";
import type { Memory, ProjectCloudInfo } from "../types";
import { isCloudConfigured } from "./config";
import { createPhotoFiles } from "./photoFiles";
import { AccessContext, canEditMemory, CloudRole } from "./records";
import { createSupabaseRemote } from "./remoteApi";
import { getSupabase } from "./supabaseClient";
import { runCloudSync, SyncProgress } from "./syncEngine";
import { createSqlSyncStateStore, syncDatabaseName } from "./syncStateStore";
import { isEmptyCloudPatch, SyncStateStore } from "./syncTypes";

const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const SYNC_AFTER_EDIT_MS = 8 * 1000;

export type CloudStatus = {
  state: "off" | "idle" | "syncing" | "error";
  lastSyncedAt?: string;
  message?: string;
  progress?: SyncProgress;
};

type CloudContextValue = {
  configured: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  status: CloudStatus;
  syncNow: () => Promise<void>;
  // Starts backing up a project this account owns.
  enableBackup: (projectId: string) => void;
};

const CloudContext = createContext<CloudContextValue | null>(null);

export function CloudProvider({ children }: PropsWithChildren) {
  const app = useAppData();
  const configured = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<CloudStatus>({ state: "off" });
  const userId = session?.user.id ?? null;

  // The newest app data, read when a sync starts.
  const appRef = useRef(app);
  appRef.current = app;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const stateStoreRef = useRef<{ userId: string; store: SyncStateStore } | null>(null);
  function stateStore(forUser: string): SyncStateStore {
    if (stateStoreRef.current?.userId !== forUser) {
      stateStoreRef.current = {
        userId: forUser,
        store: createSqlSyncStateStore(() => openExpoSqliteDriver(syncDatabaseName(forUser)))
      };
    }
    return stateStoreRef.current.store;
  }

  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const syncNow = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = (async () => {
      do {
        again.current = false;
        const current = appRef.current;
        if (current.loading || current.persistenceBlocked) return;
        const snapshot = {
          projects: current.projects,
          memories: current.memories,
          pageSections: current.pageSections,
          photos: current.photos,
          suggestions: current.suggestions
        };
        if (!snapshot.projects.some((project) => project.cloud) && !(await hasMemberships(userId))) {
          setStatus({ state: "idle", lastSyncedAt: new Date().toISOString() });
          return;
        }
        setStatus((prev) => ({ ...prev, state: "syncing", message: undefined }));
        try {
          const result = await runCloudSync(snapshot, {
            remote: createSupabaseRemote(supabase, userId),
            state: stateStore(userId),
            files: createPhotoFiles(supabase),
            warn: (message, details) => console.warn(message, details),
            onProgress: (progress) => setStatus((prev) => ({ ...prev, progress }))
          });
          if (!isEmptyCloudPatch(result.patch)) {
            appRef.current.applyCloudPatch(result.patch);
          }
          setStatus({
            state: result.errors.length ? "error" : "idle",
            lastSyncedAt: new Date().toISOString(),
            message: result.errors[0]
          });
        } catch (error) {
          console.warn("Cloud sync failed", error);
          setStatus((prev) => ({ ...prev, state: "error", progress: undefined, message: error instanceof Error ? error.message : String(error) }));
          return;
        }
      } while (again.current);
    })();
    running.current = run;
    try {
      await run;
    } finally {
      running.current = null;
    }

    async function hasMemberships(forUser: string): Promise<boolean> {
      const { count } = await supabase!.from("project_members").select("project_id", { count: "exact", head: true }).eq("user_id", forUser);
      return (count ?? 0) > 0;
    }
  }, [userId]);

  // Sync when signed in, when the app comes back, and on a timer.
  useEffect(() => {
    if (!userId || app.loading) {
      setStatus({ state: userId ? "idle" : "off" });
      return;
    }
    void syncNow();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void syncNow();
    }, SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, app.loading]);

  // Push local edits to cloud projects shortly after they happen.
  const cloudDataKey = useMemo(() => {
    if (!userId) return 0;
    const cloudProjects = new Set(app.projects.filter((project) => project.cloud && !project.cloud.accessRemovedAt).map((project) => project.id));
    if (cloudProjects.size === 0) return 0;
    return [app.projects, app.memories, app.pageSections, app.photos];
  }, [userId, app.projects, app.memories, app.pageSections, app.photos]);
  const firstEdit = useRef(true);
  useEffect(() => {
    if (!cloudDataKey) return;
    if (firstEdit.current) {
      firstEdit.current = false;
      return;
    }
    const timer = setTimeout(() => void syncNow(), SYNC_AFTER_EDIT_MS);
    return () => clearTimeout(timer);
  }, [cloudDataKey, syncNow]);

  const enableBackup = useCallback(
    (projectId: string) => {
      if (!userId) return;
      const cloud: ProjectCloudInfo = { role: "owner", ownerId: userId };
      app.setProjectCloud(projectId, cloud);
      setTimeout(() => void syncNow(), 500);
    },
    [app, syncNow, userId]
  );

  const value = useMemo<CloudContextValue>(
    () => ({ configured, session, userId, email: session?.user.email ?? null, status, syncNow, enableBackup }),
    [configured, session, userId, status, syncNow, enableBackup]
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const ctx = useContext(CloudContext);
  if (!ctx) {
    throw new Error("useCloud must be used within CloudProvider.");
  }
  return ctx;
}

export type ProjectAccess = {
  role: CloudRole | undefined;
  shared: boolean;
  // Can change the project's settings, cover, people and memory order.
  canManageProject: boolean;
  canAddPhotos: boolean;
  canCreateMemories: boolean;
  canEditMemory: (memoryId: string | undefined) => boolean;
  accessRemoved: boolean;
};

// What the signed-in person may do in a project. Projects that only live on
// this phone allow everything.
export function useProjectAccess(projectId: string | undefined): ProjectAccess {
  const { projects, memories } = useAppData();
  const { userId } = useCloud();
  return useMemo(() => {
    const project = projects.find((item) => item.id === projectId);
    const cloud = project?.cloud;
    if (!cloud || cloud.role === "owner") {
      return {
        role: cloud?.role,
        shared: Boolean(cloud),
        canManageProject: !cloud?.accessRemovedAt,
        canAddPhotos: !cloud?.accessRemovedAt,
        canCreateMemories: !cloud?.accessRemovedAt,
        canEditMemory: () => !cloud?.accessRemovedAt,
        accessRemoved: Boolean(cloud?.accessRemovedAt)
      };
    }
    const removed = Boolean(cloud.accessRemovedAt);
    const memoriesById = new Map<string, Memory>(memories.filter((memory) => memory.projectId === projectId).map((memory) => [memory.id, memory]));
    const context: AccessContext = { role: removed ? undefined : cloud.role, userId: userId ?? "", memoriesById };
    const contributor = !removed && cloud.role === "contributor" && Boolean(userId);
    return {
      role: cloud.role,
      shared: true,
      canManageProject: false,
      canAddPhotos: contributor,
      canCreateMemories: contributor,
      canEditMemory: (memoryId: string | undefined) => Boolean(userId) && canEditMemory(context, memoryId),
      accessRemoved: removed
    };
  }, [memories, projectId, projects, userId]);
}
