/**
 * LiveKit audio utilities for Mehfil live rooms.
 *
 * Required env var:
 *   VITE_LIVEKIT_URL — wss://your-project.livekit.cloud (or self-hosted)
 *
 * Token generation is handled by the Supabase edge function at
 * /functions/v1/livekit-token (see supabase/functions/livekit-token/index.ts).
 */

import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  RoomOptions,
} from "livekit-client";
import { supabase } from "./supabase";

export interface LiveKitRoom {
  room: Room;
  disconnect: () => void;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  getParticipantCount: () => number;
}

export interface LiveKitCallbacks {
  onParticipantCountChange?: (count: number) => void;
  onSpeakerChange?: (participantIdentity: string | null) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (err: Error) => void;
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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
): Promise<LiveKitRoom | null> {
  if (!LIVEKIT_URL) {
    console.warn("[LiveKit] VITE_LIVEKIT_URL not set — audio disabled. Set it to enable live audio.");
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

  const opts: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  const room = new Room(opts);

  // Track remote audio elements so we can clean them up
  const audioElements: HTMLAudioElement[] = [];

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, _participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach() as HTMLAudioElement;
      el.volume = 1;
      document.body.appendChild(el);
      audioElements.push(el);
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    track.detach();
  });

  room.on(RoomEvent.ParticipantConnected, () => {
    callbacks.onParticipantCountChange?.(room.remoteParticipants.size + 1);
  });

  room.on(RoomEvent.ParticipantDisconnected, () => {
    callbacks.onParticipantCountChange?.(room.remoteParticipants.size + 1);
  });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    callbacks.onConnectionStateChange?.(state);
  });

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    const remoteActive = speakers.find((s) => s.identity !== userId);
    callbacks.onSpeakerChange?.(remoteActive?.identity ?? null);
  });

  room.on(RoomEvent.Disconnected, () => {
    audioElements.forEach((el) => { el.pause(); el.remove(); });
    audioElements.length = 0;
  });

  try {
    await room.connect(LIVEKIT_URL, token);
    console.log(`[LiveKit] connected to room ${roomId} as ${userId}`);
  } catch (err) {
    console.error("[LiveKit] connect error", err);
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }

  // Host/speaker: enable mic on connect
  if (canPublish) {
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.warn("[LiveKit] Could not enable mic", err);
    }
  }

  const controller: LiveKitRoom = {
    room,

    disconnect() {
      audioElements.forEach((el) => { el.pause(); el.remove(); });
      audioElements.length = 0;
      room.disconnect();
    },

    async setMicEnabled(enabled: boolean) {
      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
      } catch (err) {
        console.warn("[LiveKit] setMicEnabled error", err);
      }
    },

    getParticipantCount() {
      return room.remoteParticipants.size + 1;
    },
  };

  return controller;
}

/** Returns true if LiveKit is configured in this environment */
export const isLiveKitConfigured = () => Boolean(LIVEKIT_URL);
