import "expo-sqlite/localStorage/install";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

type SupabaseStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const supabaseUrl = "https://blcnymocctrbnqljzzco.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsY255bW9jY3RyYm5xbGp6emNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDMyNDYsImV4cCI6MjA4MjAxOTI0Nn0.v3_qCI7D8kNboBdondmCh7de0NQAWzuJrD5--5JvRJ8";

const webStorage: SupabaseStorage | null =
  typeof localStorage !== "undefined"
    ? {
        getItem: async (key: string) => localStorage.getItem(key),
        setItem: async (key: string, value: string) => {
          localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          localStorage.removeItem(key);
        },
      }
    : null;

const nativeStorage: SupabaseStorage = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

export const supabaseAuthStorage: SupabaseStorage = Platform.OS === "web" ? (webStorage ?? nativeStorage) : nativeStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type PublicTableName =
  | "profiles"
  | "landmarks"
  | "landmark_upvotes"
  | "landmark_reviews"
  | "tours"
  | "tour_stops"
  | "audio_clips"
  | "tts_audio_chunks";

export async function supabaseExchangeCodeForSessionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const errorDescription = parsed.searchParams.get("error_description");

    console.log("[Supabase] exchangeCodeForSessionFromUrl", {
      hasCode: Boolean(code),
      hasError: Boolean(errorDescription),
    });

    if (errorDescription) {
      return { error: new Error(errorDescription) };
    }

    if (!code) {
      return { error: new Error("Missing OAuth code") };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Supabase] exchangeCodeForSession error", error);
      return { error };
    }

    console.log("[Supabase] exchangeCodeForSession success", {
      hasSession: Boolean(data?.session),
      hasUser: Boolean(data?.user),
    });

    return { data };
  } catch (error) {
    console.error("[Supabase] exchangeCodeForSessionFromUrl parse error", error);
    return { error };
  }
}
