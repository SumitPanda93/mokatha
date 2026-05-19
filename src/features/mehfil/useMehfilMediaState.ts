/**
 * Centralized Mehfil media lifecycle — replaces scattered connection/publish booleans.
 */
import { useCallback, useRef, useState } from "react";

export type MehfilMediaPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "publishing"
  | "published"
  | "subscribed"
  | "recovering"
  | "failed";

export type MehfilMediaFailure = {
  camera?: string;
  mic?: string;
  remote?: string;
};

export function useMehfilMediaState() {
  const [phase, setPhase] = useState<MehfilMediaPhase>("idle");
  const [failure, setFailure] = useState<MehfilMediaFailure | null>(null);
  const phaseRef = useRef<MehfilMediaPhase>("idle");

  const transition = useCallback((next: MehfilMediaPhase, fail?: MehfilMediaFailure | null) => {
    phaseRef.current = next;
    setPhase(next);
    if (fail !== undefined) setFailure(fail);
    else if (next !== "failed") setFailure(null);
  }, []);

  const reset = useCallback(() => {
    phaseRef.current = "idle";
    setPhase("idle");
    setFailure(null);
  }, []);

  const markFailed = useCallback((fail: MehfilMediaFailure) => {
    phaseRef.current = "failed";
    setPhase("failed");
    setFailure(fail);
  }, []);

  return {
    phase,
    phaseRef,
    failure,
    transition,
    reset,
    markFailed,
    setFailure,
  };
}
