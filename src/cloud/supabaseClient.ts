import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { getCloudConfig } from "./config";

let client: SupabaseClient | null = null;

// The shared client, or null when this build has no Supabase settings.
export function getSupabase(): SupabaseClient | null {
  if (client) {
    return client;
  }
  const config = getCloudConfig();
  if (!config) {
    return null;
  }
  client = createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce"
    }
  });
  if (Platform.OS !== "web") {
    // Refresh the session only while the app is in the foreground.
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void client?.auth.startAutoRefresh();
      } else {
        void client?.auth.stopAutoRefresh();
      }
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Cloud features aren't set up in this build.");
  }
  return supabase;
}
