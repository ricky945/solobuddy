import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://blcnymocctrbnqljzzco.supabase.co";
const supabasePublishableKey = "sb_publishable__LQ9mmQtupMO4_6hoT-Dbg_UdumNnRz";

const storage: Storage = typeof localStorage !== "undefined" ? localStorage : (undefined as unknown as Storage);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
