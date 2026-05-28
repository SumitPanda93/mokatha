/**
 * Client-side mirror of supabase/functions/_shared/egressReplay.ts for unit tests.
 */
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

function readString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function locationFromFileInfo(row: Record<string, unknown> | undefined, publicBase?: string): string {
  if (!row) return "";
  const loc = readString(row.location) || readString(row.filename) || readString(row.downloadUrl) || readString(row.download_url);
  return normalizeRecordingUrl(loc, publicBase);
}

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

  return "";
}

export function egressLooksFailed(info: Record<string, unknown> | undefined, hasUrl: boolean): boolean {
  if (hasUrl) return false;
  if (!info) return false;
  const err = readString(info.error ?? info.errorMessage ?? info.error_message);
  if (err) return true;
  const st = info.status ?? info.egressStatus ?? info.egress_status;
  if (typeof st === "string") return /fail|error|abort/i.test(st);
  if (typeof st === "number") return st === 4 || st === 5 || st === 6;
  return false;
}
