/**
 * Mehfil room session — audio-first state machine (LiveKit + Supabase Presence + broadcast chat).
 * Keeps listener/speaker presence roles aligned with the speaker queue.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState } from "livekit-client";
import { toast } from "sonner";
import {
  supabase,
  earnInkPoints,
  sendSupportAction,
  getCurrentUserId,
  useUser,
  type QueueEntry,
  type Mehfil,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { logOpsEvent } from "@/lib/observability";
import { connectToMehfil, isLiveKitConfigured, type LiveKitRoom as LKRoom } from "@/lib/livekit";

export type PresenceRole = "host" | "speaker" | "listener";

export type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  role: PresenceRole;
};

export type ChatMsg = { id: string; userId: string; name: string; text: string };

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
  const [audioBlocked, setAudioBlocked] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const livekitRef = useRef<LKRoom | null>(null);
  const lkPublishModeRef = useRef<boolean | null>(null);
  const lkReconnectScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const mutedRef = useRef(false);
  const prevQueueStatusRef = useRef<string | undefined>(undefined);
  const prevLkConnRef = useRef<ConnectionState | null>(null);

  const lkCbRef = useRef({
    setLkConnState: (_s: ConnectionState) => {},
    setAudioBlocked: (_v: boolean) => {},
  });
  lkCbRef.current.setLkConnState = setLkConnState;
  lkCbRef.current.setAudioBlocked = setAudioBlocked;

  const isHost = !!me && !!mehfil && me === mehfil.hostId;
  const myEntry = queue.find((q) => q.userId === me);
  const activeSpeaker = queue.find((q) => q.status === "speaking");
  const pendingQueue = queue.filter((q) => q.status === "pending");
  const canPublishNow = isHost || myEntry?.status === "speaking";

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
          onError: (err) => {
            console.error("[LiveKit] reconnect error", err);
            logOpsEvent("livekit_reconnect_failed", { mehfil_id: mehfilId, message: err.message });
          },
          onAudioBlocked: () => cbs.setAudioBlocked(true),
          onReconnecting: () => toast("Reconnecting audio…", { duration: 1700 }),
          onReconnected: () => toast.success("Audio restored", { duration: 1500 }),
        });
        if (cancelled || !ctrl) return;
        livekitRef.current = ctrl;
        lkPublishModeRef.current = wantPublish;
        if (wantPublish && myEntry?.status === "speaking") {
          await ctrl.setMicEnabled(true);
          setMuted(false);
        } else if (wantPublish && isHost) {
          await ctrl.setMicEnabled(!mutedRef.current);
        } else {
          await ctrl.setMicEnabled(false);
          setMuted(true);
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
  }, [joined, isHost, myEntry?.status, mehfilId, me]);

  const lkConnected = lkConnState === ConnectionState.Connected;
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
      void lk.room.startAudio().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [joined]);

  useEffect(() => {
    if (!joined || !livekitRef.current || lkConnState === null) return;
    if (lkConnState === ConnectionState.Connected && prevLkConnRef.current !== ConnectionState.Connected) {
      livekitRef.current.enableAudio();
      void livekitRef.current.room.startAudio().catch(() => {});
    }
    prevLkConnRef.current = lkConnState;
  }, [joined, lkConnState]);

  useEffect(() => {
    if (!joined || !isLiveKitConfigured()) return;
    const t = window.setTimeout(() => {
      livekitRef.current?.enableAudio();
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
    if (!joined || !mehfil || mehfil.isLive || endedRef.current) return;
    endedRef.current = true;
    channelRef.current?.untrack();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    livekitRef.current?.disconnect();
    livekitRef.current = null;
    lkPublishModeRef.current = null;
    setJoined(false);
    setRoomEnded(true);
    toast.message("This Mehfil has ended.", { duration: 3200 });
  }, [joined, mehfil?.isLive, mehfil]);

  const teardown = useCallback(() => {
    if (lkReconnectScheduledRef.current) {
      clearTimeout(lkReconnectScheduledRef.current);
      lkReconnectScheduledRef.current = null;
    }
    channelRef.current?.untrack();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    livekitRef.current?.disconnect();
    livekitRef.current = null;
    lkPublishModeRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const joinRoom = useCallback(async () => {
    if (!me || !myUser || !mehfil) return;
    setJoined(true);
    earnInkPoints(me, 15).catch(console.warn);

    if (isLiveKitConfigured()) {
      const canPublish = isHost || myEntry?.status === "speaking";
      connectToMehfil(mehfilId, me, canPublish, {
        onConnectionStateChange: setLkConnState,
        onParticipantCountChange: () => {},
        onError: (err) => {
          console.error("[LiveKit] error", err);
          logOpsEvent("livekit_error", { mehfil_id: mehfilId, message: err.message });
          toast.error("Audio issue — reconnecting soon…", { duration: 2800 });
        },
        onAudioBlocked: () => setAudioBlocked(true),
        onReconnecting: () => toast("Reconnecting audio…", { duration: 1900 }),
        onReconnected: () => toast.success("Audio reconnected", { duration: 1600 }),
      }).then((room) => {
        if (room) {
          livekitRef.current = room;
          lkPublishModeRef.current = canPublish;
        }
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
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          user_id: me,
          display_name: myUser.displayName,
          avatar_url: myUser.avatarUrl ?? "",
          role,
        });
        trackEvent("mehfil_join", { mehfil_id: mehfilId });
      });

    channelRef.current = channel;
  }, [me, myUser, mehfil, mehfilId, isHost, myEntry?.status]);

  const leaveRoom = useCallback(() => {
    teardown();
    endedRef.current = false;
    navigateToMehfilList();
  }, [teardown, navigateToMehfilList]);

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
      setHasTicket(true);
      await joinRoom();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg === "insufficient_balance" ? "Not enough balance" : "Could not join");
    } finally {
      setPayingTicket(false);
    }
  }, [mehfil?.hostId, mehfil?.ticketPrice, mehfilId, joinRoom]);

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

  const gatheredVoices = presence.filter((p) => p.role !== "host").length;
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
    myEntry,
    canPublishNow,
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
  };
}
