import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { cloudConfig } from "./config";

let client: SupabaseClient | undefined;

// The one Supabase client, or undefined when the build has no cloud config.
export function getSupabase(): SupabaseClient | undefined {
  if (!cloudConfig) {
    return undefined;
  }
  if (!client) {
    client = createClient(cloudConfig.url, cloudConfig.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Sign-in uses a 6-digit email code, not a redirect link.
        detectSessionInUrl: false
      }
    });
    // Supabase recommends refreshing tokens only while the app is in the foreground.
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
  }
  return client;
}
