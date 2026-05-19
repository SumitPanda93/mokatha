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
import { connectToMehfil, isLiveKitConfigured, type LiveKitRoom as LKRoom, type MehfilLiveKitOpts } from "@/lib/livekit";

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

  const liveKitOptsFor = useCallback(
    (wantPublish: boolean): MehfilLiveKitOpts => ({
      publishCamera: Boolean(studio && wantPublish && isHost),
      remoteHostIdentity:
        studio && me && mehfil?.hostId && me !== mehfil.hostId ? mehfil.hostId : null,
    }),
    [studio, isHost, me, mehfil?.hostId],
  );

  const [hostCameraOn, setHostCameraOn] = useState(() => Boolean(studio && isHost));
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
          onAudioBlocked: () => cbs.setAudioBlocked(true),
          onReconnecting: () => toast("Reconnecting audio…", { duration: 1700 }),
          onReconnected: () => toast.success("Audio restored", { duration: 1500 }),
        }, liveKitOptsFor(wantPublish));
        if (cancelled || !ctrl) return;
        livekitRef.current = ctrl;
        lkPublishModeRef.current = wantPublish;
        setLkRoomReady((n) => n + 1);
        bindVideoMountsToLiveKit();
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
        if (studio && isHost && wantPublish) {
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
  }, [joined, isHost, myEntry?.status, mehfilId, me, studio, liveKitOptsFor, hostCameraOn, bindVideoMountsToLiveKit]);

  useEffect(() => {
    if (!joined || !lkConnected || !livekitRef.current || !studio || !isHost) return;
    void livekitRef.current.setCameraEnabled(hostCameraOn);
  }, [joined, lkConnected, studio, isHost, hostCameraOn]);


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
    if (!joined || !ch || !me || !myUser) return;
    const role = presenceRoleFor(isHost, myEntry?.status === "speaking");
    void ch.track({
      user_id: me,
      display_name: myUser.displayName,
      avatar_url: myUser.avatarUrl ?? "",
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

  const teardown = useCallback(() => {
    if (import.meta.env.DEV) console.info("[mehfil:session] teardown");
    if (lkReconnectScheduledRef.current) {
      clearTimeout(lkReconnectScheduledRef.current);
      lkReconnectScheduledRef.current = null;
    }
    if (supportDismissTimerRef.current) {
      clearTimeout(supportDismissTimerRef.current);
      supportDismissTimerRef.current = null;
    }
    channelRef.current?.untrack();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    livekitRef.current?.disconnect();
    livekitRef.current = null;
    lkPublishModeRef.current = null;
    joinCycleStartedRef.current = false;
    videoMountsRef.current = { local: null, remote: null };
    setLkRoomReady(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

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

  const joinRoom = useCallback(async () => {
    if (!me || !myUser || !mehfil) return;
    if (joinCycleStartedRef.current) return;
    joinCycleStartedRef.current = true;
    if (import.meta.env.DEV) console.info("[mehfil:session] join_start", { mehfil_id: mehfilId });
    if (studio && isHost) setHostCameraOn(true);
    setJoined(true);
    earnInkPoints(me, 15).catch(console.warn);

    if (isLiveKitConfigured()) {
      const canPublish = isHost || myEntry?.status === "speaking";
      connectToMehfil(mehfilId, me, canPublish, {
        onConnectionStateChange: setLkConnState,
        onParticipantCountChange: () => {},
        onMicrophoneEnabledChanged,
        onError: (err) => {
          console.error("[LiveKit] error", err);
          logOpsEvent("livekit_error", { mehfil_id: mehfilId, message: err.message });
          toast.error("Audio issue — reconnecting soon…", { duration: 2800 });
        },
        onAudioBlocked: () => setAudioBlocked(true),
        onReconnecting: () => toast("Reconnecting audio…", { duration: 1900 }),
        onReconnected: () => toast.success("Audio reconnected", { duration: 1600 }),
      }, liveKitOptsFor(canPublish)).then(async (room) => {
        if (!room) return;
        livekitRef.current = room;
        lkPublishModeRef.current = canPublish;
        setLkRoomReady((n) => n + 1);
        bindVideoMountsToLiveKit();
        if (canPublish && isHost) {
          await room.setMicEnabled(true);
          setMuted(false);
        }
        if (studio && isHost && canPublish) {
          await room.setCameraEnabled(true);
          setHostCameraOn(true);
          bindVideoMountsToLiveKit();
        }
        room.primeRemotePlayback("post_join_handshake");
      });
    }

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
          display_name: myUser.displayName,
          avatar_url: myUser.avatarUrl ?? "",
          role,
        });
        syncPresence();
        trackEvent("mehfil_join", { mehfil_id: mehfilId });
      });

    channelRef.current = channel;
  }, [me, myUser, mehfil, mehfilId, isHost, myEntry?.status, onMicrophoneEnabledChanged, liveKitOptsFor, studio, bindVideoMountsToLiveKit]);

  const leaveRoom = useCallback(() => {
    setSupportMoment(null);
    if (supportDismissTimerRef.current) {
      clearTimeout(supportDismissTimerRef.current);
      supportDismissTimerRef.current = null;
    }
    teardown();
    joinCycleStartedRef.current = false;
    lkPublishModeRef.current = null;
    setLkRoomReady(0);
    endedRef.current = false;
    sawLiveRef.current = false;
    setJoined(false);
    setLkConnState(null);
    setMuted(false);
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

  const lkConnecting = isLiveKitConfigured() && joined && (!lkConnState || lkConnState === ConnectionState.Connecting);
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
  };
}
