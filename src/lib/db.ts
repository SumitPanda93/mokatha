import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  language: "or" | "hi";
  verified: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
  id: string;
  kind: "voice" | "text" | "story" | "reel";
  author_id: string;
  title: string;
  body: string;
  audio_url: string | null;
  cover_url: string | null;
  duration_sec: number | null;
  language: "or" | "hi";
  created_at: string;
  likes: number;
  comments: number;
  tips_total: number;
  tags: string[];
  access_type: "free" | "tip" | "premium" | null;
  min_tip: number | null;
};

export type WalletBalanceRow = {
  user_id: string;
  balance: number;
};

export type MehfilRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  is_live: boolean;
  listeners: number;
  starts_at: string;
  cover_url: string | null;
  language: "or" | "hi";
  tags: string[];
};

export type DbResult<T> = { data: T; error: null } | { data: null; error: PostgrestError };

export async function selectOne<T>(query: Promise<{ data: T | null; error: PostgrestError | null }>): Promise<DbResult<T>> {
  const { data, error } = await query;
  if (error || data == null) return { data: null, error: error as PostgrestError };
  return { data, error: null };
}

export function dbClient(): SupabaseClient {
  return supabase;
}

