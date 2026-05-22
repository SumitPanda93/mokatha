/**
 * LiveKit JWT builder — shared between edge function logic and unit tests.
 * Mirrors supabase/functions/livekit-token/index.ts
 */

function b64url(input: string): string {
  return btoa(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export type LiveKitTokenOpts = {
  apiKey: string;
  apiSecret: string;
  identity: string;
  room: string;
  canPublish: boolean;
};

export async function buildLiveKitToken(opts: LiveKitTokenOpts): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: opts.apiKey,
      sub: opts.identity,
      iat: now,
      exp: now + 14400,
      nbf: now - 5,
      jti: crypto.randomUUID(),
      video: {
        roomJoin: true,
        room: opts.room,
        canPublish: opts.canPublish,
        canSubscribe: true,
        hidden: false,
      },
    }),
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(opts.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));

  return `${header}.${payload}.${b64urlBytes(sig)}`;
}

/** Decode JWT payload (no verify) — test helper only. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}
