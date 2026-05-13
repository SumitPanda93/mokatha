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
  /** Attach studio layouts — safe to call after mount; re-run when refs settle (mobile). */
  bindVideoElements(opts: { local?: HTMLElement | null; remote?: HTMLElement | null }): void;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
}

export type MehfilLiveKitOpts = {
  /** Host publishes camera (studio Mehfil). */
  publishCamera?: boolean;
  /** Listener attaches remote camera from this identity (= Mehfil host user id). */
  remoteHostIdentity?: string | null;
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
    console.warn("[LiveKit] VITE_LIVEKIT_URL not set — audio disabled.");
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
  const remoteHostId = opts.remoteHostIdentity ?? null;

  const roomOpts: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    videoCaptureDefaults: publishCamera ? { resolution: VideoPresets.h720.resolution } : undefined,
  };

  const room = new Room(roomOpts);

  /** Portrait-forward mounted previews — avoids churn during reconnects */
  let localVideoMount: HTMLElement | null = null;
  let remoteVideoMount: HTMLElement | null = null;
  const localVideoBySid = new Map<string, HTMLVideoElement>();
  const remoteVideoBySid = new Map<string, HTMLVideoElement>();

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
    if (containerChildrenOnly) {
      containerChildrenOnly.replaceChildren();
    }
  }

  function mountRemoteVideo(track: RemoteTrack, publication: RemoteTrackPublication, participantIdentity: string) {
    if (!remoteHostId || participantIdentity !== remoteHostId || track.kind !== Track.Kind.Video) return;
    if (!remoteVideoMount) return;
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
      el.playsInline = true;
      el.setAttribute("playsinline", "true");
      el.muted = true;
      remoteVideoMount.replaceChildren(el);
      remoteVideoBySid.set(sid, el);
      void el.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function syncPublishedVideos(reason: string) {
    if (remoteHostId && remoteVideoMount) {
      room.remoteParticipants.forEach((participant) => {
        if (participant.identity !== remoteHostId) return;
        participant.trackPublications.forEach((pub) => {
          const rp = pub as RemoteTrackPublication;
          if (rp.kind !== Track.Kind.Video || !rp.track || !rp.isSubscribed) return;
          mountRemoteVideo(rp.track as RemoteTrack, rp, participant.identity);
        });
      });
    }
    if (localVideoMount && canPublish) {
      let attachedAny = false;
      room.localParticipant.videoTrackPublications.forEach((pub) => {
        const vt = pub.track;
        if (!vt || pub.isMuted) return;
        attachedAny = true;
        try {
          localVideoMount.replaceChildren();
          const el = vt.attach() as HTMLVideoElement;
          el.playsInline = true;
          localVideoMount.appendChild(el);
          localVideoBySid.set(pub.trackSid, el);
          void el.play().catch(() => {});
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
    el.play().catch(() => {
      audioBlocked = true;
      callbacks.onAudioBlocked?.();
      audioLog("play_blocked", { room_id: roomId });
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
    if (!remoteHostId || participantIdentity !== remoteHostId) return;
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
    tryPlay(el);
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
      return;
    }
    if (track.kind === Track.Kind.Video) {
      mountRemoteVideo(track, publication, participant.identity);
    }
  });

  room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (publication.kind === Track.Kind.Audio) {
      audioLog("remote_track_published", { room_id: roomId, track_sid: publication.trackSid, from: participant.identity });
      ensureRemoteAudioSubscribed(publication, participant.identity);
      return;
    }
    if (publication.kind === Track.Kind.Video) {
      ensureRemoteVideoSubscribed(publication, participant.identity);
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
      track.detach().forEach((node) => {
        const el = node as HTMLVideoElement;
        el.pause();
        el.remove();
      });
      remoteVideoBySid.delete(publication.trackSid);
    }
  });

  room.on(RoomEvent.TrackSubscriptionFailed, (trackSid: string, participant: RemoteParticipant, reason?: unknown) => {
    audioLog("subscription_failed", {
      room_id: roomId,
      track_sid: trackSid,
      from: participant.identity,
      message: typeof reason === "string" ? reason : reason instanceof Error ? reason.message : "",
    });
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
      if (pub.kind === Track.Kind.Audio) {
        ensureRemoteAudioSubscribed(pub as RemoteTrackPublication, participant.identity);
      }
      if (pub.kind === Track.Kind.Video) {
        ensureRemoteVideoSubscribed(pub as RemoteTrackPublication, participant.identity);
      }
    });
    primePlayback("participant_connected");
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
  });

  room.on(RoomEvent.Reconnected, () => {
    logOpsEvent("livekit_reconnected", { room_id: roomId });
    callbacks.onReconnected?.();
    void room.startAudio().catch(() => {});
    syncExistingRemoteAudio("reconnected");
    syncPublishedVideos("reconnected");
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
    audioLog("disconnected_cleanup", { room_id: roomId });
  });

  try {
    await room.connect(LIVEKIT_URL, token);
    console.log(`[LiveKit] connected to room ${roomId} as ${userId}`);
    logOpsEvent("livekit_connected", { room_id: roomId, can_publish: canPublish });
    audioLog("connected", { room_id: roomId, can_publish: canPublish, identity: userId });

    await room.startAudio().catch(() => {});

    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.TrackMuted, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.TrackUnmuted, syncLocalMicUi);
    room.localParticipant.on(ParticipantEvent.LocalTrackPublished, (pub) => {
      if (pub.kind !== Track.Kind.Video) return;
      syncPublishedVideos("local_video_pub");
    });
    syncLocalMicUi();

    window.setTimeout(() => {
      syncExistingRemoteAudio("post_connect_tick");
      syncPublishedVideos("post_connect_tick");
      schedulePlaybackRetries("post_connect");
    }, 90);
    window.setTimeout(() => {
      syncExistingRemoteAudio("post_connect_400ms");
      syncPublishedVideos("post_connect_400ms");
    }, 400);
    window.setTimeout(() => {
      syncExistingRemoteAudio("post_connect_900ms");
      syncPublishedVideos("post_connect_900ms");
    }, 900);
    window.setTimeout(() => {
      syncExistingRemoteAudio("post_connect_2000ms");
      syncPublishedVideos("post_connect_2000ms");
    }, 2000);

    window.setTimeout(() => primePlayback("post_connect_150ms"), 150);
    window.setTimeout(() => primePlayback("post_connect_650ms"), 650);

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

  // Host/speaker: enable mic immediately + verify publish (permission delays on mobile).
  if (canPublish) {
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      syncLocalMicUi();
      const verifyMic = (phase: string) => {
        try {
          let publishing = false;
          room.localParticipant.audioTrackPublications.forEach((pub) => {
            if (pub.track && !pub.isMuted) publishing = true;
          });
          audioLog("host_mic_verify", { room_id: roomId, phase, publishing });
          if (!publishing) {
            void room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
          }
        } catch {
          /* ignore */
        }
      };
      window.setTimeout(() => verifyMic("t200"), 200);
      window.setTimeout(() => verifyMic("t1400"), 1400);
    } catch (err) {
      console.warn("[LiveKit] Could not enable mic", err);
      audioLog("mic_enable_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (publishCamera && canPublish) {
    try {
      await room.localParticipant.setCameraEnabled(true);
      window.setTimeout(() => syncPublishedVideos("camera_boot"), 220);
      window.setTimeout(() => syncPublishedVideos("camera_boot_late"), 1100);
    } catch (err) {
      console.warn("[LiveKit] Could not enable camera", err);
      audioLog("media_devices_error", { room_id: roomId, message: err instanceof Error ? err.message : String(err) });
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
      room.disconnect();
    },

    async setMicEnabled(enabled: boolean) {
      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
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
      syncExistingRemoteAudio(reason);
      syncPublishedVideos(`${reason}_video`);
      audioElements.forEach((el) => {
        if (el.srcObject && el.paused) tryPlay(el);
      });
      schedulePlaybackRetries(reason);
    },

    bindVideoElements(opts: { local?: HTMLElement | null; remote?: HTMLElement | null }) {
      if ("local" in opts) localVideoMount = opts.local ?? null;
      if ("remote" in opts) remoteVideoMount = opts.remote ?? null;
      syncPublishedVideos("bind_video_elements");
    },

    async setCameraEnabled(enabled: boolean) {
      try {
        await room.localParticipant.setCameraEnabled(enabled);
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
