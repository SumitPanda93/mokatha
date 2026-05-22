import { describe, it, expect, vi, afterEach } from "vitest";
import { Track } from "livekit-client";
import type { Room } from "livekit-client";
import { verifyHostPublish } from "@/lib/livekit";

type MockPub = { kind: Track.Kind; track: object | null; isMuted: boolean; unmute?: () => Promise<void> };

function mockRoom(pubs: MockPub[]): Room {
  const trackPublications = new Map<string, MockPub>();
  const audioTrackPublications = new Map<string, MockPub>();
  pubs.forEach((p, i) => {
    trackPublications.set(String(i), p);
    if (p.kind === Track.Kind.Audio) {
      audioTrackPublications.set(String(i), p);
    }
  });
  return {
    localParticipant: {
      trackPublications,
      audioTrackPublications,
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Room;
}

describe("verifyHostPublish", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ok when mic is already published (audio-only)", async () => {
    const room = mockRoom([{ kind: Track.Kind.Audio, track: { unmute: vi.fn() }, isMuted: false }]);
    const result = await verifyHostPublish(room, { needCamera: false, roomId: "room-1" });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok when mic and camera are published (studio)", async () => {
    const room = mockRoom([
      { kind: Track.Kind.Audio, track: { unmute: vi.fn() }, isMuted: false },
      { kind: Track.Kind.Video, track: {}, isMuted: false },
    ]);
    const result = await verifyHostPublish(room, { needCamera: true, roomId: "room-1" });
    expect(result).toEqual({ ok: true });
  });

  it("retries enable* and succeeds on second attempt", async () => {
    vi.useFakeTimers();
    const room = mockRoom([]);
    const lp = room.localParticipant as unknown as {
      trackPublications: Map<string, MockPub>;
      audioTrackPublications: Map<string, MockPub>;
      setMicrophoneEnabled: ReturnType<typeof vi.fn>;
    };
    lp.setMicrophoneEnabled.mockImplementation(async () => {
      const pub = { kind: Track.Kind.Audio, track: { unmute: vi.fn() }, isMuted: false };
      lp.trackPublications.set("0", pub);
      lp.audioTrackPublications.set("0", pub);
    });

    const promise = verifyHostPublish(room, { needCamera: false, roomId: "room-1" });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ ok: true });
  });

  it("returns failure after retries when mic never publishes", async () => {
    vi.useFakeTimers();
    const room = mockRoom([]);
    const promise = verifyHostPublish(room, { needCamera: false, roomId: "room-1" });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ ok: false, cameraFailed: false, micFailed: true });
  });

  it("uses republishPreflight callback when provided", async () => {
    vi.useFakeTimers();
    const room = mockRoom([]);
    const lp = room.localParticipant as unknown as {
      trackPublications: Map<string, MockPub>;
      audioTrackPublications: Map<string, MockPub>;
    };
    const republish = vi.fn().mockImplementation(async () => {
      const pub = { kind: Track.Kind.Audio, track: { unmute: vi.fn() }, isMuted: false };
      lp.trackPublications.set("0", pub);
      lp.audioTrackPublications.set("0", pub);
    });
    const promise = verifyHostPublish(room, {
      needCamera: false,
      roomId: "room-1",
      republishPreflight: republish,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(republish).toHaveBeenCalled();
  });
});

describe("isLiveKitConfigured", () => {
  it("returns true when VITE_LIVEKIT_URL is set", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "wss://test.livekit.cloud");
    vi.resetModules();
    const { isLiveKitConfigured } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(true);
  });

  it("returns false when VITE_LIVEKIT_URL is missing", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "");
    vi.resetModules();
    const { isLiveKitConfigured } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(false);
  });
});

describe("connectToMehfil (mocked)", () => {
  it("returns null and calls onError when LiveKit URL is not configured", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.resetModules();

    const onError = vi.fn();
    const { connectToMehfil } = await import("@/lib/livekit");
    const result = await connectToMehfil("room-1", "user-1", false, { onError });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("VITE_LIVEKIT_URL") }),
    );
  });
});
