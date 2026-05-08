/**
 * Lightweight client-side event log (Supabase analytics_events).
 * Fire-and-forget; failures only warn in the console.
 */
import { supabase } from "@/lib/supabase";
import { getAuthUserId } from "@/lib/auth";

export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  const userId = getAuthUserId();
  if (!userId) return;
  const id = `ae${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  void supabase
    .from("analytics_events")
    .insert({ id, user_id: userId, name, props })
    .then(({ error }) => {
      if (error) console.warn("[mk:analytics]", name, error.message);
    });
}
