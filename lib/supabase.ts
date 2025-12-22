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
