/**
 * Supabase Edge Function: livekit-token
 * Generates a LiveKit JWT access token for a participant to join a Mehfil room.
 *
 * Required env vars (set in Supabase dashboard → Project Settings → Edge Functions):
 *   LIVEKIT_API_KEY     — your LiveKit API key (e.g. "APIxxxxxx")
 *   LIVEKIT_API_SECRET  — your LiveKit API secret
 *
 * Usage:
 *   GET /functions/v1/livekit-token?room=<mehfilId>&identity=<userId>&canPublish=<true|false>
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const room       = url.searchParams.get("room");
    const identity   = url.searchParams.get("identity");
    const canPublish = url.searchParams.get("canPublish") === "true";

    if (!room || !identity) {
      return new Response(JSON.stringify({ error: "Missing room or identity" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Verify caller when a user JWT is supplied (anon key alone is allowed for token bootstrap)
    const authHeader = req.headers.get("Authorization");
    if (authHeader && !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Invalid Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabase.auth.getUser();
      // Identity must match authenticated user for security
      if (user && user.id !== identity) {
        return new Response(JSON.stringify({ error: "Identity mismatch" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    const apiKey    = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "LiveKit credentials not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const token = await buildLiveKitToken({ apiKey, apiSecret, identity, room, canPublish });

    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});

// ─── JWT builder (no external SDK needed) ─────────────────────────────────────

function b64url(input: string): string {
  return btoa(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function buildLiveKitToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  room: string;
  canPublish: boolean;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: opts.apiKey,
    sub: opts.identity,
    iat: now,
    exp: now + 14400,   // 4-hour expiry
    nbf: now - 5,
    jti: crypto.randomUUID(),
    video: {
      roomJoin:     true,
      room:         opts.room,
      canPublish:   opts.canPublish,
      canSubscribe: true,
      hidden:       false,
    },
  }));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(opts.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return `${header}.${payload}.${b64urlBytes(sig)}`;
}
