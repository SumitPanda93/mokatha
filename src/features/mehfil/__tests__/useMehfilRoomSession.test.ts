import { describe, it, expect } from "vitest";
import {
  presenceRoleFor,
  evaluateJoinCycleGuard,
  formatLiveKitConnectError,
} from "@/features/mehfil/useMehfilRoomSession";

describe("presenceRoleFor", () => {
  it("returns host when meHost is true", () => {
    expect(presenceRoleFor(true, false)).toBe("host");
    expect(presenceRoleFor(true, true)).toBe("host");
  });

  it("returns speaker when not host but queueSpeaking", () => {
    expect(presenceRoleFor(false, true)).toBe("speaker");
  });

  it("returns listener when not host and not speaking", () => {
    expect(presenceRoleFor(false, false)).toBe("listener");
  });
});

describe("evaluateJoinCycleGuard", () => {
  it("blocks duplicate join when joined and cycle started with LiveKit room active", () => {
    expect(evaluateJoinCycleGuard(true, true, true)).toEqual({ block: true, resetStarted: false });
  });

  it("blocks duplicate join when joined and cycle started but LiveKit still connecting", () => {
    expect(evaluateJoinCycleGuard(true, false, true)).toEqual({ block: true, resetStarted: false });
  });

  it("resets stale cycle when not joined but refs linger", () => {
    expect(evaluateJoinCycleGuard(true, false, false)).toEqual({ block: false, resetStarted: true });
    expect(evaluateJoinCycleGuard(true, true, false)).toEqual({ block: false, resetStarted: true });
    expect(evaluateJoinCycleGuard(false, true, false)).toEqual({ block: false, resetStarted: true });
  });

  it("allows fresh join when cycle not started", () => {
    expect(evaluateJoinCycleGuard(false, false, false)).toEqual({ block: false, resetStarted: false });
    expect(evaluateJoinCycleGuard(false, true, false)).toEqual({ block: false, resetStarted: true });
  });
});

describe("formatLiveKitConnectError", () => {
  it("maps livekit_timeout to a friendly studio message", () => {
    expect(formatLiveKitConnectError("livekit_timeout")).toContain("timed out");
    expect(formatLiveKitConnectError("livekit_timeout")).not.toBe("livekit_timeout");
  });

  it("preserves token fetch errors", () => {
    const msg = "Token fetch failed (401): Not signed in";
    expect(formatLiveKitConnectError(msg)).toBe(msg);
  });

  it("maps connect failures to actionable copy", () => {
    expect(formatLiveKitConnectError("livekit_connect_failed")).toContain("live audio");
  });
});
