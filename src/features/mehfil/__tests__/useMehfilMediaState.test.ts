import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMehfilMediaState } from "@/features/mehfil/useMehfilMediaState";

describe("useMehfilMediaState", () => {
  it("starts in idle phase with no failure", () => {
    const { result } = renderHook(() => useMehfilMediaState());
    expect(result.current.phase).toBe("idle");
    expect(result.current.failure).toBeNull();
    expect(result.current.phaseRef.current).toBe("idle");
  });

  it("transitions through connect → publish lifecycle", () => {
    const { result } = renderHook(() => useMehfilMediaState());

    act(() => result.current.transition("connecting"));
    expect(result.current.phase).toBe("connecting");

    act(() => result.current.transition("connected"));
    expect(result.current.phase).toBe("connected");
    expect(result.current.failure).toBeNull();

    act(() => result.current.transition("publishing"));
    act(() => result.current.transition("published"));
    expect(result.current.phase).toBe("published");
  });

  it("markFailed sets failed phase and failure details", () => {
    const { result } = renderHook(() => useMehfilMediaState());

    act(() => result.current.markFailed({ mic: "Permission denied", remote: "timeout" }));
    expect(result.current.phase).toBe("failed");
    expect(result.current.failure).toEqual({ mic: "Permission denied", remote: "timeout" });
    expect(result.current.phaseRef.current).toBe("failed");
  });

  it("reset clears phase and failure", () => {
    const { result } = renderHook(() => useMehfilMediaState());

    act(() => result.current.markFailed({ remote: "error" }));
    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.failure).toBeNull();
  });

  it("transition to non-failed clears failure unless explicit fail arg", () => {
    const { result } = renderHook(() => useMehfilMediaState());

    act(() => result.current.markFailed({ remote: "x" }));
    act(() => result.current.transition("recovering"));
    expect(result.current.failure).toBeNull();
    expect(result.current.phase).toBe("recovering");
  });

  it("supports recovering phase for reconnect UX", () => {
    const { result } = renderHook(() => useMehfilMediaState());

    act(() => result.current.transition("connected"));
    act(() => result.current.transition("recovering"));
    expect(result.current.phase).toBe("recovering");
    act(() => result.current.transition("connected"));
    expect(result.current.phase).toBe("connected");
  });
});
