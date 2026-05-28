/**
 * Shared LiveKit egress → mehfil_replays helpers for webhook, stop, and reconcile.
 */

export type ReplayPatch = {
  replay_processing_status: "ready" | "failed" | "processing";
  recording_error: string | null;
  audio_url?: string | null;
  video_url?: string | null;
};

function readString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize s3:// and bare keys into https when a public base is configured. */
export function normalizeRecordingUrl(raw: string, publicBase?: string): string {
  const loc = raw.trim();
  if (!loc) return "";
  if (/^https?:\/\//i.test(loc)) return loc;
  if (loc.startsWith("s3://") && publicBase) {
    const withoutScheme = loc.slice("s3://".length);
    const slash = withoutScheme.indexOf("/");
    const key = slash >= 0 ? withoutScheme.slice(slash + 1) : withoutScheme;
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }
  if (publicBase && !loc.includes("://")) {
    return `${publicBase.replace(/\/$/, "")}/${loc.replace(/^\//, "")}`;
  }
  return loc;
}

function locationFromFileInfo(row: Record<string, unknown> | undefined, publicBase?: string): string {
  if (!row) return "";
  const loc = readString(row.location) || readString(row.filename) || readString(row.downloadUrl) || readString(row.download_url);
  return normalizeRecordingUrl(loc, publicBase);
}

/** LiveKit populates deprecated result.file more reliably than fileResults (see livekit/node-sdks#625). */
export function firstOutputLocation(info: Record<string, unknown> | undefined, publicBase?: string): string {
  if (!info) return "";

  const fr = info.fileResults ?? info.file_results;
  if (Array.isArray(fr)) {
    for (const item of fr) {
      const loc = locationFromFileInfo(item as Record<string, unknown>, publicBase);
      if (loc) return loc;
    }
  }

  const legacyFile = info.file as Record<string, unknown> | undefined;
  if (legacyFile) {
    const loc = locationFromFileInfo(legacyFile, publicBase);
    if (loc) return loc;
  }

  const result = info.result as Record<string, unknown> | undefined;
  if (result) {
    if (result.case === "file" && result.value && typeof result.value === "object") {
      const loc = locationFromFileInfo(result.value as Record<string, unknown>, publicBase);
      if (loc) return loc;
    }
    const nestedFile = result.file as Record<string, unknown> | undefined;
    if (nestedFile) {
      const loc = locationFromFileInfo(nestedFile, publicBase);
      if (loc) return loc;
    }
  }

  const manifest = readString(info.manifestLocation ?? info.manifest_location);
  if (manifest) return normalizeRecordingUrl(manifest, publicBase);

  return "";
}

export function egressStatusValue(info: Record<string, unknown> | undefined): number | string | undefined {
  if (!info) return undefined;
  const st = info.status ?? info.egressStatus ?? info.egress_status;
  if (typeof st === "number" || typeof st === "string") return st;
  return undefined;
}

/** Prefer durable output URL; status enums vary by LiveKit version. */
export function egressLooksFailed(info: Record<string, unknown> | undefined, hasUrl: boolean): boolean {
  if (hasUrl) return false;
  if (!info) return false;
  const err = readString(info.error ?? info.errorMessage ?? info.error_message);
  if (err) return true;
  const st = egressStatusValue(info);
  if (typeof st === "string") return /fail|error|abort/i.test(st);
  if (typeof st === "number") return st === 4 || st === 5 || st === 6;
  return false;
}

export function egressLooksComplete(info: Record<string, unknown> | undefined, hasUrl: boolean): boolean {
  if (hasUrl) return true;
  const st = egressStatusValue(info);
  if (typeof st === "string") return /complete/i.test(st);
  if (typeof st === "number") return st === 3;
  return false;
}

export function egressErrorMessage(info: Record<string, unknown> | undefined): string {
  if (!info) return "unknown_egress";
  const err = readString(info.error ?? info.errorMessage ?? info.error_message);
  if (err) return err;
  const st = egressStatusValue(info);
  return typeof st === "string" ? st : "egress_end";
}

export function buildReplayPatchFromEgress(
  info: Record<string, unknown> | undefined,
  studio: boolean,
  publicBase?: string,
): ReplayPatch {
  const url = firstOutputLocation(info, publicBase);
  const failed = egressLooksFailed(info, Boolean(url));
  if (failed) {
    return {
      replay_processing_status: "failed",
      recording_error: egressErrorMessage(info),
    };
  }
  if (url) {
    return {
      replay_processing_status: "ready",
      recording_error: null,
      audio_url: url,
      video_url: studio ? url : null,
    };
  }
  if (egressLooksComplete(info, false)) {
    return {
      replay_processing_status: "failed",
      recording_error: "egress_complete_no_output_url",
    };
  }
  return {
    replay_processing_status: "processing",
    recording_error: null,
  };
}

export function recordingPublicBaseUrl(): string {
  return (
    Deno.env.get("RECORDING_S3_PUBLIC_BASE_URL") ??
    Deno.env.get("RECORDING_PUBLIC_BASE_URL") ??
    ""
  ).trim();
}
