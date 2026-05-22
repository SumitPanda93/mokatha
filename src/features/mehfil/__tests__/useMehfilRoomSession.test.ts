import { describe, it, expect } from "vitest";
import {
  presenceRoleFor,
  evaluateJoinCycleGuard,
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
  it("blocks duplicate join when cycle started and LiveKit room active", () => {
    expect(evaluateJoinCycleGuard(true, true)).toEqual({ block: true, resetStarted: false });
  });

  it("resets stale cycle when started but LiveKit room missing", () => {
    expect(evaluateJoinCycleGuard(true, false)).toEqual({ block: false, resetStarted: true });
  });

  it("allows fresh join when cycle not started", () => {
    expect(evaluateJoinCycleGuard(false, false)).toEqual({ block: false, resetStarted: false });
    expect(evaluateJoinCycleGuard(false, true)).toEqual({ block: false, resetStarted: false });
  });
});
