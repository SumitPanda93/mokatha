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
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const AUDIO_LOG_PREFIX = "[LiveKit:audio]";
const MEHFIL_LOG_PREFIX = "[Mehfil]";

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
    let micOk = countActivePublications(room, Track.Kind.Audio) > 0;
    let camOk = !needCamera || countActivePublications(room, Track.Kind.Video) > 0;
    if (!micOk || (needCamera && !camOk)) {
      mehfilLog("host_publish_retry", { room_id: roomId, phase: label, preflight: usePreflight });
      try {
        if (usePreflight && opts.republishPreflight) {
          await opts.republishPreflight();
        } else {
          if (!micOk) await room.localParticipant.setMicrophoneEnabled(true);
          if (needCamera && !camOk) await room.localParticipant.setCameraEnabled(true);
        }
      } catch (e) {
        mehfilLog("host_publish_error", { room_id: roomId, message: e instanceof Error ? e.message : String(e) });
      }
      micOk = countActivePublications(room, Track.Kind.Audio) > 0;
      camOk = !needCamera || countActivePublications(room, Track.Kind.Video) > 0;
    }
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

function videoPlaybackReady(el: HTMLVideoElement | undefined): boolean {
  if (!el || !document.body.contains(el)) return false;
  if (!el.srcObject) return false;
  if (el.readyState < 2) return false;
  return !el.paused || el.readyState >= 2;
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
    countActivePublications(room, Track.Kind.Audio) === 0
  ) {
    try {
      const pub = await lp.publishTrack(preflight.audioTrack, { source: Track.Source.Microphone });
      localAudio = pub.track as LocalAudioTrack;
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
    countActivePublications(room, Track.Kind.Video) === 0
  ) {
    try {
      const pub = await lp.publishTrack(preflight.videoTrack, { source: Track.Source.Camera });
      localVideo = pub.track as LocalVideoTrack;
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

/** Fetch a LiveKit token from the Supabase edge function */
async function fetchToken(roomId: string, identity: string, canPublish: boolean): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/livekit-token?room=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(identity)}&canPublish=${canPublish}`,
    {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token fetch failed: ${res.status} ${body}`);
  }
  const { token, error } = await res.json();
  if (error) throw new Error(error);
  return token as string;
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
  if (!LIVEKIT_URL) {
    const err = new Error("VITE_LIVEKIT_URL is not set — Mehfil studio cannot connect.");
    console.warn("[LiveKit]", err.message);
    callbacks.onError?.(err);
    return null;
  }

  let token: string;
  try {
    token = await fetchToken(roomId, userId, canPublish);
  } catch (err) {
    console.error("[LiveKit] Token fetch error", err);
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
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
    adaptiveStream: true,
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
    const micMissing = countActivePublications(room, Track.Kind.Audio) === 0;
    const camMissing = publishCamera && countActivePublications(room, Track.Kind.Video) === 0;
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

  function clearPendingHostVideo() {
    pendingHostVideo = null;
  }

  function tryFlushPendingHostVideo(reason: string) {
    if (!pendingHostVideo || !remoteVideoMount) return;
    const p = pendingHostVideo;
    pendingHostVideo = null;
    mediaLog("video_flush_pending", { reason, track_sid: p.publication.trackSid });
    mountRemoteVideo(p.track, p.publication, p.participantIdentity);
  }

  function clearVideos(containerChildrenOnly?: HTMLElement | null) {
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
    if (containerChildrenOnly) {
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
    if (!remoteVideoMount) {
      pendingHostVideo = { track, publication, participantIdentity };
      mediaLog("video_deferred_until_mount", { track_sid: publication.trackSid, identity: participantIdentity });
      return;
    }
    const sid = publication.trackSid;
    try {
      remoteVideoBySid.forEach((el) => {
        try {
          el.pause();
          el.remove();
        } catch {
          /* ignore */
        }
      });
      remoteVideoBySid.clear();
      const el = track.attach() as HTMLVideoElement;
      stylePortraitVideo(el);
      el.muted = true;
      remoteVideoMount.replaceChildren(el);
      remoteVideoBySid.set(sid, el);
      mehfilLog("remote_video_attached", { room_id: roomId, track_sid: sid, identity: participantIdentity });
      void el.play().then(() => {
        mehfilLog("remote_video_playing", { room_id: roomId, track_sid: sid });
      }).catch((e) => {
        mehfilLog("remote_video_play_failed", { track_sid: sid, message: e instanceof Error ? e.message : String(e) });
        scheduleAttachFlush("video_play_retry");
      });
    } catch (err) {
      mediaLog("video_attach_failed", {
        track_sid: sid,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function syncPublishedVideos(reason: string) {
    if (remoteHostIdNorm && remoteVideoMount) {
      room.remoteParticipants.forEach((participant) => {
        if (normId(participant.identity) !== remoteHostIdNorm) return;
        participant.trackPublications.forEach((pub) => {
          const rp = pub as RemoteTrackPublication;
          if (rp.kind !== Track.Kind.Video) return;
          ensureRemoteVideoSubscribed(rp, participant.identity);
          if (rp.track && rp.isSubscribed) {
            mountRemoteVideo(rp.track as RemoteTrack, rp, participant.identity);
          }
        });
      });
    }
    if (localVideoMount && canPublish) {
      localVideoMount.replaceChildren();
      localVideoBySid.clear();
      let attachedAny = false;
      room.localParticipant.videoTrackPublications.forEach((pub) => {
        const vt = pub.track;
        if (!vt || pub.isMuted || attachedAny) return;
        try {
          const el = vt.attach() as HTMLVideoElement;
          stylePortraitVideo(el);
          localVideoMount.appendChild(el);
          localVideoBySid.set(pub.trackSid, el);
          void el.play().catch(() => {});
          attachedAny = true;
        } catch {
          /* ignore */
        }
      });
      if (!attachedAny) {
        localVideoMount.replaceChildren();
        localVideoBySid.clear();
      }
    }
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
  let remotePlaybackPass = 0;
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
        if (rp.kind !== Track.Kind.Video) return;
        ensureRemoteVideoSubscribed(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          mountRemoteVideo(rp.track as RemoteTrack, rp, participant.identity);
          attached = true;
          const el = remoteVideoBySid.get(rp.trackSid);
          if (videoPlaybackReady(el)) playing = true;
        }
      });
    });
    mehfilLog("remote_video_attached", { room_id: roomId, reason, attached, playing });
    if (attached && playing) {
      mehfilLog("remote_video_playing", { room_id: roomId, reason });
      return;
    }
    if (remotePlaybackPass < REMOTE_PLAYBACK_MAX_PASSES) {
      remotePlaybackPass += 1;
      window.setTimeout(() => ensureRemoteVideoPlayback(`${reason}_pass${remotePlaybackPass}`), 280);
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
    if (remotePlaybackPass < REMOTE_PLAYBACK_MAX_PASSES) {
      remotePlaybackPass += 1;
      window.setTimeout(() => ensureRemoteAudioPlayback(`${reason}_pass${remotePlaybackPass}`), 280);
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
    if (pub.kind !== Track.Kind.Video) return;
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
    if (track.kind === Track.Kind.Video) {
      if (remoteHostIdNorm && normId(participant.identity) === remoteHostIdNorm) {
        mehfilLog("remote_video_subscribed", { room_id: roomId, track_sid: publication.trackSid, identity: participant.identity });
      }
      mountRemoteVideo(track, publication, participant.identity);
      scheduleAttachFlush("track_subscribed_video");
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
    if (publication.kind === Track.Kind.Video) {
      ensureRemoteVideoSubscribed(publication, participant.identity);
      if (publication.track && publication.isSubscribed) {
        mountRemoteVideo(publication.track as RemoteTrack, publication, participant.identity);
      } else {
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
      if (pub.kind === Track.Kind.Video) {
        ensureRemoteVideoSubscribed(rp, participant.identity);
        if (rp.track && rp.isSubscribed) {
          mountRemoteVideo(rp.track as RemoteTrack, rp, participant.identity);
        }
      }
    });
    primePlayback("participant_connected");
    syncPublishedVideos("participant_connected");
    tryFlushPendingHostVideo("participant_connected");
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
    callbacks.onError?.(e);
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
    audioLog("disconnected_cleanup", { room_id: roomId });
  });

  try {
    mehfilLog("room_connect_start", { room_id: roomId, identity: userId, can_publish: canPublish });
    await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
    mehfilLog("room_connected", { room_id: roomId, identity: userId, can_publish: canPublish });
    console.log(`[LiveKit] connected to room ${roomId} as ${userId}`);
    logOpsEvent("livekit_connected", { room_id: roomId, can_publish: canPublish });
    audioLog("connected", { room_id: roomId, can_publish: canPublish, identity: userId });
    if (import.meta.env.DEV && remoteHostIdNorm) {
      const ids = [...room.remoteParticipants.values()].map((p) => normId(p.identity));
      console.debug("[LiveKit:dev] remote identities", { expect_host: remoteHostIdNorm, remote_participants: ids });
    }

    await room.startAudio().catch(() => {});

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
      window.setTimeout(() => scheduleAttachFlush(`post_connect_${ms}ms`), ms);
    }
    schedulePlaybackRetries("post_connect");

    document.addEventListener("visibilitychange", resumePlaybackOnVisible);
    window.addEventListener("online", resumePlaybackOnOnline);
  } catch (err) {
    console.error("[LiveKit] connect error", err);
    logOpsEvent("livekit_connect_failed", {
      room_id: roomId,
      message: err instanceof Error ? err.message : String(err),
    });
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
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
        if (!publishedPreflightAudio && preflightTracks.audioTrack?.readyState === "live") {
          mehfilLog("preflight_audio_fallback_enable", { room_id: roomId });
          await room.localParticipant.setMicrophoneEnabled(true);
          syncLocalMicUi();
        }
        if (publishCamera && !publishedPreflightVideo && preflightTracks.videoTrack?.readyState === "live") {
          mehfilLog("preflight_video_fallback_enable", { room_id: roomId });
          await room.localParticipant.setCameraEnabled(true);
          scheduleAttachFlush("preflight_camera_fallback");
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
        syncLocalMicUi();
      }
    } catch (err) {
      console.warn("[LiveKit] Could not publish mic", err);
      audioLog("mic_enable_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
    }
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
      schedulePlaybackRetries("user_enable_audio");
      audioLog("enable_audio_gesture", { room_id: roomId });
    },

    isAudioBlocked() {
      return audioBlocked;
    },

    primeRemotePlayback(reason: string) {
      void room.startAudio().catch(() => {});
      remotePlaybackPass = 0;
      scheduleAttachFlush(reason);
      audioElements.forEach((el) => {
        if (el.srcObject && el.paused) tryPlay(el);
      });
      schedulePlaybackRetries(reason);
    },

    ensureRemotePlayback(reason: string) {
      remotePlaybackPass = 0;
      scheduleAttachFlush(reason);
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
          if (enabled) await publishedPreflightVideo.unmute();
          else await publishedPreflightVideo.mute();
        } else {
          await room.localParticipant.setCameraEnabled(enabled);
        }
        syncPublishedVideos("camera_toggle");
      } catch (err) {
        console.warn("[LiveKit] setCameraEnabled error", err);
        audioLog("media_devices_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
      }
    },
  };

  return controller;
}

/** Returns true if LiveKit is configured in this environment */
export const isLiveKitConfigured = () => Boolean(LIVEKIT_URL);
