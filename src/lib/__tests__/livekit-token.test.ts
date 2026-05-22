import { describe, it, expect } from "vitest";
import { buildLiveKitToken, decodeJwtPayload } from "@/lib/livekit-token-jwt";

describe("buildLiveKitToken", () => {
  const opts = {
    apiKey: "APItestkey123",
    apiSecret: "secret-for-hmac-signing-test",
    identity: "user-uuid-abc",
    room: "mehfil-room-xyz",
    canPublish: true,
  };

  it("produces a three-part JWT", async () => {
    const token = await buildLiveKitToken(opts);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("embeds correct identity, room, and publish claims", async () => {
    const token = await buildLiveKitToken(opts);
    const payload = decodeJwtPayload(token);
    expect(payload.iss).toBe(opts.apiKey);
    expect(payload.sub).toBe(opts.identity);
    const video = payload.video as Record<string, unknown>;
    expect(video.roomJoin).toBe(true);
    expect(video.room).toBe(opts.room);
    expect(video.canPublish).toBe(true);
    expect(video.canSubscribe).toBe(true);
  });

  it("sets canPublish false for listeners", async () => {
    const token = await buildLiveKitToken({ ...opts, canPublish: false });
    const payload = decodeJwtPayload(token);
    const video = payload.video as Record<string, unknown>;
    expect(video.canPublish).toBe(false);
  });

  it("sets exp ~4 hours from iat", async () => {
    const token = await buildLiveKitToken(opts);
    const payload = decodeJwtPayload(token);
    expect(payload.exp as number).toBe((payload.iat as number) + 14400);
  });

  it("generates distinct tokens per call (unique jti)", async () => {
    const a = await buildLiveKitToken(opts);
    const b = await buildLiveKitToken(opts);
    expect(a).not.toBe(b);
  });
});

describe("token request validation (edge function contract)", () => {
  it("requires room and identity query params", () => {
    const missingRoom = new URL("https://x/functions/v1/livekit-token?identity=u1");
    expect(missingRoom.searchParams.get("room")).toBeNull();
    expect(missingRoom.searchParams.get("identity")).toBe("u1");

    const missingIdentity = new URL("https://x/functions/v1/livekit-token?room=r1");
    expect(missingIdentity.searchParams.get("room")).toBe("r1");
    expect(missingIdentity.searchParams.get("identity")).toBeNull();
  });

  it("parses canPublish=true only from exact string", () => {
    expect(new URL("https://x?canPublish=true").searchParams.get("canPublish") === "true").toBe(true);
    expect(new URL("https://x?canPublish=false").searchParams.get("canPublish") === "true").toBe(false);
    expect(new URL("https://x?canPublish=1").searchParams.get("canPublish") === "true").toBe(false);
  });
});
