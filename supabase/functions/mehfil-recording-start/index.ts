/**
 * Authenticated host starts LiveKit Room Composite egress for an active Mehfil.
 * Requires LIVEKIT_API_KEY/SECRET, LIVEKIT_HTTP_URL (https host), and S3 destination env vars.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EgressClient, EncodedFileType } from "npm:livekit-server-sdk@2.9.1";

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

  let mehfilId = "";
  let hostId = "";
  let mehfilTitle = "Gathering replay";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const body = await req.json().catch(() => ({}));
    mehfilId = typeof body?.mehfilId === "string" ? body.mehfilId.trim() : "";
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
    hostId = user.id;

    const admin = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });

    const { data: mf, error: mfErr } = await admin.from("mehfils").select("id,host_id,is_live,session_mode,egress_id,title").eq("id", mehfilId).maybeSingle();
    mehfilTitle = mf?.title ?? mehfilTitle;
    if (mfErr || !mf) {
      return new Response(JSON.stringify({ error: "Mehfil not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (mf.host_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the host can start recording" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (!mf.is_live) {
      return new Response(JSON.stringify({ error: "Mehfil is not live" }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (mf.egress_id && String(mf.egress_id).trim()) {
      return new Response(JSON.stringify({ ok: true, egressId: mf.egress_id, reused: true }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const markReplayFailed = async (recordingError: string) => {
      const { data: draft } = await admin.from("mehfil_replays").select("id,published").eq("mehfil_id", mehfilId).eq("host_id", user.id).eq("published", false).eq("deleted", false).maybeSingle();
      const patch = {
        replay_processing_status: "failed" as const,
        recording_error: recordingError,
      };
      if (draft?.id) {
        await admin.from("mehfil_replays").update(patch).eq("id", draft.id);
      } else {
        const id = `mr${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
        await admin.from("mehfil_replays").insert({
          id,
          mehfil_id: mehfilId,
          host_id: user.id,
          audio_url: null,
          video_url: null,
          title: mf.title ?? "Gathering replay",
          published: false,
          deleted: false,
          post_id: null,
          ...patch,
        });
      }
    };

    const lkHost = liveKitHttpHost();
    const lkKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const lkSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!lkHost || !lkKey || !lkSecret) {
      await markReplayFailed("livekit_egress_not_configured");
      return new Response(JSON.stringify({ error: "LiveKit API not configured on server" }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const s3Access = Deno.env.get("RECORDING_S3_ACCESS_KEY") ?? "";
    const s3Secret = Deno.env.get("RECORDING_S3_SECRET_KEY") ?? "";
    const s3Bucket = Deno.env.get("RECORDING_S3_BUCKET") ?? "";
    const s3Region = Deno.env.get("RECORDING_S3_REGION") ?? "us-east-1";
    const s3Endpoint = Deno.env.get("RECORDING_S3_ENDPOINT") ?? "";
    const forcePathStyle = Deno.env.get("RECORDING_S3_FORCE_PATH_STYLE") === "true";

    if (!s3Access || !s3Secret || !s3Bucket) {
      await markReplayFailed("recording_storage_not_configured");
      return new Response(JSON.stringify({
        error: "Recording storage not configured (RECORDING_S3_* env vars required for egress)",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const sessionMode = mf.session_mode === "studio" ? "studio" : "voice";
    const filepath = `mehfils/${mehfilId}/${crypto.randomUUID()}.mp4`;

    const s3Upload: Record<string, unknown> = {
      accessKey: s3Access,
      secret: s3Secret,
      bucket: s3Bucket,
      region: s3Region,
      forcePathStyle,
    };
    if (s3Endpoint) s3Upload.endpoint = s3Endpoint;

    const fileOutput = {
      fileType: EncodedFileType.MP4,
      filepath,
      s3: s3Upload,
    };

    const egressClient = new EgressClient(lkHost, lkKey, lkSecret);
    const info = await egressClient.startRoomCompositeEgress(
      mehfilId,
      { file: fileOutput as never },
      { audioOnly: sessionMode === "voice", layout: "speaker-dark" },
    );

    const egressId = (info as { egressId?: string }).egressId ?? (info as { egress_id?: string }).egress_id;
    if (!egressId) {
      console.error("[mehfil-recording-start] missing egress id", info);
      return new Response(JSON.stringify({ error: "Egress did not return an id" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    await admin.from("mehfils").update({ egress_id: egressId }).eq("id", mehfilId);

    const { data: draft } = await admin.from("mehfil_replays").select("id,published").eq("mehfil_id", mehfilId).eq("host_id", user.id).eq("published", false).eq("deleted", false).maybeSingle();

    const replayPatch = {
      egress_id: egressId,
      replay_processing_status: "recording",
      recording_error: null as string | null,
    };

    if (draft?.id) {
      await admin.from("mehfil_replays").update(replayPatch).eq("id", draft.id);
    } else {
      const id = `mr${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
      await admin.from("mehfil_replays").insert({
        id,
        mehfil_id: mehfilId,
        host_id: user.id,
        audio_url: null,
        video_url: null,
        title: mf.title ?? "Gathering replay",
        published: false,
        deleted: false,
        post_id: null,
        ...replayPatch,
      });
    }

    return new Response(JSON.stringify({ ok: true, egressId }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[mehfil-recording-start]", msg);
    if (mehfilId && hostId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (supabaseUrl && svcKey) {
          const admin = createClient(supabaseUrl, svcKey, { auth: { persistSession: false } });
          const { data: draft } = await admin.from("mehfil_replays").select("id").eq("mehfil_id", mehfilId).eq("host_id", hostId).eq("published", false).eq("deleted", false).maybeSingle();
          const patch = { replay_processing_status: "failed" as const, recording_error: msg.slice(0, 240) };
          if (draft?.id) await admin.from("mehfil_replays").update(patch).eq("id", draft.id);
          else {
            await admin.from("mehfil_replays").insert({
              id: `mr${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`,
              mehfil_id: mehfilId,
              host_id: hostId,
              audio_url: null,
              video_url: null,
              title: mehfilTitle,
              published: false,
              deleted: false,
              post_id: null,
              ...patch,
            });
          }
        }
      } catch {
        /* best-effort failed marker */
      }
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
