/**
 * Lightweight production diagnostics — piggybacks on analytics_events via trackEvent.
 * No new infra; safe no-op when logged out (trackEvent skips without user).
 */
import { trackEvent } from "@/lib/analytics";

const OPS = "ops_";

export function logOpsEvent(name: string, props: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.debug(`[mk:${OPS}${name}]`, props);
  }
  trackEvent(`${OPS}${name}`, props);
}

export function logRuntimeError(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[mk:error:${context}]`, err);
  logOpsEvent("runtime_error", { context, message });
}
