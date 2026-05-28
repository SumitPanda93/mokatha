/**
 * LiveKit audio utilities for Mehfil live rooms.
 *
 * Required env var:
 *   VITE_LIVEKIT_URL — wss://your-project.livekit.cloud (or self-hosted)
 *
 * Token generation is handled by the Supabase edge function at
 * /functions/v1/livekit-token.
 */

import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  RemoteTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  ConnectionState,
  RoomOptions,
  ParticipantEvent,
  VideoPresets,
  LocalVideoTrack,
  LocalAudioTrack,
} from "livekit-client";
import { supabase } from "./supabase";
import { logOpsEvent } from "./observability";

export interface LiveKitRoom {
  room: Room;
  disconnect: () => void;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  getParticipantCount: () => number;
  /** Call on any user gesture to unblock audio autoplay on mobile. */
  enableAudio: () => void;
  /** Whether audio is currently blocked by browser autoplay policy. */
  isAudioBlocked: () => boolean;
  /** Manually re-sync remote audio attachments + playback (tab focus, recovery). */
  primeRemotePlayback: (reason: string) => void;
  /** Attach studio mounts — pass only keys you have; omit keys to avoid wiping mounts when refs are briefly null. */
  bindVideoElements(opts: Partial<{ local: HTMLElement | null; remote: HTMLElement | null }>): void;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  /** Host-only: verify mic (+ camera when studio) published after connect. */
  verifyHostTracksPublished: (needCamera: boolean) => Promise<HostPublishResult>;
  /** Listener recovery — re-attach + verify remote host playback. */
  ensureRemotePlayback: (reason: string) => void;
  /** Whether the remote host has an active (unmuted, subscribed) camera track. */
  isRemoteHostVideoAvailable: () => boolean;
}

export type MehfilPreflightTracks = {
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
};

export type MehfilLiveKitOpts = {
  /** Host publishes camera (studio Mehfil). */
  publishCamera?: boolean;
  /** Listener attaches remote camera from this identity (= Mehfil host user id). */
  remoteHostIdentity?: string | null;
  /** Reuse studio preflight tracks — skips setCameraEnabled / setMicrophoneEnabled getUserMedia. */
  preflightTracks?: MehfilPreflightTracks | null;
};

export interface LiveKitCallbacks {
  onParticipantCountChange?: (count: number) => void;
  onSpeakerChange?: (participantIdentity: string | null) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (err: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  /** Browser autoplay policy blocked remote playback until user gesture. */
  onAudioBlocked?: () => void;
  /** Fires when local mic enable state changes (publisher only). */
  onMicrophoneEnabledChanged?: (enabled: boolean) => void;
  /** Fires when the remote host's camera track becomes available or goes away (listeners). */
  onRemoteHostVideoChange?: (available: boolean) => void;
}

function envTrim(key: string): string | undefined {
  const raw = import.meta.env[key] as string | undefined;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

/** Trimmed LiveKit WebSocket URL from VITE_LIVEKIT_URL. */
export function getLiveKitUrl(): string | undefined {
  return envTrim("VITE_LIVEKIT_URL");
}

function getSupabaseFunctionsOrigin(): string | undefined {
  return envTrim("VITE_SUPABASE_URL");
}

function getSupabaseAnonKey(): string | undefined {
  return envTrim("VITE_SUPABASE_ANON_KEY");
}

/**
 * Returns a user-facing config error, or null when LiveKit + Supabase env are ready.
 */
export function getLiveKitConfigError(): string | null {
  const url = getLiveKitUrl();
  if (!url) {
    return "VITE_LIVEKIT_URL is not set — add wss://…livekit.cloud to .env.local and restart the dev server.";
  }
  if (!/^wss:\/\/.+/i.test(url)) {
    return `VITE_LIVEKIT_URL must start with wss:// (current: ${url.slice(0, 48)}${url.length > 48 ? "…" : ""})`;
  }
  if (!getSupabaseFunctionsOrigin()) {
    return "VITE_SUPABASE_URL is not set — cannot fetch LiveKit token.";
  }
  if (!getSupabaseAnonKey()) {
    return "VITE_SUPABASE_ANON_KEY is not set — cannot fetch LiveKit token.";
  }
  return null;
}

const AUDIO_LOG_PREFIX = "[LiveKit:audio]";
const MEHFIL_LOG_PREFIX = "[Mehfil]";
const ROOM_CONNECT_TIMEOUT_MS = 22_000;

async function connectRoomWithTimeout(
  room: Room,
  liveKitUrl: string,
  token: string,
  roomId: string,
): Promise<void> {
  let timer: number | undefined;
  try {
    await Promise.race([
      room.connect(liveKitUrl, token, { autoSubscribe: true }),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(
            new Error(
              `LiveKit room.connect timed out after ${Math.round(ROOM_CONNECT_TIMEOUT_MS / 1000)}s — verify VITE_LIVEKIT_URL (${liveKitUrl.slice(0, 48)}…) and network.`,
            ),
          );
        }, ROOM_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    if (room.state !== ConnectionState.Disconnected) {
      try {
        room.disconnect();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
  mehfilLog("room_connected", { room_id: roomId });
}

function audioLog(event: string, detail: Record<string, unknown> = {}) {
  const payload = { event, room_id: detail.room_id ?? "", ...detail };
  if (import.meta.env.DEV) console.info(AUDIO_LOG_PREFIX, payload);
  const forwardOps = new Set([
    "subscription_failed",
    "playback_retry_cap",
    "media_devices_error",
    "mic_enable_error",
    "set_mic_error",
    "subscribe_failed",
  ]);
  if (forwardOps.has(event)) {
    logOpsEvent(`livekit_${event}`, payload as Record<string, unknown>);
  }
}

/** DEV-only structured Mehfil media tracing. */
function mehfilLog(event: string, detail: Record<string, unknown> = {}) {
  if (!import.meta.env.DEV) return;
  console.info(MEHFIL_LOG_PREFIX, { event, ...detail });
}

/** @deprecated use mehfilLog */
function mediaLog(event: string, detail: Record<string, unknown> = {}) {
  mehfilLog(event, detail);
}

export type HostPublishResult =
  | { ok: true }
  | { ok: false; cameraFailed: boolean; micFailed: boolean };

const HOST_PUBLISH_RETRY_MS = [200, 600, 1200] as const;

/** Published local tracks (mute state ignored — used for publish verification). */
function countPublishedTracks(room: Room, kind: Track.Kind): number {
  let n = 0;
  room.localParticipant.trackPublications.forEach((pub) => {
    if (pub.kind !== kind) return;
    if (pub.track) n += 1;
  });
  return n;
}

function countActivePublications(
  room: Room,
  kind: Track.Kind,
): number {
  let n = 0;
  room.localParticipant.trackPublications.forEach((pub) => {
    if (pub.kind !== kind) return;
    if (pub.track && !pub.isMuted) n += 1;
  });
  return n;
}

async function unmuteLocalAudioPublications(room: Room): Promise<void> {
  for (const pub of room.localParticipant.audioTrackPublications.values()) {
    const track = pub.track;
    if (!track || !("unmute" in track)) continue;
    try {
      await (track as LocalAudioTrack).unmute();
    } catch {
      /* ignore */
    }
  }
}

/** Host mic gate — preflight publish, then SDK enable*, always unmute published audio. */
async function ensureHostMicPublished(
  room: Room,
  preflight: MehfilPreflightTracks | null,
  roomId: string,
): Promise<boolean> {
  if (countPublishedTracks(room, Track.Kind.Audio) > 0) {
    await unmuteLocalAudioPublications(room);
    return true;
  }
  if (preflight?.audioTrack?.readyState === "live") {
    const pub = await publishPreflightTracks(room, preflight, false, roomId);
    if (pub.localAudio) {
      try {
        await pub.localAudio.unmute();
      } catch {
        /* ignore */
      }
      return true;
    }
  }
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
    await unmuteLocalAudioPublications(room);
  } catch (e) {
    mehfilLog("host_mic_enable_error", {
      room_id: roomId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  return countPublishedTracks(room, Track.Kind.Audio) > 0;
}

/** Host publish gate — retries publish (preflight) or enable* before reporting failure. */
export async function verifyHostPublish(
  room: Room,
  opts: {
    needCamera: boolean;
    roomId?: string;
    /** When set, retries republish existing tracks instead of new getUserMedia. */
    republishPreflight?: () => Promise<void>;
  },
): Promise<HostPublishResult> {
  const roomId = opts.roomId ?? "";
  const needCamera = opts.needCamera;
  const usePreflight = Boolean(opts.republishPreflight);

  const attempt = async (label: string) => {
    let micOk = countPublishedTracks(room, Track.Kind.Audio) > 0;
    let camOk = !needCamera || countPublishedTracks(room, Track.Kind.Video) > 0;
    if (!micOk || (needCamera && !camOk)) {
      mehfilLog("host_publish_retry", { room_id: roomId, phase: label, preflight: usePreflight });
      try {
        if (usePreflight && opts.republishPreflight) {
          await opts.republishPreflight();
        } else {
          if (!micOk) await room.localParticipant.setMicrophoneEnabled(true);
          if (needCamera && !camOk) await room.localParticipant.setCameraEnabled(true);
        }
        if (!micOk) await unmuteLocalAudioPublications(room);
      } catch (e) {
        mehfilLog("host_publish_error", { room_id: roomId, message: e instanceof Error ? e.message : String(e) });
      }
      micOk = countPublishedTracks(room, Track.Kind.Audio) > 0;
      camOk = !needCamera || countPublishedTracks(room, Track.Kind.Video) > 0;
    }
    if (micOk) await unmuteLocalAudioPublications(room);
    if (micOk) mehfilLog("mic_publish_ok", { room_id: roomId, phase: label });
    if (needCamera && camOk) mehfilLog("camera_publish_ok", { room_id: roomId, phase: label });
    return { micOk, camOk };
  };

  let micOk = false;
  let camOk = !needCamera;
  for (let i = 0; i < HOST_PUBLISH_RETRY_MS.length; i++) {
    const ms = HOST_PUBLISH_RETRY_MS[i];
    if (ms > 0) await new Promise((r) => window.setTimeout(r, ms));
    const r = await attempt(`t${ms}`);
    micOk = r.micOk;
    camOk = r.camOk;
    if (micOk && camOk) return { ok: true };
  }

  return { ok: false, cameraFailed: needCamera && !camOk, micFailed: !micOk };
}

/** Host camera publication listeners should treat as live studio video (not screen share / stale). */
export function isHostCameraPublication(pub: {
  kind: Track.Kind;
  source?: Track.Source;
  isMuted: boolean;
  isSubscribed?: boolean;
  track?: { mediaStreamTrack?: MediaStreamTrack } | null;
}): boolean {
  if (pub.kind !== Track.Kind.Video) return false;
  if (pub.source != null && pub.source !== Track.Source.Camera) return false;
  if (pub.isMuted) return false;
  if (!pub.isSubscribed || !pub.track) return false;
  const mt = pub.track.mediaStreamTrack;
  if (!mt || mt.readyState === "ended") return false;
  if (!mt.enabled) return false;
  return true;
}

/** Whether a mounted remote/local preview `<video>` is receiving frames and playing. */
export function isVideoElementPlaying(el: HTMLVideoElement | null | undefined): boolean {
  if (!el || !document.body.contains(el)) return false;
  if (!el.srcObject) return false;
  if (el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  return !el.paused || el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
}

function videoPlaybackReady(el: HTMLVideoElement | undefined): boolean {
  return isVideoElementPlaying(el);
}

function audioPlaybackReady(el: HTMLAudioElement | undefined): boolean {
  if (!el || !document.body.contains(el)) return false;
  if (!el.srcObject) return false;
  return !el.paused;
}

async function publishPreflightTracks(
  room: Room,
  preflight: MehfilPreflightTracks,
  needCamera: boolean,
  roomId: string,
): Promise<{ localVideo?: LocalVideoTrack; localAudio?: LocalAudioTrack }> {
  const lp = room.localParticipant;
  let localVideo: LocalVideoTrack | undefined;
  let localAudio: LocalAudioTrack | undefined;

  if (
    preflight.audioTrack &&
    preflight.audioTrack.readyState === "live" &&
    countPublishedTracks(room, Track.Kind.Audio) === 0
  ) {
    try {
      const pub = await lp.publishTrack(preflight.audioTrack, { source: Track.Source.Microphone });
      localAudio = pub.track as LocalAudioTrack;
      try {
        await localAudio.unmute();
      } catch {
        /* ignore */
      }
      mehfilLog("preflight_audio_published", { room_id: roomId });
    } catch (e) {
      mehfilLog("preflight_audio_publish_error", {
        room_id: roomId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (
    needCamera &&
    preflight.videoTrack &&
    preflight.videoTrack.readyState === "live" &&
    countPublishedTracks(room, Track.Kind.Video) === 0
  ) {
    try {
      const pub = await lp.publishTrack(preflight.videoTrack, { source: Track.Source.Camera });
      localVideo = pub.track as LocalVideoTrack;
      try {
        await localVideo.unmute();
      } catch {
        /* ignore */
      }
      mehfilLog("preflight_video_published", { room_id: roomId });
    } catch (e) {
      mehfilLog("preflight_video_publish_error", {
        room_id: roomId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { localVideo, localAudio };
}

function parseTokenErrorBody(status: number, bodyText: string): string {
  try {
    const json = JSON.parse(bodyText) as { error?: string };
    if (typeof json.error === "string" && json.error.trim()) return json.error;
  } catch {
    /* not JSON */
  }
  const trimmed = bodyText.trim();
  if (status === 401) {
    return trimmed || "Not signed in — sign in again, then rejoin the Mehfil.";
  }
  if (status === 403) {
    return trimmed || "Identity mismatch — refresh the page and rejoin.";
  }
  if (status === 500 && /credentials not configured/i.test(trimmed)) {
    return "LiveKit API keys missing on Supabase — set LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the livekit-token edge function.";
  }
  return trimmed || `HTTP ${status}`;
}

/** Fetch a LiveKit token from the Supabase edge function */
async function fetchToken(roomId: string, identity: string, canPublish: boolean): Promise<string> {
  const origin = getSupabaseFunctionsOrigin();
  const anonKey = getSupabaseAnonKey();
  if (!origin || !anonKey) {
    throw new Error(getLiveKitConfigError() ?? "Supabase is not configured for LiveKit tokens.");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const bearer = session?.access_token ?? anonKey;

  const url =
    `${origin}/functions/v1/livekit-token?room=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(identity)}&canPublish=${canPublish}`;

  mehfilLog("token_fetch_start", { room_id: roomId, identity, can_publish: canPublish, has_session: Boolean(session?.access_token) });

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        apikey: anonKey,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mehfilLog("token_fetch_network_error", { room_id: roomId, message: msg });
    throw new Error(`Token fetch network error: ${msg}`);
  }

  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    const detail = parseTokenErrorBody(res.status, bodyText);
    const err = new Error(`Token fetch failed (${res.status}): ${detail}`);
    mehfilLog("token_fetch_failed", { room_id: roomId, status: res.status, message: detail });
    throw err;
  }

  let token: string | undefined;
  let apiError: string | undefined;
  try {
    const json = JSON.parse(bodyText) as { token?: string; error?: string };
    token = json.token;
    apiError = json.error;
  } catch {
    throw new Error("Token fetch failed: invalid JSON response from livekit-token");
  }
  if (apiError) throw new Error(apiError);
  if (!token) throw new Error("Token fetch failed: response missing token");
  mehfilLog("token_fetch_ok", { room_id: roomId });
  return token;
}

/**
 * Connect to a LiveKit room.
 * Returns a controller object; call `disconnect()` on cleanup.
 */
export async function connectToMehfil(
  roomId: string,
  userId: string,
  canPublish: boolean,
  callbacks: LiveKitCallbacks = {},
  opts: MehfilLiveKitOpts = {},
): Promise<LiveKitRoom | null> {
  const liveKitUrl = getLiveKitUrl();
  const configErr = getLiveKitConfigError();
  if (!liveKitUrl || configErr) {
    const err = new Error(configErr ?? "VITE_LIVEKIT_URL is not set — Mehfil studio cannot connect.");
    mehfilLog("connect_config_error", { room_id: roomId, message: err.message });
    console.warn("[LiveKit]", err.message);
    callbacks.onError?.(err);
    return null;
  }

  let token: string;
  try {
    token = await fetchToken(roomId, userId, canPublish);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LiveKit] Token fetch error", err);
    mehfilLog("connect_token_error", { room_id: roomId, message });
    callbacks.onError?.(err instanceof Error ? err : new Error(message));
    return null;
  }

  const publishCamera = Boolean(canPublish && opts.publishCamera);
  const preflightTracks = opts.preflightTracks ?? null;
  const hasPreflight =
    Boolean(preflightTracks?.audioTrack?.readyState === "live") ||
    Boolean(preflightTracks?.videoTrack?.readyState === "live");
  const remoteHostIdRaw = opts.remoteHostIdentity ?? null;
  /** Normalize LiveKit participant identity vs DB UUID (case / whitespace drift). */
  const normId = (id: string) => id.trim().toLowerCase();
  const remoteHostIdNorm = remoteHostIdRaw ? normId(remoteHostIdRaw) : null;

  const roomOpts: RoomOptions = {
    /** Mehfil rooms are small — disable adaptiveStream so listeners get host camera without element-size gating. */
    adaptiveStream: false,
    /** Small rooms (Mehfil): disable dynacast for more predictable subscriber track delivery. */
    dynacast: false,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    videoCaptureDefaults: publishCamera ? { resolution: VideoPresets.h720.resolution } : undefined,
  };

  const room = new Room(roomOpts);

  let publishedPreflightVideo: LocalVideoTrack | undefined;
  let publishedPreflightAudio: LocalAudioTrack | undefined;

  const republishPreflight = async () => {
    if (!preflightTracks || !canPublish) return;
    const micMissing = countPublishedTracks(room, Track.Kind.Audio) === 0;
    const camMissing = publishCamera && countPublishedTracks(room, Track.Kind.Video) === 0;
    if (!micMissing && !camMissing) return;
    const next = await publishPreflightTracks(room, preflightTracks, publishCamera, roomId);
    if (next.localAudio) publishedPreflightAudio = next.localAudio;
    if (next.localVideo) publishedPreflightVideo = next.localVideo;
    scheduleAttachFlush("preflight_republish");
  };

  /** Portrait-forward mounted previews — avoids churn during reconnects */
  let localVideoMount: HTMLElement | null = null;
  let remoteVideoMount: HTMLElement | null = null;
  const localVideoBySid = new Map<string, HTMLVideoElement>();
  const remoteVideoBySid = new Map<string, HTMLVideoElement>();

  /** Host camera sometimes arrives before React attaches remote `<div />`; replay attach once mount exists. */
  let pendingHostVideo: {
    track: RemoteTrack;
    publication: RemoteTrackPublication;
    participantIdentity: string;
  } | null = null;
  const wiredHostVideoPubs = new Set<string>();

  function clearPendingHostVideo() {
    pendingHostVideo = null;
  }

  async function tryPlayRemoteVideo(el: HTMLVideoElement, trackSid: string, reason: string): Promise<boolean> {
    if (isVideoElementPlaying(el)) {
      mehfilLog("remote_video_playing", { room_id: roomId, track_sid: trackSid, reason });
      return true;
    }
    try {
      await el.play();
      if (isVideoElementPlaying(el)) {
        mehfilLog("remote_video_playing", { room_id: roomId, track_sid: trackSid, reason });
        return true;
      }
    } catch (e) {
      mehfilLog("remote_video_play_failed", {
        room_id: roomId,
        track_sid: trackSid,
        reason,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return false;
  }

  function wireHostVideoPublication(pub: RemoteTrackPublication, participantIdentity: string) {
    if (!remoteHostIdNorm || normId(participantIdentity) !== remoteHostIdNorm) return;
    if (pub.kind !== Track.Kind.Video || pub.source !== Track.Source.Camera) return;
    if (wiredHostVideoPubs.has(pub.trackSid)) return;
    wiredHostVideoPubs.add(pub.trackSid);

    ensureRemoteVideoSubscribed(pub, participantIdentity);

    const onSubscribed = (track: RemoteTrack) => {
      mehfilLog("remote_video_subscribed", {
        room_id: roomId,
        track_sid: pub.trackSid,
        identity: participantIdentity,
        via: "publication_event",
      });
      mountRemoteVideo(track, pub, participantIdentity);
      notifyRemoteHostVideo("publication_subscribed");
    };

    if (pub.track && pub.isSubscribed) {
      onSubscribed(pub.track as RemoteTrack);
    }

    pub.on(TrackEvent.Subscribed, onSubscribed);
    pub.on(TrackEvent.Unsubscribed, () => {
      if (pendingHostVideo?.publication.trackSid === pub.trackSid) clearPendingHostVideo();
      remoteVideoBySid.delete(pub.trackSid);
      notifyRemoteHostVideo("publication_unsubscribed");
    });
    pub.on(TrackEvent.Muted, () => {
      if (remoteVideoMount) clearVideos(remoteVideoMount);
      remoteVideoBySid.clear();
      notifyRemoteHostVideo("publication_muted");
    });
    pub.on(TrackEvent.Unmuted, () => {
      notifyRemoteHostVideo("publication_unmuted");
      scheduleAttachFlush("publication_unmuted");
    });
  }

  function isRemoteHostVideoAvailable(): boolean {
    if (!remoteHostIdNorm) return false;
    for (const participant of room.remoteParticipants.values()) {
      if (normId(participant.identity) !== remoteHostIdNorm) continue;
      for (const pub of participant.trackPublications.values()) {
        if (isHostCameraPublication(pub as RemoteTrackPublication)) return true;
      }
    }
    return false;
  }

  let lastRemoteHostVideo = false;
  function notifyRemoteHostVideo(reason: string) {
    if (!remoteHostIdNorm || !callbacks.onRemoteHostVideoChange) return;
    const next = isRemoteHostVideoAvailable();
    if (next === lastRemoteHostVideo) return;
    lastRemoteHostVideo = next;
    mehfilLog("remote_host_video_change", { room_id: roomId, available: next, reason });
    callbacks.onRemoteHostVideoChange(next);
  }

  function tryFlushPendingHostVideo(reason: string) {
    if (!pendingHostVideo || !remoteVideoMount) return;
    const p = pendingHostVideo;
    pendingHostVideo = null;
    mediaLog("video_flush_pending", { reason, track_sid: p.publication.trackSid });
    mountRemoteVideo(p.track, p.publication, p.participantIdentity);
  }

  function clearVideos(containerChildrenOnly?: HTMLElement | null) {
    if (containerChildrenOnly === localVideoMount) {
      clearLocalLiveKitVideos(false);
    } else {
      [...localVideoBySid.entries()].forEach(([sid, el]) => {
        try {
          el.pause();
          el.removeAttribute("src");
          el.remove();
        } catch {
          /* ignore */
        }
        localVideoBySid.delete(sid);
      });
    }
    [...remoteVideoBySid.entries()].forEach(([sid, el]) => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.remove();
      } catch {
        /* ignore */
      }
      remoteVideoBySid.delete(sid);
    });
    clearPendingHostVideo();
    if (containerChildrenOnly && containerChildrenOnly !== localVideoMount) {
      containerChildrenOnly.replaceChildren();
    }
  }

  function stylePortraitVideo(el: HTMLVideoElement) {
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.objectFit = "cover";
    el.style.display = "block";
  }

  function mountRemoteVideo(track: RemoteTrack, publication: RemoteTrackPublication, participantIdentity: string) {
    if (!remoteHostIdNorm || normId(participantIdentity) !== remoteHostIdNorm || track.kind !== Track.Kind.Video) return;
    if (publication.source !== Track.Source.Camera) return;
    if (!isHostCameraPublication(publication)) return;
    if (!remoteVideoMount) {
      pendingHostVideo = { track, publication, participantIdentity };
      mediaLog("video_deferred_until_mount", { track_sid: publication.trackSid, identity: participantIdentity });
      return;
    }
    const sid = publication.trackSid;
    const existing = remoteVideoBySid.get(sid);
    if (existing && remoteVideoMount.contains(existing) && existing.srcObject) {
      void tryPlayRemoteVideo(existing, sid, "reuse_attachment");
      notifyRemoteHostVideo("remote_video_reuse");
      return;
    }

    remoteVideoBySid.forEach((el, oldSid) => {
      if (oldSid === sid) return;
      try {
        el.pause();
        el.remove();
      } catch {
        /* ignore */
      }
      remoteVideoBySid.delete(oldSid);
    });

    try {
      try {
        track.detach();
      } catch {
        /* ignore */
      }
      const el = track.attach() as HTMLVideoElement;
      stylePortraitVideo(el);
      el.muted = true;
      el.autoplay = true;
      el.setAttribute("autoplay", "");
      remoteVideoMount.replaceChildren(el);
      remoteVideoBySid.set(sid, el);
      const onFrames = () => {
        if (isVideoElementPlaying(el)) notifyRemoteHostVideo("remote_video_frames");
      };
      el.addEventListener("loadeddata", onFrames, { once: true });
      el.addEventListener("playing", onFrames, { once: true });
      mehfilLog("remote_video_attached", { room_id: roomId, track_sid: sid, identity: participantIdentity });
      notifyRemoteHostVideo("remote_video_attached");
      void tryPlayRemoteVideo(el, sid, "mount").then((playing) => {
        if (!playing) scheduleAttachFlush("video_play_retry");
        else notifyRemoteHostVideo("remote_video_playing");
      });
    } catch (err) {
      mediaLog("video_attach_failed", {
        track_sid: sid,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Remove LiveKit-attached local previews only — keep studio preflight `<video data-preflight>` until LK attach succeeds. */
  function clearLocalLiveKitVideos(preservePreflight = true) {
    [...localVideoBySid.entries()].forEach(([sid, el]) => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.remove();
      } catch {
        /* ignore */
      }
      localVideoBySid.delete(sid);
    });
    if (!localVideoMount) return;
    if (preservePreflight) {
      localVideoMount.querySelectorAll("video:not([data-preflight])").forEach((el) => el.remove());
    } else {
      localVideoMount.replaceChildren();
    }
  }

  function removePreflightVideos() {
    localVideoMount?.querySelectorAll("video[data-preflight]").forEach((el) => {
      try {
        (el as HTMLVideoElement).srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    });
  }

  function syncLocalPublishedVideo(reason: string): boolean {
    if (!localVideoMount || !canPublish) return false;

    let attachedSid: string | null = null;
    room.localParticipant.videoTrackPublications.forEach((pub) => {
      if (attachedSid) return;
      const vt = pub.track;
      if (!vt || pub.isMuted) return;

      const existing = localVideoBySid.get(pub.trackSid);
      if (existing && localVideoMount.contains(existing)) {
        attachedSid = pub.trackSid;
        removePreflightVideos();
        void existing.play().catch(() => {});
        return;
      }

      try {
        clearLocalLiveKitVideos(true);
        const el = vt.attach() as HTMLVideoElement;
        stylePortraitVideo(el);
        localVideoMount.appendChild(el);
        localVideoBySid.set(pub.trackSid, el);
        void el.play().catch(() => {});
        attachedSid = pub.trackSid;
        mediaLog("local_video_attached", { track_sid: pub.trackSid, reason });
      } catch (err) {
        mediaLog("local_video_attach_failed", {
          track_sid: pub.trackSid,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    if (attachedSid) {
      removePreflightVideos();
      return true;
    }
    return false;
  }

  function syncPublishedVideos(reason: string) {
    if (remoteHostIdNorm) {
      room.remoteParticipants.forEach((participant) => {
        if (normId(participant.identity) !== remoteHostIdNorm) return;
        participant.trackPublications.forEach((pub) => {
          const rp = pub as RemoteTrackPublication;
          if (rp.kind !== Track.Kind.Video || rp.source !== Track.Source.Camera) return;
          wireHostVideoPublication(rp, participant.identity);
        });
      });
    }
    syncLocalPublishedVideo(reason);
    if (import.meta.env.DEV) console.debug(`[LiveKit] syncPublishedVideos (${reason})`);
  }

  function syncLocalMicUi() {
    try {
      callbacks.onMicrophoneEnabledChanged?.(room.localParticipant.isMicrophoneEnabled);
    } catch {
      /* ignore */
    }
  }

  const audioElements: HTMLAudioElement[] = [];
  /** Dedupe attachments per publication — avoids ghost duplicate <audio> nodes. */
  const attachedByTrackSid = new Map<string, HTMLAudioElement>();
  let audioBlocked = false;

  let attachFlushScheduled = false;
  let remoteAudioPlaybackPass = 0;
  let remoteVideoPlaybackPass = 0;
  const REMOTE_PLAYBACK_MAX_PASSES = 12;

  function scheduleAttachFlush(reason: string) {
    if (attachFlushScheduled) return;
    attachFlushScheduled = true;
    requestAnimationFrame(() => {
      attachFlushScheduled = false;
      syncExistingRemoteAudio(`attach_queue_${reason}`);
      syncPublishedVideos(`attach_queue_${reason}`);
      tryFlushPendingHostVideo(`attach_queue_${reason}`);
      ensureRemoteVideoPlayback(reason);
      ensureRemoteAudioPlayback(reason);
    });
  }

  function ensureRemoteVideoPlayback(reason: string) {
    if (!remoteHostIdNorm) return;
    let attached = false;
    let playing = false;
    room.remoteParticipants.forEach((participant) => {
      if (normId(participant.identity) !== remoteHostIdNorm) return;
      participant.trackPublications.forEach((pub) => {
        const rp = pub as RemoteTrackPublication;
        if (!isHostCameraPublication(rp)) return;
        wireHostVideoPublication(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          mountRemoteVideo(rp.track as RemoteTrack, rp, participant.identity);
          attached = true;
          const el = remoteVideoBySid.get(rp.trackSid);
          if (videoPlaybackReady(el)) playing = true;
          else if (el) void tryPlayRemoteVideo(el, rp.trackSid, reason);
        }
      });
    });
    mehfilLog("remote_video_playback_check", { room_id: roomId, reason, attached, playing });
    if (attached && playing) {
      mehfilLog("remote_video_playing", { room_id: roomId, reason });
      return;
    }
    if (remoteVideoPlaybackPass < REMOTE_PLAYBACK_MAX_PASSES) {
      remoteVideoPlaybackPass += 1;
      window.setTimeout(() => ensureRemoteVideoPlayback(`${reason}_pass${remoteVideoPlaybackPass}`), 280);
    }
  }

  function ensureRemoteAudioPlayback(reason: string) {
    let attached = false;
    let playing = false;
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        const rp = pub as RemoteTrackPublication;
        if (rp.kind !== Track.Kind.Audio) return;
        ensureRemoteAudioSubscribed(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          attachRemoteAudio(rp.track as RemoteTrack, rp, participant.identity);
          attached = true;
          const el = attachedByTrackSid.get(rp.trackSid);
          if (audioPlaybackReady(el)) playing = true;
        }
      });
    });
    mehfilLog("remote_audio_attach", { room_id: roomId, reason, attached, playing });
    if (attached && playing) {
      mehfilLog("remote_audio_playing", { room_id: roomId, reason });
      return;
    }
    if (remoteAudioPlaybackPass < REMOTE_PLAYBACK_MAX_PASSES) {
      remoteAudioPlaybackPass += 1;
      window.setTimeout(() => ensureRemoteAudioPlayback(`${reason}_pass${remoteAudioPlaybackPass}`), 280);
    }
  }

  let playbackRetryTimer: ReturnType<typeof setInterval> | null = null;
  let playbackRetryTicks = 0;
  const PLAYBACK_RETRY_MAX = 52;

  function clearPlaybackRetries() {
    if (playbackRetryTimer) {
      clearInterval(playbackRetryTimer);
      playbackRetryTimer = null;
    }
    playbackRetryTicks = 0;
  }

  function schedulePlaybackRetries(reason: string) {
    clearPlaybackRetries();
    audioLog("playback_retry_start", { room_id: roomId, reason });
    playbackRetryTimer = setInterval(() => {
      playbackRetryTicks++;
      void room.startAudio().catch(() => {});
      audioElements.forEach((el) => {
        if (el.srcObject && el.paused) tryPlay(el);
      });
      const anyPaused = audioElements.some((el) => el.srcObject && el.paused);
      if (!anyPaused && audioElements.length > 0) {
        audioLog("playback_retry_done", { room_id: roomId, ticks: playbackRetryTicks });
        clearPlaybackRetries();
      } else if (playbackRetryTicks >= PLAYBACK_RETRY_MAX) {
        audioLog("playback_retry_cap", { room_id: roomId, ticks: playbackRetryTicks, elements: audioElements.length });
        clearPlaybackRetries();
      }
    }, 300);
  }

  /** Try to play an audio element; set audioBlocked flag if policy prevents it. */
  function tryPlay(el: HTMLAudioElement) {
    el.play().catch((e) => {
      audioBlocked = true;
      callbacks.onAudioBlocked?.();
      audioLog("play_blocked", { room_id: roomId });
      mediaLog("audio_play_failed", {
        room_id: roomId,
        message: e instanceof Error ? e.message : String(e),
        track_sid: el.dataset.trackSid ?? "",
      });
    });
  }

  /** Resume remote tracks after tab focus / mobile unlock (autoplay policies). */
  function resumePlaybackOnVisible() {
    if (document.visibilityState !== "visible") return;
    void room.startAudio().catch(() => {});
    audioElements.forEach((el) => {
      if (el.srcObject) tryPlay(el);
    });
    schedulePlaybackRetries("visibility_visible");
    audioLog("resume_visible", { room_id: roomId });
  }

  function resumePlaybackOnOnline() {
    void room.startAudio().catch(() => {});
    audioElements.forEach((el) => {
      if (el.srcObject) tryPlay(el);
    });
    schedulePlaybackRetries("network_online");
    audioLog("resume_online", { room_id: roomId });
  }

  /** Re-prime playback — helps listeners when publishers join slightly ahead of subscription (mobile Safari). */
  function primePlayback(reason: string) {
    void room.startAudio().catch(() => {});
    audioElements.forEach((el) => {
      if (el.srcObject) tryPlay(el);
    });
    if (import.meta.env.DEV) console.debug(`[LiveKit] primePlayback (${reason})`);
  }

  function ensureRemoteAudioSubscribed(pub: RemoteTrackPublication, participantIdentity: string) {
    if (pub.kind !== Track.Kind.Audio) return;
    try {
      if (!pub.isSubscribed) {
        pub.setSubscribed(true);
        audioLog("subscribe_requested", { room_id: roomId, track_sid: pub.trackSid, from: participantIdentity });
      }
    } catch (e) {
      audioLog("subscribe_failed", {
        room_id: roomId,
        track_sid: pub.trackSid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function ensureRemoteVideoSubscribed(pub: RemoteTrackPublication, participantIdentity: string) {
    if (pub.kind !== Track.Kind.Video || pub.source !== Track.Source.Camera) return;
    if (!remoteHostIdNorm || normId(participantIdentity) !== remoteHostIdNorm) return;
    try {
      if (!pub.isSubscribed) pub.setSubscribed(true);
    } catch (e) {
      audioLog("subscribe_failed", {
        room_id: roomId,
        track_sid: pub.trackSid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function detachSid(trackSid: string) {
    const el = attachedByTrackSid.get(trackSid);
    if (el) {
      el.pause();
      el.remove();
      attachedByTrackSid.delete(trackSid);
      const ix = audioElements.indexOf(el);
      if (ix >= 0) audioElements.splice(ix, 1);
    }
  }

  function attachRemoteAudio(track: RemoteTrack, publication: RemoteTrackPublication, participantIdentity: string) {
    const sid = publication.trackSid;
    const existing = attachedByTrackSid.get(sid);
    if (existing && document.body.contains(existing) && existing.srcObject) {
      tryPlay(existing);
      primePlayback("reuse_attachment");
      schedulePlaybackRetries("reuse_attachment");
      audioLog("track_attach_skip_dup", { room_id: roomId, track_sid: sid, from: participantIdentity });
      return;
    }

    detachSid(sid);

    void room.startAudio().catch(() => {});
    const el = track.attach() as HTMLAudioElement;
    el.volume = 1;
    try {
      el.setAttribute("playsinline", "true");
    } catch {
      /* ignore */
    }
    el.dataset.livekitRoom = roomId;
    el.dataset.trackSid = sid;
    document.body.appendChild(el);
    audioElements.push(el);
    attachedByTrackSid.set(sid, el);
    audioLog("track_attached", {
      room_id: roomId,
      track_sid: sid,
      from: participantIdentity,
      muted: publication.isMuted,
    });
    mehfilLog("remote_audio_attach", { room_id: roomId, track_sid: sid, from: participantIdentity });
    tryPlay(el);
    if (audioPlaybackReady(el)) mehfilLog("remote_audio_playing", { room_id: roomId, track_sid: sid });
    primePlayback("track_subscribed");
    schedulePlaybackRetries("track_subscribed");
  }

  /** Attach any remote audio already published (handles listener-join-after-host edge cases). */
  function syncExistingRemoteAudio(reason: string) {
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.kind !== Track.Kind.Audio) return;
        const rp = pub as RemoteTrackPublication;
        ensureRemoteAudioSubscribed(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          attachRemoteAudio(rp.track as RemoteTrack, rp, participant.identity);
        }
      });
    });
    primePlayback(reason);
    audioLog("sync_remote_audio", { room_id: roomId, reason });
  }

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      attachRemoteAudio(track, publication, participant.identity);
      scheduleAttachFlush("track_subscribed_audio");
      return;
    }
    if (track.kind === Track.Kind.Video && publication.source === Track.Source.Camera) {
      if (remoteHostIdNorm && normId(participant.identity) === remoteHostIdNorm) {
        mehfilLog("remote_video_subscribed", { room_id: roomId, track_sid: publication.trackSid, identity: participant.identity });
        wireHostVideoPublication(publication, participant.identity);
        mountRemoteVideo(track, publication, participant.identity);
        notifyRemoteHostVideo("track_subscribed_video");
        scheduleAttachFlush("track_subscribed_video");
      }
    }
  });

  room.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (publication.kind === Track.Kind.Video && remoteHostIdNorm && normId(participant.identity) === remoteHostIdNorm) {
      if (remoteVideoMount) clearVideos(remoteVideoMount);
      remoteVideoBySid.clear();
      notifyRemoteHostVideo("track_muted_video");
    }
  });

  room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (publication.kind === Track.Kind.Video && remoteHostIdNorm && normId(participant.identity) === remoteHostIdNorm) {
      notifyRemoteHostVideo("track_unmuted_video");
      scheduleAttachFlush("track_unmuted_video");
    }
  });

  room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (publication.kind === Track.Kind.Audio) {
      audioLog("remote_track_published", { room_id: roomId, track_sid: publication.trackSid, from: participant.identity });
      ensureRemoteAudioSubscribed(publication, participant.identity);
      if (publication.track && publication.isSubscribed) {
        attachRemoteAudio(publication.track as RemoteTrack, publication, participant.identity);
      } else {
        scheduleAttachFlush("track_published_audio_pending");
      }
      return;
    }
    if (publication.kind === Track.Kind.Video && publication.source === Track.Source.Camera) {
      if (remoteHostIdNorm && normId(participant.identity) === remoteHostIdNorm) {
        mehfilLog("remote_video_published", {
          room_id: roomId,
          track_sid: publication.trackSid,
          identity: participant.identity,
          subscribed: publication.isSubscribed,
        });
      }
      wireHostVideoPublication(publication, participant.identity);
      if (!publication.track || !publication.isSubscribed) {
        scheduleAttachFlush("track_published_video_pending");
      }
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
    if (publication.kind === Track.Kind.Audio) {
      detachSid(publication.trackSid);
      track.detach().forEach((node) => {
        const el = node as HTMLAudioElement;
        el.pause();
        el.remove();
      });
      audioLog("track_unsubscribed", { room_id: roomId, track_sid: publication.trackSid });
      return;
    }
    if (publication.kind === Track.Kind.Video) {
      if (pendingHostVideo?.publication.trackSid === publication.trackSid) clearPendingHostVideo();
      track.detach().forEach((node) => {
        const el = node as HTMLVideoElement;
        el.pause();
        el.remove();
      });
      remoteVideoBySid.delete(publication.trackSid);
      mediaLog("track_unsubscribed", { kind: "video", track_sid: publication.trackSid });
      notifyRemoteHostVideo("track_unsubscribed_video");
    }
  });

  room.on(RoomEvent.TrackSubscriptionFailed, (trackSid: string, participant: RemoteParticipant, reason?: unknown) => {
    const msg = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : "";
    audioLog("subscription_failed", {
      room_id: roomId,
      track_sid: trackSid,
      from: participant.identity,
      message: msg,
    });
    mediaLog("subscription_failed", { track_sid: trackSid, from: participant.identity, message: msg });
    const pub = participant.getTrackPublicationBySid(trackSid) as RemoteTrackPublication | undefined;
    if (pub?.kind === Track.Kind.Audio) {
      window.setTimeout(() => ensureRemoteAudioSubscribed(pub, participant.identity), 400);
    }
    if (pub?.kind === Track.Kind.Video) {
      window.setTimeout(() => ensureRemoteVideoSubscribed(pub, participant.identity), 400);
    }
  });

  room.on(RoomEvent.LocalTrackPublished, (publication) => {
    if (publication.kind !== Track.Kind.Audio) return;
    audioLog("local_audio_published", { room_id: roomId, track_sid: publication.trackSid });
  });

  room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
    if (publication.kind !== Track.Kind.Audio) return;
    audioLog("local_audio_unpublished", { room_id: roomId, track_sid: publication.trackSid });
  });

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    participant.trackPublications.forEach((pub) => {
      const rp = pub as RemoteTrackPublication;
      if (pub.kind === Track.Kind.Audio) {
        ensureRemoteAudioSubscribed(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          attachRemoteAudio(rp.track as RemoteTrack, rp, participant.identity);
        }
      }
      if (pub.kind === Track.Kind.Video && rp.source === Track.Source.Camera) {
        wireHostVideoPublication(rp, participant.identity);
      }
    });
    primePlayback("participant_connected");
    syncPublishedVideos("participant_connected");
    tryFlushPendingHostVideo("participant_connected");
    notifyRemoteHostVideo("participant_connected");
    callbacks.onParticipantCountChange?.(room.remoteParticipants.size + 1);
    audioLog("participant_connected", { room_id: roomId, identity: participant.identity });
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    participant.trackPublications.forEach((pub) => {
      if (pub.kind === Track.Kind.Audio) detachSid(pub.trackSid);
      if (pub.kind === Track.Kind.Video) remoteVideoBySid.delete(pub.trackSid);
    });
    callbacks.onParticipantCountChange?.(room.remoteParticipants.size + 1);
    audioLog("participant_disconnected", { room_id: roomId, identity: participant.identity });
  });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    callbacks.onConnectionStateChange?.(state);
    audioLog("conn_state", { room_id: roomId, state: String(state) });
  });

  room.on(RoomEvent.Reconnecting, () => {
    logOpsEvent("livekit_reconnecting", { room_id: roomId });
    callbacks.onReconnecting?.();
    audioLog("reconnecting", { room_id: roomId });
    mediaLog("reconnect_started", { room_id: roomId });
  });

  room.on(RoomEvent.Reconnected, () => {
    logOpsEvent("livekit_reconnected", { room_id: roomId });
    callbacks.onReconnected?.();
    mediaLog("reconnect_completed", { room_id: roomId });
    void room.startAudio().catch(() => {});
    syncExistingRemoteAudio("reconnected");
    syncPublishedVideos("reconnected");
    tryFlushPendingHostVideo("reconnected");
    audioElements.forEach((el) => {
      if (el.srcObject && el.paused) tryPlay(el);
    });
    schedulePlaybackRetries("reconnected");
  });

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    const remoteActive = speakers.find((s) => s.identity !== userId);
    callbacks.onSpeakerChange?.(remoteActive?.identity ?? null);
  });

  room.on(RoomEvent.MediaDevicesError, (e: Error) => {
    audioLog("media_devices_error", { room_id: roomId, message: e.message });
    // Device errors during camera/mic toggles are not room-level connection failures.
  });

  room.on(RoomEvent.Disconnected, () => {
    document.removeEventListener("visibilitychange", resumePlaybackOnVisible);
    window.removeEventListener("online", resumePlaybackOnOnline);
    clearPlaybackRetries();
    audioElements.forEach((el) => {
      el.pause();
      el.remove();
    });
    audioElements.length = 0;
    attachedByTrackSid.clear();
    document.querySelectorAll<HTMLAudioElement>(`audio[data-livekit-room="${roomId}"]`).forEach((el) => {
      el.pause();
      el.remove();
    });
    clearVideos();
    clearPendingHostVideo();
    wiredHostVideoPubs.clear();
    audioLog("disconnected_cleanup", { room_id: roomId });
  });

  try {
    mehfilLog("room_connect_start", { room_id: roomId, identity: userId, can_publish: canPublish });
    await connectRoomWithTimeout(room, liveKitUrl, token, roomId);
    console.log(`[LiveKit] connected to room ${roomId} as ${userId}`);
    logOpsEvent("livekit_connected", { room_id: roomId, can_publish: canPublish });
    audioLog("connected", { room_id: roomId, can_publish: canPublish, identity: userId });
    callbacks.onConnectionStateChange?.(room.state);
    if (import.meta.env.DEV && remoteHostIdNorm) {
      const ids = [...room.remoteParticipants.values()].map((p) => normId(p.identity));
      console.debug("[LiveKit:dev] remote identities", { expect_host: remoteHostIdNorm, remote_participants: ids });
    }

    await room.startAudio().catch(() => {});
    syncExistingRemoteAudio("connect_immediate");
    if (remoteHostIdNorm) {
      room.remoteParticipants.forEach((participant) => {
        if (normId(participant.identity) !== remoteHostIdNorm) return;
        participant.trackPublications.forEach((pub) => {
          if (pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera) {
            wireHostVideoPublication(pub as RemoteTrackPublication, participant.identity);
          }
        });
      });
    }

    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.TrackMuted, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.TrackUnmuted, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, (pub) => {
      if (pub.kind !== Track.Kind.Video) return;
      mediaLog("local_track_published", { kind: "video", track_sid: pub.trackSid });
      syncPublishedVideos("local_video_pub");
    });
    syncLocalMicUi();

    const POST_CONNECT_RESYNC_MS = [0, 120, 400, 900, 2000];
    for (const ms of POST_CONNECT_RESYNC_MS) {
      window.setTimeout(() => {
        scheduleAttachFlush(`post_connect_${ms}ms`);
        notifyRemoteHostVideo(`post_connect_${ms}ms`);
      }, ms);
    }
    schedulePlaybackRetries("post_connect");

    document.addEventListener("visibilitychange", resumePlaybackOnVisible);
    window.addEventListener("online", resumePlaybackOnOnline);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LiveKit] connect error", err);
    mehfilLog("connect_room_error", { room_id: roomId, message, livekit_url: liveKitUrl.slice(0, 48) });
    logOpsEvent("livekit_connect_failed", {
      room_id: roomId,
      message,
    });
    callbacks.onError?.(err instanceof Error ? err : new Error(message));
    callbacks.onConnectionStateChange?.(ConnectionState.Disconnected);
    return null;
  }

  if (canPublish) {
    try {
      if (hasPreflight && preflightTracks) {
        const pub = await publishPreflightTracks(room, preflightTracks, publishCamera, roomId);
        publishedPreflightAudio = pub.localAudio;
        publishedPreflightVideo = pub.localVideo;
        syncLocalMicUi();
        scheduleAttachFlush("preflight_initial_publish");
        const micLive = await ensureHostMicPublished(room, preflightTracks, roomId);
        if (!micLive) {
          mehfilLog("preflight_audio_fallback_enable", { room_id: roomId });
        }
        if (publishCamera && !publishedPreflightVideo && preflightTracks.videoTrack?.readyState === "live") {
          mehfilLog("preflight_video_fallback_enable", { room_id: roomId });
          await room.localParticipant.setCameraEnabled(true);
          scheduleAttachFlush("preflight_camera_fallback");
        }
        syncLocalMicUi();
      } else {
        const micLive = await ensureHostMicPublished(room, null, roomId);
        if (!micLive) {
          audioLog("mic_enable_error", { room_id: roomId, message: "mic_not_published_after_enable" });
        }
        syncLocalMicUi();
      }
    } catch (err) {
      console.warn("[LiveKit] Could not publish mic", err);
      audioLog("mic_enable_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  } else {
    syncExistingRemoteAudio("listener_post_publish");
    scheduleAttachFlush("listener_post_publish");
  }

  if (publishCamera && canPublish && !hasPreflight) {
    try {
      await room.localParticipant.setCameraEnabled(true);
      mehfilLog("camera_publish_ok", { room_id: roomId, phase: "initial_enable" });
      scheduleAttachFlush("camera_boot");
    } catch (err) {
      console.warn("[LiveKit] Could not enable camera", err);
      mehfilLog("camera_publish_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const controller: LiveKitRoom = {
    room,

    disconnect() {
      document.removeEventListener("visibilitychange", resumePlaybackOnVisible);
      window.removeEventListener("online", resumePlaybackOnOnline);
      clearPlaybackRetries();
      audioElements.forEach((el) => {
        el.pause();
        el.remove();
      });
      audioElements.length = 0;
      attachedByTrackSid.clear();
      document.querySelectorAll<HTMLAudioElement>(`audio[data-livekit-room="${roomId}"]`).forEach((el) => {
        el.pause();
        el.remove();
      });
      clearVideos();
      clearPendingHostVideo();
      wiredHostVideoPubs.clear();
      room.disconnect();
    },

    async setMicEnabled(enabled: boolean) {
      try {
        if (publishedPreflightAudio) {
          if (enabled) await publishedPreflightAudio.unmute();
          else await publishedPreflightAudio.mute();
        } else {
          await room.localParticipant.setMicrophoneEnabled(enabled);
        }
        audioLog("set_mic", { room_id: roomId, enabled });
        syncLocalMicUi();
      } catch (err) {
        console.warn("[LiveKit] setMicEnabled error", err);
        audioLog("set_mic_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
      }
    },

    getParticipantCount() {
      return room.remoteParticipants.size + 1;
    },

    enableAudio() {
      audioBlocked = false;
      void room.startAudio().catch(() => {});
      audioElements.forEach((el) => {
        if (el.srcObject && el.paused) tryPlay(el);
      });
      remoteVideoBySid.forEach((el, sid) => {
        void tryPlayRemoteVideo(el, sid, "user_enable_audio");
      });
      scheduleAttachFlush("user_enable_audio");
      schedulePlaybackRetries("user_enable_audio");
      audioLog("enable_audio_gesture", { room_id: roomId });
    },

    isAudioBlocked() {
      return audioBlocked;
    },

    primeRemotePlayback(reason: string) {
      void room.startAudio().catch(() => {});
      remoteAudioPlaybackPass = 0;
      remoteVideoPlaybackPass = 0;
      scheduleAttachFlush(reason);
      audioElements.forEach((el) => {
        if (el.srcObject && el.paused) tryPlay(el);
      });
      remoteVideoBySid.forEach((el, sid) => {
        void tryPlayRemoteVideo(el, sid, reason);
      });
      schedulePlaybackRetries(reason);
    },

    ensureRemotePlayback(reason: string) {
      remoteAudioPlaybackPass = 0;
      remoteVideoPlaybackPass = 0;
      scheduleAttachFlush(reason);
      remoteVideoBySid.forEach((el, sid) => {
        void tryPlayRemoteVideo(el, sid, reason);
      });
    },

    async verifyHostTracksPublished(needCamera: boolean) {
      return verifyHostPublish(room, {
        needCamera,
        roomId,
        republishPreflight: hasPreflight ? republishPreflight : undefined,
      });
    },

    bindVideoElements(opts: Partial<{ local: HTMLElement | null; remote: HTMLElement | null }>) {
      if (opts.local != null) localVideoMount = opts.local;
      if (opts.remote != null) remoteVideoMount = opts.remote;
      mediaLog("bind_video_elements", {
        has_local: opts.local != null,
        has_remote: opts.remote != null,
      });
      tryFlushPendingHostVideo("bind_video_elements");
      scheduleAttachFlush("bind_video_elements");
    },

    async setCameraEnabled(enabled: boolean) {
      try {
        if (publishedPreflightVideo) {
          if (enabled) {
            if (countPublishedTracks(room, Track.Kind.Video) === 0 && preflightTracks?.videoTrack?.readyState === "live") {
              const pub = await room.localParticipant.publishTrack(preflightTracks.videoTrack, {
                source: Track.Source.Camera,
              });
              publishedPreflightVideo = pub.track as LocalVideoTrack;
            } else {
              await publishedPreflightVideo.unmute();
            }
          } else {
            await publishedPreflightVideo.mute();
            try {
              await room.localParticipant.unpublishTrack(publishedPreflightVideo, false);
            } catch {
              /* ignore — may already be unpublished */
            }
          }
        } else {
          await room.localParticipant.setCameraEnabled(enabled);
        }
        if (!enabled) {
          clearVideos(localVideoMount);
        } else {
          syncLocalPublishedVideo("camera_toggle");
          scheduleAttachFlush("camera_toggle");
        }
        notifyRemoteHostVideo("camera_toggle");
      } catch (err) {
        console.warn("[LiveKit] setCameraEnabled error", err);
        audioLog("media_devices_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
      }
    },

    isRemoteHostVideoAvailable,
  };

  return controller;
}

/** Returns true if LiveKit is configured in this environment */
export const isLiveKitConfigured = () => getLiveKitConfigError() === null;
