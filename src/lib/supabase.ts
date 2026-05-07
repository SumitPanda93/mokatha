import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Mo Katha] Supabase env vars not set. " +
    "Create artifacts/mo-katha/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
    "Auth and data features will not work until then.",
  );
}

// createClient works even with empty strings — API calls will just fail gracefully.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

