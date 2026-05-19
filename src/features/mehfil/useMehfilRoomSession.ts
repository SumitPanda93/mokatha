/**
 * Mehfil room session — audio-first state machine (LiveKit + Supabase Presence + broadcast chat).
 * Keeps listener/speaker presence roles aligned with the speaker queue.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectionState } from "livekit-client";
import { toast } from "sonner";
import {
  supabase,
  earnInkPoints,
  sendSupportAction,
  invalidateWallet,
  getCurrentUserId,
  useUser,
  type QueueEntry,
  type Mehfil,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { logOpsEvent } from "@/lib/observability";
import {
  connectToMehfil,
  isLiveKitConfigured,
  type LiveKitRoom as LKRoom,
  type MehfilLiveKitOpts,
} from "@/lib/livekit";
import { useMehfilMediaState } from "@/features/mehfil/useMehfilMediaState";
import { useMehfilMediaContext } from "@/features/mehfil/MehfilMediaContext";

export type PresenceRole = "host" | "speaker" | "listener";

export type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  role: PresenceRole;
};

export type ChatMsg = { id: string; userId: string; name: string; text: string };

export type MehfilSupportBroadcast = {
  kind: string;
  amount: number;
  from_user_id: string;
  from_display_name: string;
};

export function presenceRoleFor(meHost: boolean, queueSpeaking: boolean): PresenceRole {
  if (meHost) return "host";
  if (queueSpeaking) return "speaker";
  return "listener";
}

export function useMehfilRoomSession(
  mehfilId: string,
  mehfil: Mehfil | undefined,
  queue: QueueEntry[],
  navigateToMehfilList: () => void,
) {
  const me = getCurrentUserId();
  const qc = useQueryClient();
  const { data: myUser } = useUser(me ?? "");

  const [joined, setJoined] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [replaySheetOpen, setReplaySheetOpen] = useState(false);
  const [presence, setPresence] = useState<PresencePayload[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);
  const [payingTicket, setPayingTicket] = useState(false);
  const [hasTicket, setHasTicket] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lkConnState, setLkConnState] = useState<ConnectionState | null>(null);
  const lkConnected = lkConnState === ConnectionState.Connected;
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [supportMoment, setSupportMoment] = useState<MehfilSupportBroadcast | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const livekitRef = useRef<LKRoom | null>(null);
  const lkPublishModeRef = useRef<boolean | null>(null);
  const lkReconnectScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const mutedRef = useRef(false);
  /** Prevents duplicate Supabase channels / LiveKit connects when joinRoom races or effects re-fire. */
  const joinCycleStartedRef = useRef(false);
  const prevQueueStatusRef = useRef<string | undefined>(undefined);
  const prevLkConnRef = useRef<ConnectionState | null>(null);
  const supportDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishGateRef = useRef(false);
  const lkReadyWaitersRef = useRef<Array<(room: LKRoom | null) => void>>([]);
  const media = useMehfilMediaState();
  const mehfilMedia = useMehfilMediaContext();
  const [localVideoPlaying, setLocalVideoPlaying] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  /** Listener: host has an active camera track (not audio-only / camera-off). */
  const [remoteHostVideoAvailable, setRemoteHostVideoAvailable] = useState(false);

  const lkCbRef = useRef({
    setLkConnState: (_s: ConnectionState) => {},
    setAudioBlocked: (_v: boolean) => {},
  });
  lkCbRef.current.setLkConnState = setLkConnState;
  lkCbRef.current.setAudioBlocked = setAudioBlocked;

  const onMicrophoneEnabledChanged = useCallback((enabled: boolean) => {
    if (!publishGateRef.current) return;
    setMuted(!enabled);
  }, []);

  const sawLiveRef = useRef(false);

  const isHost = !!me && !!mehfil && me === mehfil.hostId;
  const studio = mehfil?.sessionMode === "studio";

  const preflightForLiveKit = useCallback(() => {
    const p = mehfilMedia.getPreflightMedia();
    if (!p) return null;
    return { videoTrack: p.videoTrack, audioTrack: p.audioTrack };
  }, [mehfilMedia]);

  const [hostCameraOn, setHostCameraOn] = useState(() => Boolean(studio && isHost));

  const liveKitOptsFor = useCallback(
    (wantPublish: boolean): MehfilLiveKitOpts => {
      const preflight =
        studio && wantPublish && isHost ? preflightForLiveKit() : null;
      return {
        publishCamera: Boolean(studio && wantPublish && isHost && hostCameraOn),
        remoteHostIdentity:
          studio && me && mehfil?.hostId && me !== mehfil.hostId ? mehfil.hostId : null,
        preflightTracks: preflight,
      };
    },
    [studio, isHost, me, mehfil?.hostId, preflightForLiveKit, hostCameraOn],
  );

  /** Bumped when LiveKit controller is attached — lets UI re-bind mounts after lkConnected races ahead of livekitRef. */
  const [lkRoomReady, setLkRoomReady] = useState(0);
  const videoMountsRef = useRef<{ local: HTMLElement | null; remote: HTMLElement | null }>({
    local: null,
    remote: null,
  });

  useEffect(() => {
    if (studio && isHost) setHostCameraOn(true);
  }, [studio, isHost]);

  const bindVideoMountsToLiveKit = useCallback(() => {
    const lk = livekitRef.current;
    if (!lk) return;
    const { local, remote } = videoMountsRef.current;
    const patch: Partial<{ local: HTMLElement | null; remote: HTMLElement | null }> = {};
    if (local) patch.local = local;
    if (remote) patch.remote = remote;
    if (Object.keys(patch).length === 0) return;
    if (import.meta.env.DEV) {
      console.info("[mehfil:session] bind_video_mounts", {
        has_local: Boolean(local),
        has_remote: Boolean(remote),
      });
    }
    lk.bindVideoElements(patch);
    lk.primeRemotePlayback("video_mount_bind");
  }, []);

  const bindLiveKitVideo = useCallback((local: HTMLElement | null, remote: HTMLElement | null) => {
    if (local) videoMountsRef.current.local = local;
    if (remote) videoMountsRef.current.remote = remote;
    bindVideoMountsToLiveKit();
  }, [bindVideoMountsToLiveKit]);

  const resolveLkWaiters = useCallback((room: LKRoom | null) => {
    const waiters = lkReadyWaitersRef.current.splice(0);
    waiters.forEach((fn) => fn(room));
  }, []);

  const waitForLiveKit = useCallback((timeoutMs = 14_000): Promise<LKRoom | null> => {
    if (livekitRef.current) return Promise.resolve(livekitRef.current);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        const ix = lkReadyWaitersRef.current.indexOf(onReady);
        if (ix >= 0) lkReadyWaitersRef.current.splice(ix, 1);
        resolve(null);
      }, timeoutMs);
      const onReady = (room: LKRoom | null) => {
        clearTimeout(timer);
        resolve(room);
      };
      lkReadyWaitersRef.current.push(onReady);
    });
  }, []);

  const myEntry = queue.find((q) => q.userId === me);
  const activeSpeaker = queue.find((q) => q.status === "speaking");
  const pendingQueue = queue.filter((q) => q.status === "pending");
  const canPublishNow = isHost || myEntry?.status === "speaking";
  const myQueuePosition =
    myEntry?.status === "pending"
      ? (() => {
          const ix = pendingQueue.findIndex((q) => q.userId === me);
          return ix >= 0 ? ix + 1 : null;
        })()
      : null;

  useEffect(() => {
    publishGateRef.current = canPublishNow;
  }, [canPublishNow]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const st = myEntry?.status;
    if (st === "speaking" && prevQueueStatusRef.current !== "speaking") {
      toast.success("You're live — the room can hear you.", { duration: 2600 });
    }
    prevQueueStatusRef.current = st;
  }, [myEntry?.status]);

  useEffect(() => {
    if (!joined || !me || !mehfilId || !isLiveKitConfigured()) return;
    const wantPublish = isHost || myEntry?.status === "speaking";
    if (lkPublishModeRef.current === null) return;
    if (lkPublishModeRef.current === wantPublish) return;

    let cancelled = false;
    if (lkReconnectScheduledRef.current) clearTimeout(lkReconnectScheduledRef.current);
    lkReconnectScheduledRef.current = setTimeout(() => {
      lkReconnectScheduledRef.current = null;
      void (async () => {
        livekitRef.current?.disconnect();
        livekitRef.current = null;
        const cbs = lkCbRef.current;
        const ctrl = await connectToMehfil(mehfilId, me, wantPublish, {
          onConnectionStateChange: (state) => cbs.setLkConnState(state),
          onParticipantCountChange: () => {},
          onMicrophoneEnabledChanged: (enabled) => {
            if (publishGateRef.current) setMuted(!enabled);
          },
          onError: (err) => {
            console.error("[LiveKit] reconnect error", err);
            logOpsEvent("livekit_reconnect_failed", { mehfil_id: mehfilId, message: err.message });
          },
          onRemoteHostVideoChange: (available) => {
            setRemoteHostVideoAvailable(available);
            if (!available) setRemoteVideoPlaying(false);
          },
          onAudioBlocked: () => cbs.setAudioBlocked(true),
          onReconnecting: () => toast("Reconnecting audio…", { duration: 1700 }),
          onReconnected: () => toast.success("Audio restored", { duration: 1500 }),
        }, liveKitOptsFor(wantPublish));
        if (cancelled || !ctrl) {
          resolveLkWaiters(null);
          return;
        }
        livekitRef.current = ctrl;
        lkPublishModeRef.current = wantPublish;
        setLkRoomReady((n) => n + 1);
        bindVideoMountsToLiveKit();
        resolveLkWaiters(ctrl);
        ctrl.primeRemotePlayback("publish_role_switch");
        if (wantPublish && myEntry?.status === "speaking") {
          await ctrl.setMicEnabled(true);
          setMuted(false);
        } else if (wantPublish && isHost) {
          await ctrl.setMicEnabled(!mutedRef.current);
        } else {
          await ctrl.setMicEnabled(false);
          setMuted(true);
        }
        if (studio && isHost && wantPublish && !preflightForLiveKit()) {
          await ctrl.setCameraEnabled(hostCameraOn);
          bindVideoMountsToLiveKit();
        }
      })();
    }, 240);

    return () => {
      cancelled = true;
      if (lkReconnectScheduledRef.current) {
        clearTimeout(lkReconnectScheduledRef.current);
        lkReconnectScheduledRef.current = null;
      }
    };
  }, [joined, isHost, myEntry?.status, mehfilId, me, studio, liveKitOptsFor, hostCameraOn, bindVideoMountsToLiveKit, resolveLkWaiters, preflightForLiveKit]);

  useEffect(() => {
    if (!joined || !lkConnected || !livekitRef.current || !studio || !isHost) return;
    void livekitRef.current.setCameraEnabled(hostCameraOn).then(() => {
      if (!hostCameraOn) {
        setLocalVideoPlaying(false);
        const mount = videoMountsRef.current.local;
        if (mount) {
          mount.replaceChildren();
        }
      } else {
        bindVideoMountsToLiveKit();
      }
    });
  }, [joined, lkConnected, studio, isHost, hostCameraOn, bindVideoMountsToLiveKit]);


  useEffect(() => {
    if (!joined || !lkConnected || !livekitRef.current || !canPublishNow) return;
    const tick = () => {
      try {
        const micOn = livekitRef.current?.room.localParticipant.isMicrophoneEnabled;
        if (typeof micOn === "boolean") setMuted(!micOn);
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 2200);
    tick();
    return () => clearInterval(id);
  }, [joined, lkConnected, canPublishNow]);

  useEffect(() => {
    if (!lkConnected || !livekitRef.current) return;
    const publishing = isHost || myEntry?.status === "speaking";
    if (!publishing) return;
    try {
      const micOn = livekitRef.current.room.localParticipant.isMicrophoneEnabled;
      setMuted(!micOn);
    } catch {
      /* ignore */
    }
  }, [lkConnected, isHost, myEntry?.status]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || !joined) return;
      const lk = livekitRef.current;
      if (!lk) return;
      lk.enableAudio();
      lk.primeRemotePlayback("document_visibility");
      void lk.room.startAudio().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [joined]);

  useEffect(() => {
    if (!joined || !livekitRef.current || lkConnState === null) return;
    if (lkConnState === ConnectionState.Connected && prevLkConnRef.current !== ConnectionState.Connected) {
      livekitRef.current.enableAudio();
      livekitRef.current.primeRemotePlayback("conn_state_connected");
      void livekitRef.current.room.startAudio().catch(() => {});
    }
    prevLkConnRef.current = lkConnState;
  }, [joined, lkConnState]);

  useEffect(() => {
    if (!joined || !isLiveKitConfigured()) return;
    const t = window.setTimeout(() => {
      livekitRef.current?.enableAudio();
      livekitRef.current?.primeRemotePlayback("joined_stabilize");
      void livekitRef.current?.room.startAudio().catch(() => {});
    }, 380);
    return () => clearTimeout(t);
  }, [joined]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!joined || !ch || !me) return;
    const role = presenceRoleFor(isHost, myEntry?.status === "speaking");
    void ch.track({
      user_id: me,
      display_name: myUser?.displayName ?? "Guest",
      avatar_url: myUser?.avatarUrl ?? "",
      role,
    });
  }, [joined, me, myUser, isHost, myEntry?.status]);

  useEffect(() => {
    if (mehfil?.isLive) sawLiveRef.current = true;
  }, [mehfil?.isLive]);

  useEffect(() => {
    if (!joined || !mehfil || endedRef.current) return;
    // Only treat as "ended" after we've observed this session as live at least once,
    // so early joins (scheduled / lobby) are not torn down when is_live is still false.
    if (!mehfil.isLive && sawLiveRef.current) {
      endedRef.current = true;
      channelRef.current?.untrack();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      livekitRef.current?.disconnect();
      livekitRef.current = null;
      lkPublishModeRef.current = null;
      joinCycleStartedRef.current = false;
      videoMountsRef.current = { local: null, remote: null };
      setLkRoomReady(0);
      setJoined(false);
      setRoomEnded(true);
      toast.message("This Mehfil has ended.", { duration: 3200 });
    }
  }, [joined, mehfil?.isLive, mehfil]);

  const fullMediaReset = useCallback(() => {
    media.reset();
    mehfilMedia.clearPreflightMedia();
    setLocalVideoPlaying(false);
    setRemoteVideoPlaying(false);
    setRemoteHostVideoAvailable(false);
    joinCycleStartedRef.current = false;
    lkPublishModeRef.current = null;
    if (lkReconnectScheduledRef.current) {
      clearTimeout(lkReconnectScheduledRef.current);
      lkReconnectScheduledRef.current = null;
    }
    videoMountsRef.current = { local: null, remote: null };
    prevLkConnRef.current = null;
    prevQueueStatusRef.current = undefined;
    publishGateRef.current = false;
    sawLiveRef.current = false;
    endedRef.current = false;
    setLkRoomReady(0);
    setLkConnState(null);
    setAudioBlocked(false);
  }, [media, mehfilMedia]);

  const disconnectSession = useCallback(() => {
    if (lkReconnectScheduledRef.current) {
      clearTimeout(lkReconnectScheduledRef.current);
      lkReconnectScheduledRef.current = null;
    }
    channelRef.current?.untrack();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    livekitRef.current?.disconnect();
    livekitRef.current = null;
    resolveLkWaiters(null);
  }, [resolveLkWaiters]);

  const teardown = useCallback(() => {
    if (import.meta.env.DEV) console.info("[mehfil:session] teardown");
    if (supportDismissTimerRef.current) {
      clearTimeout(supportDismissTimerRef.current);
      supportDismissTimerRef.current = null;
    }
    disconnectSession();
    fullMediaReset();
  }, [disconnectSession, fullMediaReset]);

  useEffect(() => () => disconnectSession(), [disconnectSession]);

  const sendHostMuteSpeaker = useCallback((targetUserId: string) => {
    const ch = channelRef.current;
    if (!ch || !isHost || targetUserId === me) return;
    void ch.send({
      type: "broadcast",
      event: "lk_host_mute",
      payload: { target_user_id: targetUserId },
    });
  }, [isHost, me]);

  const broadcastRoomSupport = useCallback((payload: MehfilSupportBroadcast) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: "broadcast",
      event: "support_received",
      payload: {
        kind: payload.kind,
        amount: payload.amount,
        from_user_id: payload.from_user_id,
        from_display_name: payload.from_display_name,
      },
    });
  }, []);

  const attachLiveKitRoom = useCallback(
    async (room: LKRoom, canPublish: boolean) => {
      livekitRef.current = room;
      lkPublishModeRef.current = canPublish;
      setLkRoomReady((n) => n + 1);
      bindVideoMountsToLiveKit();
      if (canPublish && isHost) {
        await room.setMicEnabled(true);
        setMuted(false);
      }
      if (studio && isHost && canPublish) {
        media.transition("publishing");
        const hasPreflight = Boolean(preflightForLiveKit());
        if (!hasPreflight) {
          await room.setCameraEnabled(true);
        }
        setHostCameraOn(true);
        bindVideoMountsToLiveKit();
        const pub = await room.verifyHostTracksPublished(true);
        if (pub.ok) {
          media.transition("published");
          setLocalVideoPlaying(true);
        } else if (pub.ok === false) {
          if (pub.cameraFailed) toast.error("Camera failed to publish");
          if (pub.micFailed) toast.error("Microphone failed to publish");
          media.markFailed({
            camera: pub.cameraFailed ? "Camera failed to publish" : undefined,
            mic: pub.micFailed ? "Microphone failed to publish" : undefined,
          });
        }
      } else if (!canPublish && studio) {
        media.transition("subscribed");
        room.ensureRemotePlayback("listener_join");
        setRemoteHostVideoAvailable(room.isRemoteHostVideoAvailable());
      } else {
        media.transition(canPublish ? "published" : "subscribed");
      }
      room.primeRemotePlayback("post_join_handshake");
      resolveLkWaiters(room);
    },
    [isHost, studio, bindVideoMountsToLiveKit, media, preflightForLiveKit, resolveLkWaiters],
  );

  const connectLiveKitSession = useCallback(
    async (canPublish: boolean): Promise<LKRoom | null> => {
      if (!me || !mehfilId || !isLiveKitConfigured()) {
        resolveLkWaiters(null);
        return null;
      }
      if (livekitRef.current) {
        resolveLkWaiters(livekitRef.current);
        return livekitRef.current;
      }

      media.transition("connecting");
      const preflight = preflightForLiveKit();
      if (import.meta.env.DEV && studio && isHost && canPublish) {
        console.info("[mehfil:session] connect_preflight", {
          has_preflight: Boolean(preflight),
          video_live: preflight?.videoTrack?.readyState === "live",
          audio_live: preflight?.audioTrack?.readyState === "live",
        });
      }

      const room = await connectToMehfil(
        mehfilId,
        me,
        canPublish,
        {
          onConnectionStateChange: (state) => {
            setLkConnState(state);
            if (state === ConnectionState.Connected) media.transition("connected");
            if (state === ConnectionState.Reconnecting) media.transition("recovering");
          },
          onParticipantCountChange: () => {},
          onMicrophoneEnabledChanged,
          onError: (err) => {
            console.error("[LiveKit] error", err);
            logOpsEvent("livekit_error", { mehfil_id: mehfilId, message: err.message });
            const deviceNoise = /NotAllowedError|Permission|device|camera|microphone|NotFoundError/i.test(err.message);
            const connected = livekitRef.current?.room.state === ConnectionState.Connected;
            if (!deviceNoise && !connected) {
              media.markFailed({ remote: err.message });
            }
            if (
              !deviceNoise &&
              !connected &&
              !err.message.includes("VITE_LIVEKIT_URL") &&
              media.phaseRef.current !== "recovering"
            ) {
              toast.error("Audio issue — reconnecting soon…", { duration: 2800 });
            }
          },
          onRemoteHostVideoChange: (available) => {
            setRemoteHostVideoAvailable(available);
            if (!available) setRemoteVideoPlaying(false);
          },
          onAudioBlocked: () => setAudioBlocked(true),
          onReconnecting: () => {
            media.transition("recovering");
            toast("Reconnecting audio…", { duration: 1900 });
          },
          onReconnected: () => {
            media.transition("connected");
            toast.success("Audio reconnected", { duration: 1600 });
          },
        },
        liveKitOptsFor(canPublish),
      );

      if (!room) {
        media.markFailed({ remote: "livekit_connect_failed" });
        joinCycleStartedRef.current = false;
        resolveLkWaiters(null);
        return null;
      }

      await attachLiveKitRoom(room, canPublish);
      return room;
    },
    [
      me,
      mehfilId,
      studio,
      isHost,
      onMicrophoneEnabledChanged,
      liveKitOptsFor,
      media,
      preflightForLiveKit,
      attachLiveKitRoom,
      resolveLkWaiters,
    ],
  );

  const joinRoom = useCallback(async () => {
    if (!me || !mehfil) return;
    if (joinCycleStartedRef.current && livekitRef.current) return;
    if (joinCycleStartedRef.current && !livekitRef.current) {
      joinCycleStartedRef.current = false;
    }
    if (joinCycleStartedRef.current) return;
    joinCycleStartedRef.current = true;
    if (import.meta.env.DEV) console.info("[mehfil:session] join_start", { mehfil_id: mehfilId });
    if (studio && isHost) setHostCameraOn(true);
    setJoined(true);
    earnInkPoints(me, 15).catch(console.warn);

    const canPublish = isHost || myEntry?.status === "speaking";
    if (isLiveKitConfigured()) {
      await connectLiveKitSession(canPublish);
    } else {
      media.transition("connected");
      resolveLkWaiters(null);
    }

    const displayName = myUser?.displayName ?? "Guest";
    const avatarUrl = myUser?.avatarUrl ?? "";
    const role = presenceRoleFor(isHost, myEntry?.status === "speaking");
    const channel = supabase.channel(`mehfil:${mehfilId}`, {
      config: { presence: { key: me } },
    });

    const syncPresence = () => {
      const state = channel.presenceState<PresencePayload>();
      const merged = Object.values(state).flat() as PresencePayload[];
      const byUser = new Map<string, PresencePayload>();
      for (const row of merged) {
        if (row?.user_id) byUser.set(row.user_id, row);
      }
      setPresence(Array.from(byUser.values()));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, () => {
        syncPresence();
      })
      .on("presence", { event: "leave" }, () => syncPresence())
      .on("broadcast", { event: "chat" }, ({ payload }: { payload: ChatMsg }) => {
        setChat((c) => [...c.slice(-80), payload]);
        setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 40);
      })
      .on("broadcast", { event: "lk_host_mute" }, ({ payload }: { payload?: { target_user_id?: string } }) => {
        if (payload?.target_user_id !== me) return;
        setMuted(true);
        void livekitRef.current?.setMicEnabled(false);
        toast.message("Host muted your microphone", { duration: 2400 });
      })
      .on("broadcast", { event: "support_received" }, ({ payload }: { payload?: MehfilSupportBroadcast }) => {
        if (!payload?.from_user_id) return;
        setSupportMoment(payload);
        const kindLabel =
          payload.kind === "chai"
            ? "Chai"
            : payload.kind === "rose"
              ? "Rose"
              : payload.kind === "applaud"
                ? "Applause"
                : payload.kind === "support"
                  ? "Support"
                  : payload.kind;
        const sysMsg: ChatMsg = {
          id: `s${Date.now()}`,
          userId: "__system__",
          name: payload.from_display_name,
          text: `· ${kindLabel}${payload.amount > 1 ? ` ×${payload.amount}` : ""}`,
        };
        setChat((c) => [...c.slice(-80), sysMsg]);
        setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 40);
        if (supportDismissTimerRef.current) clearTimeout(supportDismissTimerRef.current);
        supportDismissTimerRef.current = setTimeout(() => {
          setSupportMoment(null);
          supportDismissTimerRef.current = null;
        }, 5600);
        if (mehfil?.hostId && me === mehfil.hostId) {
          toast.message(`${payload.from_display_name} sent appreciation`, { duration: 3000 });
        }
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          user_id: me,
          display_name: displayName,
          avatar_url: avatarUrl,
          role,
        });
        syncPresence();
        trackEvent("mehfil_join", { mehfil_id: mehfilId });
      });

    channelRef.current = channel;
  }, [
    me,
    myUser,
    mehfil,
    mehfilId,
    isHost,
    myEntry?.status,
    studio,
    connectLiveKitSession,
    media,
    resolveLkWaiters,
  ]);

  /** Studio host: connect → verify publish → only then mark mehfil LIVE. */
  const startHostMehfilLive = useCallback(
    async (markLive: (id: string) => Promise<void>): Promise<boolean> => {
      if (!isHost) return false;

      if (!isLiveKitConfigured()) {
        toast.error(
          "Studio needs LiveKit. Add VITE_LIVEKIT_URL to .env.local (wss://…livekit.cloud) and restart the dev server.",
          { duration: 7000 },
        );
        media.markFailed({ remote: "livekit_not_configured" });
        return false;
      }

      const preflight = preflightForLiveKit();
      if (studio && !preflight) {
        toast.message("Camera check stream was lost — allow camera/mic again from Prepare Mehfil.", {
          duration: 5000,
        });
      }

      if (!joined) {
        joinCycleStartedRef.current = false;
        await joinRoom();
      } else if (!livekitRef.current) {
        joinCycleStartedRef.current = false;
        const canPublish = true;
        await connectLiveKitSession(canPublish);
      }

      const lk = livekitRef.current ?? (await waitForLiveKit());
      if (!lk) {
        const reason = media.failure?.remote;
        if (reason === "livekit_not_configured" || reason?.includes("VITE_LIVEKIT_URL")) {
          toast.error(
            "Studio needs LiveKit. Add VITE_LIVEKIT_URL to .env.local and restart the dev server.",
            { duration: 7000 },
          );
        } else if (reason === "livekit_connect_failed") {
          toast.error("Could not connect to the studio room. Check LiveKit URL and token settings.");
        } else {
          toast.error("Could not connect to the studio room.");
        }
        media.markFailed({ remote: "livekit_timeout" });
        joinCycleStartedRef.current = false;
        return false;
      }

      if (studio) {
        media.transition("publishing");
        const pub = await lk.verifyHostTracksPublished(hostCameraOn);
        if (pub.ok === false) {
          const parts: string[] = [];
          if (pub.cameraFailed) parts.push("Camera failed to publish");
          if (pub.micFailed) parts.push("Microphone failed to publish");
          toast.error(parts.join(" · ") || "Could not publish studio media");
          media.markFailed({
            camera: pub.cameraFailed ? "Camera failed to publish" : undefined,
            mic: pub.micFailed ? "Microphone failed to publish" : undefined,
          });
          return false;
        }
        media.transition("published");
      }

      await markLive(mehfilId);
      return true;
    },
    [isHost, joined, joinRoom, waitForLiveKit, studio, mehfilId, media, preflightForLiveKit, connectLiveKitSession, hostCameraOn],
  );

  const leaveRoom = useCallback(() => {
    setSupportMoment(null);
    if (supportDismissTimerRef.current) {
      clearTimeout(supportDismissTimerRef.current);
      supportDismissTimerRef.current = null;
    }
    teardown();
    setJoined(false);
    setMuted(false);
    setRoomEnded(false);
    if (studio && isHost) setHostCameraOn(true);
    navigateToMehfilList();
  }, [teardown, navigateToMehfilList, studio, isHost]);

  const sendChat = useCallback(() => {
    if (!draft.trim() || !channelRef.current || !me || !myUser) return;
    const msg: ChatMsg = {
      id: `m${Date.now()}`,
      userId: me,
      name: myUser.displayName,
      text: draft.trim(),
    };
    channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    setChat((c) => [...c.slice(-80), msg]);
    setDraft("");
    setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 40);
  }, [draft, me, myUser]);

  const buyTicket = useCallback(async () => {
    if (!mehfil?.hostId || !mehfil.ticketPrice) return;
    setPayingTicket(true);
    try {
      await sendSupportAction(mehfil.hostId, "ticket", mehfil.ticketPrice, undefined, mehfilId);
      invalidateWallet(qc);
      setHasTicket(true);
      await joinRoom();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg === "insufficient_balance" ? "Not enough balance" : "Could not join");
    } finally {
      setPayingTicket(false);
    }
  }, [mehfil?.hostId, mehfil?.ticketPrice, mehfilId, joinRoom, qc]);

  const finalizeHostEnd = useCallback(() => {
    teardown();
    endedRef.current = true;
    setJoined(false);
    setRoomEnded(true);
    setReplaySheetOpen(true);
    toast.success("Mehfil ended");
  }, [teardown]);

  const closeReplayAndExit = useCallback(() => {
    setReplaySheetOpen(false);
    setRoomEnded(false);
    endedRef.current = false;
    leaveRoom();
  }, [leaveRoom]);

  const gatheredVoices = (() => {
    const fromPresence = presence.filter((p) => p.role !== "host").length;
    if (fromPresence > 0) return fromPresence;
    if (joined && me && !isHost) return 1;
    return 0;
  })();
  const benchListeners = presence.filter((p) => {
    if (p.role === "host" || p.role === "speaker") return false;
    if (activeSpeaker && p.user_id === activeSpeaker.userId) return false;
    return true;
  });

  const lkMediaReady = ["connected", "published", "subscribed"].includes(media.phase);
  const lkConnecting =
    isLiveKitConfigured() &&
    joined &&
    !lkConnected &&
    lkConnState !== ConnectionState.Reconnecting &&
    !lkMediaReady;
  const lkReconnecting = lkConnState === ConnectionState.Reconnecting;

  return {
    me,
    myUser,
    isHost,
    joined,
    setJoined,
    roomEnded,
    replaySheetOpen,
    setReplaySheetOpen,
    presence,
    chat,
    draft,
    setDraft,
    supportOpen,
    setSupportOpen,
    hostMenuOpen,
    setHostMenuOpen,
    payingTicket,
    hasTicket,
    setHasTicket,
    muted,
    setMuted,
    lkConnState,
    audioBlocked,
    setAudioBlocked,
    chatRef,
    livekitRef,
    activeSpeaker,
    pendingQueue,
    myQueuePosition,
    myEntry,
    canPublishNow,
    sendHostMuteSpeaker,
    gatheredVoices,
    benchListeners,
    lkConnecting,
    lkConnected,
    lkReconnecting,
    joinRoom,
    leaveRoom,
    sendChat,
    buyTicket,
    finalizeHostEnd,
    closeReplayAndExit,
    teardown,
    supportMoment,
    broadcastRoomSupport,
    studio,
    hostCameraOn,
    setHostCameraOn,
    bindLiveKitVideo,
    lkRoomReady,
    mediaPhase: media.phase,
    mediaFailure: media.failure,
    preflightStream: mehfilMedia.preflight?.stream ?? null,
    localVideoPlaying,
    setLocalVideoPlaying,
    remoteVideoPlaying,
    setRemoteVideoPlaying,
    remoteHostVideoAvailable,
    retryHostPublish: async () => {
      const lk = livekitRef.current;
      if (!lk) return;
      media.transition("publishing");
      const pub = await lk.verifyHostTracksPublished(true);
      if (pub.ok) {
        media.transition("published");
        setLocalVideoPlaying(true);
        bindVideoMountsToLiveKit();
      } else if (pub.ok === false) {
        if (pub.cameraFailed) toast.error("Camera failed to publish");
        if (pub.micFailed) toast.error("Microphone failed to publish");
        media.markFailed({
          camera: pub.cameraFailed ? "Camera failed to publish" : undefined,
          mic: pub.micFailed ? "Microphone failed to publish" : undefined,
        });
      }
    },
    retryRemotePlayback: () => {
      livekitRef.current?.ensureRemotePlayback("user_retry");
    },
    startHostMehfilLive,
  };
}
