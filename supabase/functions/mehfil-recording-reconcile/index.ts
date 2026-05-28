/**
 * Host-only: poll LiveKit egress and finalize mehfil_replays when webhook is delayed/missing.
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
      .select("id,host_id,session_mode,is_live,egress_id")
      .eq("id", mehfilId)
      .maybeSingle();
    if (mfErr || !mf || mf.host_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const { data: replay } = await admin
      .from("mehfil_replays")
      .select("id,replay_processing_status,audio_url,video_url,egress_id,updated_at")
      .eq("mehfil_id", mehfilId)
      .eq("host_id", user.id)
      .eq("published", false)
      .eq("deleted", false)
      .maybeSingle();

    const studio = mf.session_mode === "studio";
    const publicBase = recordingPublicBaseUrl();

    if (replay?.replay_processing_status === "ready") {
      const hasAsset = !!(replay.audio_url?.trim() || replay.video_url?.trim());
      if (hasAsset) {
        return new Response(JSON.stringify({ ok: true, status: "ready", reconciled: false }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    if (replay?.replay_processing_status === "failed") {
      return new Response(JSON.stringify({ ok: true, status: "failed", reconciled: false }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const lkHost = liveKitHttpHost();
    const lkKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const lkSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

    const egressId = String(replay?.egress_id ?? mf.egress_id ?? "").trim();
    if (!lkHost || !lkKey || !lkSecret) {
      const patch = {
        replay_processing_status: "failed" as const,
        recording_error: "livekit_egress_not_configured",
      };
      await upsertReplay(admin, mehfilId, user.id, mf.title ?? "Gathering replay", patch, replay?.id);
      return new Response(JSON.stringify({ ok: true, status: "failed", reconciled: true, error: patch.recording_error }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (!egressId && !mf.is_live) {
      const patch = {
        replay_processing_status: "failed" as const,
        recording_error: "recording_never_started",
      };
      await upsertReplay(admin, mehfilId, user.id, mf.title ?? "Gathering replay", patch, replay?.id);
      return new Response(JSON.stringify({ ok: true, status: "failed", reconciled: true, error: patch.recording_error }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const egressClient = new EgressClient(lkHost, lkKey, lkSecret);
    let info: Record<string, unknown> | undefined;

    if (egressId) {
      try {
        const items = await egressClient.listEgress({ egressId });
        info = asRecord(items?.[0]);
      } catch (e) {
        console.warn("[mehfil-recording-reconcile] list by egressId failed", e);
      }
    }

    if (!info) {
      try {
        const items = await egressClient.listEgress({ roomName: mehfilId });
        const sorted = [...(items ?? [])].sort((a, b) => {
          const ae = Number(asRecord(a)?.endedAt ?? asRecord(a)?.ended_at ?? 0);
          const be = Number(asRecord(b)?.endedAt ?? asRecord(b)?.ended_at ?? 0);
          return be - ae;
        });
        info = asRecord(sorted[0]);
      } catch (e) {
        console.warn("[mehfil-recording-reconcile] list by room failed", e);
      }
    }

    if (!info) {
      const staleMs = replay?.updated_at ? Date.now() - new Date(String(replay.updated_at)).getTime() : 0;
      if (staleMs > 12 * 60 * 1000 && !mf.is_live) {
        const patch = {
          replay_processing_status: "failed" as const,
          recording_error: "egress_status_unavailable",
        };
        await upsertReplay(admin, mehfilId, user.id, mf.title ?? "Gathering replay", patch, replay?.id);
        return new Response(JSON.stringify({ ok: true, status: "failed", reconciled: true, error: patch.recording_error }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      return new Response(JSON.stringify({ ok: true, status: "processing", reconciled: false }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const patch = buildReplayPatchFromEgress(info, studio, publicBase);
    await upsertReplay(admin, mehfilId, user.id, mf.title ?? "Gathering replay", patch, replay?.id);

    if (patch.replay_processing_status !== "processing") {
      await admin.from("mehfils").update({ egress_id: null }).eq("id", mehfilId);
    }

    return new Response(JSON.stringify({
      ok: true,
      status: patch.replay_processing_status,
      reconciled: patch.replay_processing_status !== "processing",
    }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[mehfil-recording-reconcile]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});

async function upsertReplay(
  admin: ReturnType<typeof createClient>,
  mehfilId: string,
  hostId: string,
  title: string,
  patch: Record<string, unknown>,
  existingId?: string,
) {
  if (existingId) {
    await admin.from("mehfil_replays").update(patch).eq("id", existingId);
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
