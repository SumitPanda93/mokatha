/**
 * Host stops active egress (finalizes composite). Webhook completes replay URLs.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EgressClient } from "npm:livekit-server-sdk@2.9.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function liveKitHttpHost(): string {
  const raw = Deno.env.get("LIVEKIT_HTTP_URL") ?? Deno.env.get("LIVEKIT_HOST") ?? "";
  return raw.replace(/\/$/, "");
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

    const { data: mf, error: mfErr } = await admin.from("mehfils").select("id,host_id,egress_id").eq("id", mehfilId).maybeSingle();
    if (mfErr || !mf || mf.host_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const egressId = mf.egress_id ? String(mf.egress_id).trim() : "";
    if (!egressId) {
      await admin.from("mehfil_replays").update({
        replay_processing_status: "failed",
        recording_error: "recording_never_started",
      }).eq("mehfil_id", mehfilId).eq("host_id", user.id).eq("published", false);

      return new Response(JSON.stringify({ ok: true, stopped: false }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const lkHost = liveKitHttpHost();
    const lkKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const lkSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!lkHost || !lkKey || !lkSecret) {
      return new Response(JSON.stringify({ error: "LiveKit API not configured" }), {
        status: 503,
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

    await admin.from("mehfil_replays").update({
      replay_processing_status: "processing",
      recording_error: null,
    }).eq("mehfil_id", mehfilId).eq("host_id", user.id).eq("published", false);

    return new Response(JSON.stringify({ ok: true, stopped: true }), {
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
