/**
 * LiveKit → Supabase: finalize Mehfil egress assets on egress_ended.
 * Configure this URL in LiveKit Cloud webhooks. Uses LIVEKIT_API_KEY + LIVEKIT_API_SECRET to verify signatures.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.9.1";

function firstOutputLocation(info: Record<string, unknown> | undefined): string {
  if (!info) return "";
  const fr = info.fileResults ?? info.file_results;
  if (Array.isArray(fr) && fr.length > 0) {
    const row = fr[0] as Record<string, unknown>;
    const loc = row.location ?? row.filename ?? row.downloadUrl ?? row.download_url;
    if (typeof loc === "string" && loc.trim()) return loc.trim();
  }
  const legacyFile = info.file as Record<string, unknown> | undefined;
  if (legacyFile) {
    const loc = legacyFile.location ?? legacyFile.filename;
    if (typeof loc === "string" && loc.trim()) return loc.trim();
  }
  return "";
}

/** Prefer durable output URL; status enums vary by LiveKit version. */
function egressLooksFailed(info: Record<string, unknown> | undefined, hasUrl: boolean): boolean {
  if (hasUrl) return false;
  if (!info) return true;
  const st = info.status ?? info.egressStatus;
  if (typeof st === "string") {
    return /fail|error/i.test(st);
  }
  if (typeof st === "number") {
    return st === 4;
  }
  return true;
}

function egressErrorMessage(info: Record<string, unknown> | undefined): string {
  if (!info) return "unknown_egress";
  const err = info.error ?? info.errorMessage ?? info.error_message;
  if (typeof err === "string" && err.trim()) return err.trim();
  const st = info.status ?? info.egressStatus;
  return typeof st === "string" ? st : "egress_end";
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!apiKey || !apiSecret || !supabaseUrl || !svcKey) {
    console.error("[livekit-webhook] missing env configuration");
    return new Response("Server misconfigured", { status: 500 });
  }

  const raw = await req.text();
  const authHeader = req.headers.get("Authorization") ?? "";

  let event: { event?: string; egressInfo?: Record<string, unknown> };
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const parsed = await receiver.receive(raw, authHeader, false);
    event = parsed as unknown as { event?: string; egressInfo?: Record<string, unknown> };
  } catch (e) {
    console.warn("[livekit-webhook] signature verify failed", e);
    return new Response("Unauthorized", { status: 401 });
  }

  if (event.event !== "egress_ended") {
    return new Response("ok", { status: 200 });
  }

  const infoRaw = event.egressInfo;
  const info = (infoRaw ?? undefined) as Record<string, unknown> | undefined;
  const roomNameRaw = info?.roomName ?? info?.room_name;
  const roomName = typeof roomNameRaw === "string" ? roomNameRaw.trim() : "";
  if (!roomName) {
    console.warn("[livekit-webhook] egress_ended without room name");
    return new Response("ok", { status: 200 });
  }

  const admin = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });

  const url = firstOutputLocation(info);
  const failed = egressLooksFailed(info, Boolean(url));

  const { data: mf } = await admin.from("mehfils").select("session_mode,host_id").eq("id", roomName).maybeSingle();
  const studio = mf?.session_mode === "studio";

  const patch = failed
    ? {
      replay_processing_status: "failed",
      recording_error: egressErrorMessage(info),
    }
    : {
      replay_processing_status: "ready",
      recording_error: null as string | null,
      audio_url: url,
      video_url: studio ? url : null,
    };

  await admin.from("mehfil_replays").update(patch).eq("mehfil_id", roomName).eq("published", false);

  // Ensure active egress pointer cleared if LiveKit closes before client stop
  await admin.from("mehfils").update({ egress_id: null }).eq("id", roomName);

  return new Response("ok", { status: 200 });
});
