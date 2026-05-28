import { describe, it, expect, vi, afterEach } from "vitest";
import { Track } from "livekit-client";
import type { Room } from "livekit-client";
import { verifyHostPublish, isVideoElementPlaying, isHostCameraPublication } from "@/lib/livekit";

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

describe("isHostCameraPublication", () => {
  const liveTrack = { mediaStreamTrack: { readyState: "live", enabled: true } as MediaStreamTrack };

  it("returns false for muted, unsubscribed, or non-camera publications", () => {
    expect(
      isHostCameraPublication({
        kind: Track.Kind.Video,
        source: Track.Source.Camera,
        isMuted: true,
        isSubscribed: true,
        track: liveTrack,
      }),
    ).toBe(false);
    expect(
      isHostCameraPublication({
        kind: Track.Kind.Video,
        source: Track.Source.Camera,
        isMuted: false,
        isSubscribed: false,
        track: liveTrack,
      }),
    ).toBe(false);
    expect(
      isHostCameraPublication({
        kind: Track.Kind.Video,
        source: Track.Source.ScreenShare,
        isMuted: false,
        isSubscribed: true,
        track: liveTrack,
      }),
    ).toBe(false);
  });

  it("returns true for subscribed unmuted camera with live media track", () => {
    expect(
      isHostCameraPublication({
        kind: Track.Kind.Video,
        source: Track.Source.Camera,
        isMuted: false,
        isSubscribed: true,
        track: liveTrack,
      }),
    ).toBe(true);
  });
});

describe("isVideoElementPlaying", () => {
  it("returns false for null or detached elements", () => {
    expect(isVideoElementPlaying(null)).toBe(false);
    const v = document.createElement("video");
    expect(isVideoElementPlaying(v)).toBe(false);
  });

  it("returns true when video has current data and is playing", () => {
    const v = document.createElement("video");
    document.body.appendChild(v);
    Object.defineProperty(v, "readyState", { value: HTMLMediaElement.HAVE_CURRENT_DATA, configurable: true });
    Object.defineProperty(v, "paused", { value: false, configurable: true });
    v.srcObject = {} as MediaStream;
    expect(isVideoElementPlaying(v)).toBe(true);
    v.remove();
  });

  it("returns true when paused but buffered to future data", () => {
    const v = document.createElement("video");
    document.body.appendChild(v);
    Object.defineProperty(v, "readyState", { value: HTMLMediaElement.HAVE_FUTURE_DATA, configurable: true });
    Object.defineProperty(v, "paused", { value: true, configurable: true });
    v.srcObject = {} as MediaStream;
    expect(isVideoElementPlaying(v)).toBe(true);
    v.remove();
  });
});

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
  it("returns true when LiveKit and Supabase env vars are set", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "wss://test.livekit.cloud");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.resetModules();
    const { isLiveKitConfigured, getLiveKitConfigError } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(true);
    expect(getLiveKitConfigError()).toBeNull();
  });

  it("returns false when VITE_LIVEKIT_URL is missing", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.resetModules();
    const { isLiveKitConfigured } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(false);
  });

  it("returns false when VITE_LIVEKIT_URL is whitespace only", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "   ");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.resetModules();
    const { isLiveKitConfigured } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(false);
  });

  it("returns false when URL is not wss", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "https://test.livekit.cloud");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.resetModules();
    const { isLiveKitConfigured, getLiveKitConfigError } = await import("@/lib/livekit");
    expect(isLiveKitConfigured()).toBe(false);
    expect(getLiveKitConfigError()).toMatch(/wss:\/\//);
  });
});

describe("connectToMehfil (mocked)", () => {
  it("returns null and calls onError when LiveKit URL is not configured", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
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

describe("getLiveKitConfigError", () => {
  it("reports missing Supabase anon key", async () => {
    vi.stubEnv("VITE_LIVEKIT_URL", "wss://test.livekit.cloud");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.resetModules();
    const { getLiveKitConfigError } = await import("@/lib/livekit");
    expect(getLiveKitConfigError()).toMatch(/VITE_SUPABASE_ANON_KEY/);
  });
});
