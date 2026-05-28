/**
 * Host stops active egress (finalizes composite). Webhook or reconcile completes replay URLs.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EgressClient } from "npm:livekit-server-sdk@2.9.1";
import {
  buildReplayPatchFromEgress,
  recordingPublicBaseUrl,
} from "../_shared/egressReplay.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function liveKitHttpHost(): string {
  const raw = Deno.env.get("LIVEKIT_HTTP_URL") ?? Deno.env.get("LIVEKIT_HOST") ?? "";
  return raw.replace(/\/$/, "");
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

async function upsertReplayRow(
  admin: ReturnType<typeof createClient>,
  mehfilId: string,
  hostId: string,
  title: string,
  patch: Record<string, unknown>,
) {
  const { data: existing } = await admin
    .from("mehfil_replays")
    .select("id")
    .eq("mehfil_id", mehfilId)
    .eq("host_id", hostId)
    .eq("published", false)
    .eq("deleted", false)
    .maybeSingle();

  if (existing?.id) {
    await admin.from("mehfil_replays").update(patch).eq("id", existing.id);
    return;
  }

  const id = `mr${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  await admin.from("mehfil_replays").insert({
    id,
    mehfil_id: mehfilId,
    host_id: hostId,
    title,
    audio_url: null,
    video_url: null,
    published: false,
    deleted: false,
    post_id: null,
    ...patch,
  });
}

async function tryFinalizeFromLiveKit(
  admin: ReturnType<typeof createClient>,
  mehfilId: string,
  hostId: string,
  title: string,
  egressId: string,
  studio: boolean,
): Promise<"ready" | "failed" | "processing"> {
  const lkHost = liveKitHttpHost();
  const lkKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const lkSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  if (!lkHost || !lkKey || !lkSecret) return "processing";

  const egressClient = new EgressClient(lkHost, lkKey, lkSecret);
  const publicBase = recordingPublicBaseUrl();

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));

    let info: Record<string, unknown> | undefined;
    try {
      const items = await egressClient.listEgress({ egressId });
      info = asRecord(items?.[0]);
    } catch (e) {
      console.warn("[mehfil-recording-stop] listEgress failed", e);
      continue;
    }

    const patch = buildReplayPatchFromEgress(info, studio, publicBase);
    if (patch.replay_processing_status === "processing") continue;

    await upsertReplayRow(admin, mehfilId, hostId, title, patch);
    await admin.from("mehfils").update({ egress_id: null }).eq("id", mehfilId);
    return patch.replay_processing_status;
  }

  return "processing";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mehfilId = typeof body?.mehfilId === "string" ? body.mehfilId.trim() : "";
    if (!mehfilId) {
      return new Response(JSON.stringify({ error: "mehfilId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userSb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userSb.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const admin = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });

    const { data: mf, error: mfErr } = await admin
      .from("mehfils")
      .select("id,host_id,egress_id,session_mode,title")
      .eq("id", mehfilId)
      .maybeSingle();
    if (mfErr || !mf || mf.host_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const studio = mf.session_mode === "studio";
    const title = mf.title ?? "Gathering replay";
    const egressId = mf.egress_id ? String(mf.egress_id).trim() : "";

    if (!egressId) {
      await upsertReplayRow(admin, mehfilId, user.id, title, {
        replay_processing_status: "failed",
        recording_error: "recording_never_started",
      });

      return new Response(JSON.stringify({ ok: true, stopped: false, status: "failed" }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const lkHost = liveKitHttpHost();
    const lkKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const lkSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!lkHost || !lkKey || !lkSecret) {
      await upsertReplayRow(admin, mehfilId, user.id, title, {
        replay_processing_status: "failed",
        recording_error: "livekit_egress_not_configured",
      });
      await admin.from("mehfils").update({ egress_id: null }).eq("id", mehfilId);
      return new Response(JSON.stringify({ ok: true, stopped: false, status: "failed" }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const egressClient = new EgressClient(lkHost, lkKey, lkSecret);
    try {
      await egressClient.stopEgress(egressId);
    } catch (e) {
      console.warn("[mehfil-recording-stop] stopEgress error", e);
    }

    await admin.from("mehfils").update({ egress_id: null }).eq("id", mehfilId);

    await upsertReplayRow(admin, mehfilId, user.id, title, {
      replay_processing_status: "processing",
      recording_error: null,
      egress_id: egressId,
    });

    const finalized = await tryFinalizeFromLiveKit(admin, mehfilId, user.id, title, egressId, studio);

    return new Response(JSON.stringify({ ok: true, stopped: true, status: finalized }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[mehfil-recording-stop]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
