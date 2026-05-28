/**
 * LiveKit → Supabase: finalize Mehfil egress assets on egress_ended.
 * Configure this URL in LiveKit Cloud webhooks. Uses LIVEKIT_API_KEY + LIVEKIT_API_SECRET to verify signatures.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.9.1";
import {
  buildReplayPatchFromEgress,
  recordingPublicBaseUrl,
} from "../_shared/egressReplay.ts";

const EGRESS_END_EVENTS = new Set(["egress_ended", "EgressEnded", "EGRESS_ENDED"]);

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

  const eventName = typeof event.event === "string" ? event.event : "";
  if (!EGRESS_END_EVENTS.has(eventName)) {
    return new Response("ok", { status: 200 });
  }

  const info = event.egressInfo;
  const roomNameRaw = info?.roomName ?? info?.room_name;
  const roomName = typeof roomNameRaw === "string" ? roomNameRaw.trim() : "";
  if (!roomName) {
    console.warn("[livekit-webhook] egress_ended without room name", { eventName, egressId: info?.egressId ?? info?.egress_id });
    return new Response("ok", { status: 200 });
  }

  const admin = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });

  const { data: mf } = await admin.from("mehfils").select("session_mode,host_id,title").eq("id", roomName).maybeSingle();
  const studio = mf?.session_mode === "studio";
  const publicBase = recordingPublicBaseUrl();
  const patch = buildReplayPatchFromEgress(info, studio, publicBase);

  const { data: updated, error: upErr } = await admin
    .from("mehfil_replays")
    .update(patch)
    .eq("mehfil_id", roomName)
    .eq("published", false)
    .select("id")
    .maybeSingle();

  if (upErr) {
    console.error("[livekit-webhook] replay update failed", upErr.message, { roomName, patch });
  }

  if (!updated?.id && mf?.host_id) {
    const id = `mr${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    await admin.from("mehfil_replays").insert({
      id,
      mehfil_id: roomName,
      host_id: mf.host_id,
      title: mf.title ?? "Gathering replay",
      audio_url: patch.audio_url ?? null,
      video_url: patch.video_url ?? null,
      published: false,
      deleted: false,
      post_id: null,
      egress_id: info?.egressId ?? info?.egress_id ?? null,
      replay_processing_status: patch.replay_processing_status,
      recording_error: patch.recording_error,
    });
  }

  await admin.from("mehfils").update({ egress_id: null }).eq("id", roomName);

  console.info("[livekit-webhook] egress finalized", {
    roomName,
    status: patch.replay_processing_status,
    hasAudio: Boolean(patch.audio_url),
  });

  return new Response("ok", { status: 200 });
});
