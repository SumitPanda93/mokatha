/**
 * MehfilRoom — immersive live audio room.
 * Features: Supabase Presence for participants, DB-backed speaker queue,
 * broadcast chat, ticketed paywall, host controls, support (chai) integration.
 * Audio: LiveKit WebRTC (VITE_LIVEKIT_URL required; gracefully degraded if absent).
 */
import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useMehfil, useUser, getCurrentUserId, useEarnInkPoints,
  useMehfilRealtime, useMehfilQueue, useMehfilQueueRealtime,
  useRaiseHand, useLowerHand, useApproveQueueEntry, useRejectQueueEntry,
  useEndSpeakerTurn, useEndMehfil, useStartMehfil,
  sendSupportAction, earnInkPoints, supabase,
  usePublishedMehfilReplay,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { logOpsEvent } from "@/lib/observability";
import MehfilReplaySheet from "@/components/MehfilReplaySheet";
import { toast } from "sonner";
import {
  Send, Mic, MicOff, Users, Hand, Settings, X,
  ChevronRight, CheckCircle, XCircle, Crown, Radio,
} from "lucide-react";
import SupportSheet from "@/components/SupportSheet";
import { connectToMehfil, isLiveKitConfigured, LiveKitRoom as LKRoom } from "@/lib/livekit";
import { ConnectionState } from "livekit-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  role: "host" | "speaker" | "listener";
};

type ChatMsg = { id: string; userId: string; name: string; text: string };

// ─── Helper components ────────────────────────────────────────────────────────

const AvatarStack = ({ users, max = 8 }: { users: PresencePayload[]; max?: number }) => {
  const visible = users.slice(0, max);
  const extra = users.length - max;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div key={u.user_id}
          className="w-8 h-8 rounded-full border-2 overflow-hidden shrink-0"
          style={{ borderColor: "#1A0F14", marginLeft: i > 0 ? -10 : 0, zIndex: max - i }}>
          {u.avatar_url
            ? <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: "rgba(201,168,76,0.3)", color: "#C9A84C" }}>
                {u.display_name.charAt(0).toUpperCase()}
              </div>}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px]"
          style={{ borderColor: "#1A0F14", marginLeft: -10, background: "rgba(255,255,255,0.12)", color: "rgba(245,243,239,0.7)" }}>
          +{extra}
        </div>
      )}
    </div>
  );
};

const AudioBars = ({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[3px] h-5">
    {Array.from({ length: 10 }).map((_, i) => (
      <motion.div key={i} className="w-[3px] rounded-full"
        style={{ background: active ? "#E8B14A" : "rgba(232,177,74,0.3)" }}
        animate={active
          ? { height: ["20%", "100%", "30%", "70%", "15%"][i % 5] }
          : { height: "20%" }
        }
        transition={{ duration: 0.5 + (i % 3) * 0.2, repeat: Infinity, repeatType: "mirror", delay: i * 0.08 }}
      />
    ))}
  </div>
);

function SpeakerActiveView({ muted, onToggleMute }: { muted: boolean; onToggleMute: () => void }) {
  return (
    <div className="text-center">
      <motion.button whileTap={{ scale: 0.93 }} onClick={onToggleMute}
        className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3"
        style={{
          background: muted ? "rgba(247,106,74,0.15)" : "rgba(107,232,158,0.15)",
          border: `1.5px solid ${muted ? "#F76A4A" : "#6BE89E"}`,
        }}>
        {muted
          ? <MicOff size={24} style={{ color: "#F76A4A" }} />
          : <Mic size={24} style={{ color: "#6BE89E" }} />}
      </motion.button>
      <div className="text-[14px] font-['Playfair_Display'] italic" style={{ color: "#6BE89E" }}>
        {muted ? "Mic off" : "You're speaking"}
      </div>
      <div className="text-[11px] mt-1" style={{ color: "rgba(245,243,239,0.35)" }}>
        {muted ? "Tap to unmute" : "Host will end your turn when ready"}
      </div>
    </div>
  );
}

/** Stage strip for guest speaker — queue is canonical; profile fills gaps before presence updates */
function ActiveSpeakerStrip({
  speakerUserId,
  presenceRow,
}: {
  speakerUserId: string;
  presenceRow?: PresencePayload;
}) {
  const { data: profile } = useUser(speakerUserId);
  const displayName = presenceRow?.display_name ?? profile?.displayName ?? "Speaker";
  const avatarUrl = presenceRow?.avatar_url ?? profile?.avatarUrl ?? "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(107,232,158,0.18), rgba(232,177,74,0.08))",
        border: "1px solid rgba(107,232,158,0.42)",
        boxShadow: "0 14px 44px rgba(0,0,0,0.38), 0 0 52px rgba(107,232,158,0.10)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none rounded-2xl opacity-45"
        style={{ background: "radial-gradient(ellipse 80% 120% at 20% 50%, rgba(107,232,158,0.28), transparent 55%)" }} />
      <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-[#6BE89E]/45">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[13px]"
              style={{ background: "rgba(107,232,158,0.2)", color: "#6BE89E" }}>
              {displayName.charAt(0)}
            </div>}
        <div className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: "#6BE89E", animation: "speak-ring 1.8s ease-out infinite" }} />
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="text-[10px] font-['Inter'] font-semibold tracking-[0.22em] uppercase" style={{ color: "#B8FFD9" }}>
          On stage
        </div>
        <div className="text-[15px] font-['Playfair_Display'] leading-tight truncate">{displayName}</div>
      </div>
      <div className="relative shrink-0">
        <AudioBars active />
      </div>
    </motion.div>
  );
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function TicketPaywall({
  mehfil, host, onPay, onLeave, paying,
}: {
  mehfil: any; host: any; onPay: () => void; onLeave: () => void; paying: boolean;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-7 text-center"
      style={{ background: "#1A0F14", color: "#F5F3EF" }}>
      <div className="absolute top-0 left-0 right-0 h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top, rgba(247,106,74,0.12) 0%, transparent 70%)" }} />

      {host?.avatarUrl && (
        <div className="w-20 h-20 rounded-full overflow-hidden mb-5 border-2"
          style={{ borderColor: "rgba(232,177,74,0.5)" }}>
          <img src={host.avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: "rgba(232,177,74,0.7)" }}>
        Support this gathering
      </div>
      <div className="font-['Playfair_Display'] text-[26px] leading-tight mb-2">{mehfil.title}</div>
      <div className="text-[13px] mb-1" style={{ color: "rgba(245,243,239,0.55)" }}>
        hosted by {host?.displayName ?? "Host"}
      </div>
      <div className="text-[12px] mb-8" style={{ color: "rgba(245,243,239,0.35)" }}>
        This gathering asks for a small contribution to enter.
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={onPay} disabled={paying}
        className="w-full max-w-xs py-4 rounded-2xl text-[15px] font-['Inter'] font-medium mb-3"
        style={{
          background: "linear-gradient(135deg,#C9A84C 0%,#E09060 55%,#F76A4A 100%)",
          color: "#1A0F14",
          boxShadow: "0 8px 28px rgba(201,168,76,0.25)",
        }}>
        {paying ? "Processing…" : `Contribute ₹${mehfil.ticketPrice} · Enter`}
      </motion.button>

      <button onClick={onLeave}
        className="text-[12px]" style={{ color: "rgba(245,243,239,0.35)" }}>
        Leave quietly
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MehfilRoom() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();
  const { data: mehfil, isLoading } = useMehfil(id);
  const { data: host } = useUser(mehfil?.hostId ?? "");
  const me = getCurrentUserId();
  const { data: myUser } = useUser(me ?? "");

  useTitle(mehfil?.title ?? "Mehfil");
  useMehfilRealtime(id);
  useMehfilQueueRealtime(id);

  const { data: queue = [] } = useMehfilQueue(id);
  const { data: publishedReplay } = usePublishedMehfilReplay(id);

  // ── State ──
  const [joined, setJoined] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [replaySheetOpen, setReplaySheetOpen] = useState(false);
  const [presence, setPresence] = useState<PresencePayload[]>([]);
  const [tab, setTab] = useState<"chat" | "people" | "queue">("chat");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [hostMenuOpen, setHostMenuOpen] = useState(false);
  const [payingTicket, setPayingTicket] = useState(false);
  const [hasTicket, setHasTicket] = useState(false);
  const [muted, setMuted] = useState(false);

  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatRef     = useRef<HTMLDivElement>(null);
  const livekitRef  = useRef<LKRoom | null>(null);
  const lkPublishModeRef = useRef<boolean | null>(null);
  const lkReconnectScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const mutedRef = useRef(false);
  const prevQueueStatusRef = useRef<string | undefined>(undefined);
  const prevLkConnRef = useRef<ConnectionState | null>(null);

  const [lkConnState, setLkConnState] = useState<ConnectionState | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const lkCbRef = useRef<{
    setLkConnState: (s: ConnectionState) => void;
    setAudioBlocked: (v: boolean) => void;
  }>({ setLkConnState: () => {}, setAudioBlocked: () => {} });
  lkCbRef.current.setLkConnState = setLkConnState;
  lkCbRef.current.setAudioBlocked = setAudioBlocked;

  const isHost        = !!me && !!mehfil && me === mehfil.hostId;
  const activeSpeaker = queue.find((q) => q.status === "speaking");
  const pendingQueue  = queue.filter((q) => q.status === "pending");
  const myEntry       = queue.find((q) => q.userId === me);
  const canPublishNow = isHost || myEntry?.status === "speaking";
  const listenerCount = presence.length;
  const activeSpeakerPresence = activeSpeaker
    ? presence.find((p) => p.user_id === activeSpeaker.userId)
    : null;
  /** Non-host voices in the room (for atmosphere — excludes host seat) */
  const gatheredVoices = presence.filter((p) => p.role !== "host").length;
  /** Avatars in the quiet circle — not host, not current stage speaker */
  const benchListeners = presence.filter((p) => {
    if (p.role === "host" || p.role === "speaker") return false;
    if (activeSpeaker && p.user_id === activeSpeaker.userId) return false;
    return true;
  });

  // ── Derived audio connection state ────────────────────────────────────────
  const lkConnecting = isLiveKitConfigured() && joined && (
    !lkConnState || lkConnState === ConnectionState.Connecting
  );
  const lkConnected = lkConnState === ConnectionState.Connected;
  const lkReconnecting = lkConnState === ConnectionState.Reconnecting;

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const st = myEntry?.status;
    if (st === "speaking" && prevQueueStatusRef.current !== "speaking") {
      toast.success("You're live — the room can hear you.", { duration: 2800 });
    }
    prevQueueStatusRef.current = st;
  }, [myEntry?.status]);

  // ── LiveKit: reconnect when publish permission must change (listener ↔ speaker) ──
  useEffect(() => {
    if (!joined || !me || !id || !isLiveKitConfigured()) return;
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
        const ctrl = await connectToMehfil(id, me, wantPublish, {
          onConnectionStateChange: (state) => cbs.setLkConnState(state),
          onParticipantCountChange: () => {},
          onError: (err) => {
            console.error("[LiveKit] reconnect error", err);
            logOpsEvent("livekit_reconnect_failed", { mehfil_id: id, message: err.message });
          },
          onAudioBlocked: () => cbs.setAudioBlocked(true),
          onReconnecting: () => toast("Reconnecting audio…", { duration: 1800 }),
          onReconnected: () => toast.success("Audio back online", { duration: 1600 }),
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
  }, [joined, isHost, myEntry?.status, id, me]);

  // ── Sync mute indicator with LiveKit after connect / role changes ──
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

  // ── Recover playback after tab resume / first Connected edge (mobile autoplay) ──
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

  // ── Extra audio prime after join (Safari / delayed subscriptions) ──
  useEffect(() => {
    if (!joined || !isLiveKitConfigured()) return;
    const t = window.setTimeout(() => {
      livekitRef.current?.enableAudio();
      void livekitRef.current?.room.startAudio().catch(() => {});
    }, 380);
    return () => clearTimeout(t);
  }, [joined]);

  // ── Presence: keep role in sync when moving listener ↔ speaker (Supabase presence payload) ──
  useEffect(() => {
    const ch = channelRef.current;
    if (!joined || !ch || !me || !myUser) return;
    const presenceRole: PresencePayload["role"] =
      isHost ? "host" : myEntry?.status === "speaking" ? "speaker" : "listener";
    void ch.track({
      user_id: me,
      display_name: myUser.displayName,
      avatar_url: myUser.avatarUrl ?? "",
      role: presenceRole,
    });
  }, [joined, me, myUser, isHost, myEntry?.status]);

  // ── Listener: host ended Mehfil remotely ──
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

  // ── Hooks ──
  const raiseHandMut  = useRaiseHand();
  const lowerHandMut  = useLowerHand();
  const approveEntry  = useApproveQueueEntry();
  const rejectEntry   = useRejectQueueEntry();
  const endTurnMut    = useEndSpeakerTurn();
  const endMehfilMut  = useEndMehfil();
  const startMehfilMut = useStartMehfil();

  // ── Join room ──
  const joinRoom = async () => {
    if (!me || !myUser || !mehfil) return;
    setJoined(true);
    if (me) earnInkPoints(me, 15).catch(console.warn);

    // ── LiveKit audio ─────────────────────────────────────────────────────────
    if (isLiveKitConfigured()) {
      const canPublish = isHost || myEntry?.status === "speaking";
      connectToMehfil(id, me, canPublish, {
        onConnectionStateChange: (state) => setLkConnState(state),
        onParticipantCountChange: (count) => {
          console.debug("[LiveKit] participants:", count);
        },
        onError: (err) => {
          console.error("[LiveKit] error", err);
          logOpsEvent("livekit_error", { mehfil_id: id, message: err.message });
          toast.error("Audio connection issue — retrying…", { duration: 3000 });
        },
        onAudioBlocked: () => {
          setAudioBlocked(true);
        },
        onReconnecting: () => {
          // lkConnState will be set to Reconnecting via onConnectionStateChange
          toast("Reconnecting to Mehfil audio…", { duration: 2000 });
        },
        onReconnected: () => {
          toast.success("Audio reconnected ✓", { duration: 1800 });
        },
      }).then((room) => {
        if (room) {
          livekitRef.current = room;
          lkPublishModeRef.current = canPublish;
        }
      });
    }

    const role: PresencePayload["role"] =
      isHost ? "host" : myEntry?.status === "speaking" ? "speaker" : "listener";
    const channel = supabase.channel(`mehfil:${id}`, {
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
      .on("presence", { event: "join" }, ({ newPresences }) => {
        // Also update full state on every join (eliminates stale/ghost entries)
        syncPresence();
        const p = newPresences[0] as unknown as PresencePayload | undefined;
        if (p && p.user_id !== me) {
          setChat((c) => [...c.slice(-60), {
            id: `sys${Date.now()}`,
            userId: "sys",
            name: "Room",
            text: `${p.display_name} joined`,
          }]);
        }
      })
      .on("presence", { event: "leave" }, () => {
        // Resync on every leave to remove ghost participants
        syncPresence();
      })
      .on("broadcast", { event: "chat" }, ({ payload }: { payload: ChatMsg }) => {
        setChat((c) => [...c.slice(-60), payload]);
        setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          user_id: me,
          display_name: myUser.displayName,
          avatar_url: myUser.avatarUrl ?? "",
          role,
        });
        trackEvent("mehfil_join", { mehfil_id: id });
      });

    channelRef.current = channel;
  };

  const leaveRoom = () => {
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
    endedRef.current = false;
    setLocation("/mehfil");
  };

  const closeReplayAndExit = () => {
    setReplaySheetOpen(false);
    setRoomEnded(false);
    endedRef.current = false;
    setLocation("/mehfil");
  };

  const finalizeHostEndMehfil = () => {
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
    endedRef.current = true;
    setJoined(false);
    setRoomEnded(true);
    setReplaySheetOpen(true);
    toast.success("Mehfil ended");
  };

  useEffect(() => {
    return () => {
      if (lkReconnectScheduledRef.current) {
        clearTimeout(lkReconnectScheduledRef.current);
        lkReconnectScheduledRef.current = null;
      }
      channelRef.current?.untrack();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      livekitRef.current?.disconnect();
      livekitRef.current = null;
      lkPublishModeRef.current = null;
    };
  }, []);

  const sendChat = () => {
    if (!draft.trim() || !channelRef.current || !me || !myUser) return;
    const msg: ChatMsg = {
      id: `m${Date.now()}`, userId: me,
      name: myUser.displayName, text: draft.trim(),
    };
    channelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    setChat((c) => [...c.slice(-60), msg]);
    setDraft("");
    setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
  };

  const buyTicket = async () => {
    if (!mehfil?.hostId || !mehfil.ticketPrice) return;
    setPayingTicket(true);
    try {
      await sendSupportAction(mehfil.hostId, "ticket", mehfil.ticketPrice, undefined, id);
      setHasTicket(true);
      joinRoom();
    } catch (e: any) {
      toast.error(e.message === "insufficient_balance" ? "Not enough balance" : "Could not join");
    } finally {
      setPayingTicket(false);
    }
  };

  // ── Loading ──
  if (isLoading || !mehfil) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "#1A0F14" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#E8B14A", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // ── Host: save / publish replay ──
  if (roomEnded && replaySheetOpen && isHost) {
    return (
      <AnimatePresence>
        <MehfilReplaySheet
          key="replay-sheet"
          mehfilId={id}
          defaultTitle={mehfil.title}
          onClose={closeReplayAndExit}
        />
      </AnimatePresence>
    );
  }

  // ── Session ended ──
  if (roomEnded) {
    const replayPid = publishedReplay?.postId;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center" style={{ background: "#1A0F14", color: "#F5F3EF" }}>
        <div className="text-[10px] tracking-[0.35em] uppercase mb-4 font-['Inter']" style={{ color: "rgba(232,177,74,0.65)" }}>Gathering closed</div>
        <div className="font-['Playfair_Display'] text-[26px] leading-tight mb-3">{mehfil.title}</div>
        <div className="text-[13px] mb-10 font-['Inter'] max-w-xs leading-relaxed" style={{ color: "rgba(245,243,239,0.45)" }}>
          The voices soften — what stays is what we choose to keep.
        </div>
        {replayPid ? (
          <Link href={`/post/${replayPid}`}
            className="px-8 py-3.5 rounded-full text-[14px] font-['Inter'] font-medium mb-4"
            style={{ background: "linear-gradient(135deg,#E8B14A,#F76A4A)", color: "#1A0F14" }}>
            Listen to replay
          </Link>
        ) : (
          <div className="text-[12px] italic mb-6 font-['Playfair_Display']" style={{ color: "rgba(245,243,239,0.35)" }}>
            No replay here yet — perhaps the host will leave one behind.
          </div>
        )}
        <button type="button" onClick={() => setLocation("/mehfil")}
          className="text-[13px] font-['Inter'] mt-2" style={{ color: "rgba(245,243,239,0.45)" }}>
          ← Back to Mehfils
        </button>
      </div>
    );
  }

  // ── Ticketed paywall ──
  const needsTicket = !isHost && (mehfil.isTicketed ?? false) && (mehfil.ticketPrice ?? 0) > 0 && !hasTicket;
  if (needsTicket && !joined) {
    return (
      <TicketPaywall mehfil={mehfil} host={host}
        onPay={buyTicket} onLeave={() => setLocation("/mehfil")} paying={payingTicket} />
    );
  }

  // ── Pre-join screen ──
  if (!joined) {
    return (
      <div className="min-h-[100dvh] flex flex-col" style={{ background: "#1A0F14", color: "#F5F3EF" }}>
        <style>{`
          @keyframes mh-pulse { 0%,100%{transform:scale(0.95);opacity:.7} 70%{transform:scale(1.5);opacity:0} }
          @keyframes mh-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes mh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes mh-glow  { 0%,100%{opacity:.4} 50%{opacity:.9} }
        `}</style>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full opacity-25"
            style={{ background: "radial-gradient(circle,#F76A4A,transparent 70%)", filter: "blur(40px)", animation: "mh-glow 4s ease-in-out infinite" }} />
        </div>

        <div className="px-6 py-5 flex items-center">
          <button onClick={() => setLocation("/mehfil")} className="text-[13px]"
            style={{ color: "rgba(245,243,239,0.60)" }}>← Back</button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-5">
          {/* Host avatar */}
          <div className="relative w-[160px] h-[160px] flex items-center justify-center">
            {mehfil.isLive && (
              <div className="absolute w-[140px] h-[140px] rounded-full border-2 border-[#F76A4A]"
                style={{ animation: "mh-pulse 2.5s ease-out infinite" }} />
            )}
            <div className="absolute w-[120px] h-[120px] rounded-full p-[2px]"
              style={{ background: "conic-gradient(from 0deg,#F76A4A,#E8B14A,#B14A8B,#6A5AE0,#F76A4A)", animation: "mh-spin 7s linear infinite" }}>
              <div className="w-full h-full rounded-full" style={{ background: "#1A0F14" }} />
            </div>
            <div className="relative w-[80px] h-[80px] rounded-full z-10 overflow-hidden border-2"
              style={{ borderColor: "rgba(245,243,239,0.2)", animation: "mh-float 4s ease-in-out infinite" }}>
              <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: "rgba(232,177,74,0.65)" }}>
              {mehfil.isLive ? "Live Now" : "Upcoming"}
            </div>
            <div className="font-['Playfair_Display'] text-[24px] leading-tight mb-1">{mehfil.title}</div>
            <div className="text-[13px]" style={{ color: "rgba(245,243,239,0.55)" }}>
              by {host?.displayName ?? "Host"}
            </div>
            {mehfil.description && (
              <div className="text-[12px] mt-3 leading-[1.6]"
                style={{ color: "rgba(245,243,239,0.38)" }}>
                {mehfil.description}
              </div>
            )}
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={joinRoom}
            className="px-10 py-3.5 rounded-full text-[15px] font-['Inter'] font-medium"
            style={{
              background: mehfil.isLive
                ? "linear-gradient(135deg,#E8B14A,#F76A4A)"
                : "rgba(255,255,255,0.10)",
              color: mehfil.isLive ? "#1A0F14" : "#F5F3EF",
              boxShadow: mehfil.isLive ? "0 8px 28px rgba(232,177,74,0.30)" : "none",
            }}>
            {mehfil.isLive ? "Enter Mehfil" : "Set Reminder"}
          </motion.button>

          {listenerCount > 0 && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(245,243,239,0.40)" }}>
              <Users size={12} />
              {listenerCount} {listenerCount === 1 ? "listener" : "listeners"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main room ──────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{ background: "#1A0F14", color: "#F5F3EF" }}
    >
      <style>{`
        @keyframes mh-pulse { 0%,100%{transform:scale(0.95);opacity:.7} 70%{transform:scale(1.5);opacity:0} }
        @keyframes mh-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes mh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes mh-glow  { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes speak-ring { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.2);opacity:0} }
      `}</style>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle,#F76A4A,transparent 70%)", filter: "blur(50px)", animation: "mh-glow 5s ease-in-out infinite" }} />
        <div className="absolute bottom-0 -left-20 w-[220px] h-[220px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle,#E8B14A,transparent 70%)", filter: "blur(50px)" }} />
      </div>

      {/* ── Connection state banners ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {audioBlocked && (
          <motion.button key="audio-blocked"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            onClick={() => { livekitRef.current?.enableAudio(); setAudioBlocked(false); }}
            className="relative z-50 mx-5 mt-2 rounded-2xl flex items-center justify-center gap-2 py-2.5 px-4 text-[12px] font-['Inter'] font-medium"
            style={{ background: "rgba(232,177,74,0.14)", border: "1px solid rgba(232,177,74,0.30)", color: "#E8B14A" }}
          >
            <Mic size={13} /> Tap to enable audio
          </motion.button>
        )}
        {!audioBlocked && lkConnecting && (
          <motion.div key="connecting"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="relative z-50 mx-5 mt-2 rounded-2xl flex items-center justify-center gap-2 py-2 px-4 text-[11px] font-['Inter']"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(245,243,239,0.55)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Connecting audio…
          </motion.div>
        )}
        {!audioBlocked && lkReconnecting && (
          <motion.div key="reconnecting"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="relative z-50 mx-5 mt-2 rounded-2xl flex items-center justify-center gap-2 py-2 px-4 text-[11px] font-['Inter']"
            style={{ background: "rgba(247,106,74,0.10)", border: "1px solid rgba(247,106,74,0.22)", color: "#F76A4A" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Reconnecting…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="relative z-10 px-5 pt-10 pb-3 flex items-center justify-between">
        <button onClick={leaveRoom}
          className="text-[13px] font-['Inter'] px-3 py-1.5 rounded-full"
          style={{ color: "rgba(245,243,239,0.65)", background: "rgba(255,255,255,0.08)" }}>
          Leave
        </button>

        <div className="flex items-center gap-1.5 text-[10px] font-['Inter'] tracking-[0.18em] uppercase
          rounded-full px-3 py-1.5 font-semibold"
          style={{ background: mehfil.isLive ? "linear-gradient(135deg,#F76A4A,#C04A3F)" : "rgba(255,255,255,0.10)" }}>
          {mehfil.isLive && (
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-white" />
              <div className="absolute inset-0 rounded-full bg-white"
                style={{ animation: "mh-pulse 1.5s ease-out infinite" }} />
            </div>
          )}
          {mehfil.isLive ? "LIVE" : "UPCOMING"}
          {/* Audio ready dot — only when LiveKit is configured and joined */}
          {isLiveKitConfigured() && joined && (
            <span className="w-1.5 h-1.5 rounded-full ml-0.5"
              style={{ background: lkConnected ? "#6BE89E" : lkReconnecting ? "#E8B14A" : "rgba(255,255,255,0.3)" }} />
          )}
        </div>

        {isHost ? (
          <div className="relative">
            <button onClick={() => setHostMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.10)" }}>
              <Settings size={14} style={{ color: "rgba(245,243,239,0.65)" }} />
            </button>
            <AnimatePresence>
              {hostMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  className="absolute top-10 right-0 w-48 rounded-2xl overflow-hidden z-20"
                  style={{ background: "#2A1A20", border: "1px solid rgba(255,255,255,0.10)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!mehfil.isLive && (
                    <button onClick={() => { startMehfilMut.mutate(id); setHostMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-['Inter']"
                      style={{ color: "#E8B14A" }}>
                      <Radio size={14} /> Go Live
                    </button>
                  )}
                  {activeSpeaker && (
                    <button onClick={() => { endTurnMut.mutate(id); setHostMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-['Inter']"
                      style={{ color: "rgba(245,243,239,0.75)" }}>
                      <MicOff size={14} /> End speaker turn
                    </button>
                  )}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
                  <button onClick={() => {
                    endMehfilMut.mutate(id, { onSuccess: () => { setHostMenuOpen(false); finalizeHostEndMehfil(); } });
                  }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-['Inter']"
                    style={{ color: "#F76A4A" }}>
                    <X size={14} /> End Mehfil
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Stage section */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-2 pb-4">
        <div className="text-[9px] font-['Inter'] tracking-[0.4em] uppercase flex items-center gap-3 mb-4"
          style={{ color: "rgba(232,177,74,0.65)" }}>
          <span className="w-6 h-px" style={{ background: "rgba(232,177,74,0.40)" }} />
          MEHFIL
          <span className="w-6 h-px" style={{ background: "rgba(232,177,74,0.40)" }} />
        </div>

        {/* Host avatar */}
        <div className="relative w-[150px] h-[150px] flex items-center justify-center mb-3">
          {mehfil.isLive && (
            <div className="absolute w-[130px] h-[130px] rounded-full border-2 border-[#F76A4A]"
              style={{ animation: "mh-pulse 2.5s ease-out infinite" }} />
          )}
          <div className="absolute w-[112px] h-[112px] rounded-full p-[2px]"
            style={{ background: "conic-gradient(from 0deg,#F76A4A,#E8B14A,#B14A8B,#6A5AE0,#F76A4A)", animation: "mh-spin 7s linear infinite" }}>
            <div className="w-full h-full rounded-full" style={{ background: "#1A0F14" }} />
          </div>
          <div className="relative w-[72px] h-[72px] rounded-full z-10 overflow-hidden border-[2px]"
            style={{ borderColor: "rgba(245,243,239,0.2)", animation: "mh-float 4s ease-in-out infinite" }}>
            <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center z-20"
            style={{ background: "#E8B14A" }}>
            <Crown size={10} color="#1A0F14" />
          </div>
        </div>

        <div className="text-[22px] font-['Playfair_Display'] text-center">
          {host?.displayName ?? "Host"}
        </div>
        <div className="text-[13px] italic mt-0.5 text-center"
          style={{ color: "rgba(245,243,239,0.55)" }}>
          {mehfil.title}
        </div>

        {activeSpeaker && activeSpeaker.userId === mehfil.hostId && mehfil.isLive && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-3 py-1 rounded-full text-[10px] font-['Inter'] uppercase tracking-[0.2em]"
            style={{ background: "rgba(107,232,158,0.14)", border: "1px solid rgba(107,232,158,0.35)", color: "#8FFFCF" }}>
            Hosting aloud
          </motion.div>
        )}

        {mehfil.isLive && (
          <div className="flex items-center gap-3 mt-3">
            <AudioBars active={canPublishNow ? !muted : !!activeSpeaker} />
            <div className="text-[11px] font-['Inter'] flex items-center gap-1.5"
              style={{ color: "rgba(245,243,239,0.60)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#6BE89E" }} />
              <span style={{ color: "#6BE89E", fontWeight: 600 }}>{gatheredVoices}</span> gathered
            </div>
          </div>
        )}

        {/* Active speaker (if different from host) — queue-backed; presence may lag briefly */}
        <AnimatePresence mode="wait">
          {activeSpeaker && activeSpeaker.userId !== mehfil.hostId && (
            <ActiveSpeakerStrip
              key={activeSpeaker.userId}
              speakerUserId={activeSpeaker.userId}
              presenceRow={activeSpeakerPresence ?? undefined}
            />
          )}
        </AnimatePresence>

        {/* Listener avatars — calm bench (no duplicate stage face) */}
        {benchListeners.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <AvatarStack users={benchListeners} max={7} />
            <span className="text-[10px]" style={{ color: "rgba(245,243,239,0.35)" }}>in the circle</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="relative z-10 flex border-b mx-5"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(["chat", "people", "queue"] as const).map((t) => {
          const label = t === "chat" ? "Chat" : t === "people" ? `People · ${listenerCount}` : `Queue · ${pendingQueue.length}`;
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-['Inter'] transition-colors relative ${
                active ? "font-medium" : ""
              }`}
              style={{ color: active ? "#E8B14A" : "rgba(245,243,239,0.40)" }}>
              {label}
              {active && (
                <motion.div layoutId="mehfil-room-tab"
                  className="absolute bottom-0 left-3 right-3 h-[1.5px] rounded-full"
                  style={{ background: "#E8B14A" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 mx-4 mt-3">

        {/* Chat tab */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div ref={chatRef}
              className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 no-scrollbar"
              style={{ maxHeight: "calc(100dvh - 430px)" }}>
              {chat.length === 0 && (
                <div className="flex items-center justify-center h-16 text-[12px]"
                  style={{ color: "rgba(245,243,239,0.25)" }}>
                  Be the first to say something…
                </div>
              )}
              {chat.map((m) => (
                <div key={m.id} className="text-[12px] font-['Inter']">
                  {m.userId === "sys" ? (
                    <span style={{ color: "rgba(245,243,239,0.30)" }} className="italic text-[11px]">
                      {m.text}
                    </span>
                  ) : (
                    <>
                      <span className="font-medium mr-1.5" style={{ color: m.userId === me ? "#6BE89E" : "#E8B14A" }}>
                        {m.name}
                      </span>
                      <span style={{ color: "rgba(245,243,239,0.80)" }}>{m.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Say something…"
                className="flex-1 rounded-full px-3 py-1.5 text-[12px] outline-none"
                style={{ background: "rgba(255,255,255,0.09)", color: "#F5F3EF" }} />
              <button onClick={sendChat}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#E8B14A" }}>
                <Send size={12} color="#1A0F14" />
              </button>
            </div>
          </div>
        )}

        {/* People tab */}
        {tab === "people" && (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2"
            style={{ maxHeight: "calc(100dvh - 430px)" }}>
            {presence.length === 0 && (
              <div className="text-center py-8 text-[12px]"
                style={{ color: "rgba(245,243,239,0.30)" }}>No listeners yet</div>
            )}
            {presence.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[13px]"
                        style={{ background: "rgba(201,168,76,0.2)", color: "#C9A84C" }}>
                        {p.display_name.charAt(0)}
                      </div>}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-['Inter']">{p.display_name}</div>
                  <div className="text-[10px] capitalize" style={{ color: "rgba(245,243,239,0.35)" }}>
                    {p.role}
                  </div>
                </div>
                {p.role === "host" && <Crown size={13} style={{ color: "#E8B14A" }} />}
                {p.role === "speaker" && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "#6BE89E" }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Queue tab */}
        {tab === "queue" && (
          <div className="flex-1 overflow-y-auto no-scrollbar"
            style={{ maxHeight: "calc(100dvh - 430px)" }}>
            {/* Host: approve/reject queue */}
            {isHost && pendingQueue.length > 0 && (
              <div className="space-y-2">
                <div className="text-[9px] tracking-[0.22em] uppercase px-1 mb-2"
                  style={{ color: "rgba(232,177,74,0.55)" }}>
                  Waiting to speak
                </div>
                {pendingQueue.map((entry) => {
                  const p = presence.find((pr) => pr.user_id === entry.userId);
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"
                        style={{ background: "rgba(201,168,76,0.2)" }}>
                        {p?.avatar_url && <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 text-[13px] font-['Inter']">
                        {p?.display_name ?? "Listener"}
                      </div>
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.93 }}
                          onClick={() => approveEntry.mutate(entry.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(107,232,158,0.15)", border: "1px solid rgba(107,232,158,0.35)" }}>
                          <CheckCircle size={15} style={{ color: "#6BE89E" }} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.93 }}
                          onClick={() => rejectEntry.mutate(entry.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(247,106,74,0.12)", border: "1px solid rgba(247,106,74,0.30)" }}>
                          <XCircle size={15} style={{ color: "#F76A4A" }} />
                        </motion.button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isHost && pendingQueue.length === 0 && (
              <div className="text-center py-8 text-[12px]"
                style={{ color: "rgba(245,243,239,0.28)" }}>
                No hands raised yet
              </div>
            )}

            {!isHost && (
              <div className="flex flex-col items-center gap-4 py-6">
                {myEntry?.status === "pending" ? (
                  <>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(232,177,74,0.15)", border: "1px solid rgba(232,177,74,0.35)" }}>
                      <Hand size={20} style={{ color: "#E8B14A" }} />
                    </div>
                    <div className="text-[13px] font-['Playfair_Display'] italic"
                      style={{ color: "#E8B14A" }}>
                      Hand raised — waiting for host
                    </div>
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => lowerHandMut.mutate(id)}
                      className="px-5 py-2 rounded-full text-[12px] font-['Inter']"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,243,239,0.60)" }}>
                      Lower hand
                    </motion.button>
                  </>
                ) : myEntry?.status === "speaking" ? (
                  <SpeakerActiveView
                    muted={muted}
                    onToggleMute={async () => {
                      const newMuted = !muted;
                      setMuted(newMuted);
                      if (livekitRef.current) {
                        await livekitRef.current.setMicEnabled(!newMuted);
                      } else {
                        toast("Audio not connected — check LiveKit config");
                      }
                    }}
                  />
                ) : (
                  <>
                    <div className="text-[12px] text-center" style={{ color: "rgba(245,243,239,0.38)" }}>
                      Want to speak? Raise your hand and the host will invite you.
                    </div>
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => raiseHandMut.mutate(id)}
                      disabled={raiseHandMut.isPending}
                      className="flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-['Inter'] font-medium"
                      style={{
                        background: "rgba(232,177,74,0.14)",
                        border: "1px solid rgba(232,177,74,0.40)",
                        color: "#E8B14A",
                      }}>
                      <Hand size={15} />
                      Raise Hand
                    </motion.button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="relative z-10 px-5 pt-3 pb-8 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Chai support */}
        <motion.button whileTap={{ scale: 0.93 }}
          onClick={() => setSupportOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-['Inter']"
          style={{
            background: "rgba(201,168,76,0.12)",
            border: "1px solid rgba(201,168,76,0.28)",
            color: "#C9A84C",
          }}>
          ☕ <span>Chai</span>
        </motion.button>

        {/* Mute toggle — wired to LiveKit when connected */}
        <motion.button whileTap={{ scale: 0.93 }}
          onClick={async () => {
            const newMuted = !muted;
            setMuted(newMuted);
            if (livekitRef.current) {
              // Mic enabled = NOT muted
              await livekitRef.current.setMicEnabled(!newMuted);
            }
          }}
          className="w-12 h-12 rounded-full flex items-center justify-center relative"
          style={{
            background: muted ? "rgba(247,106,74,0.15)" : "rgba(255,255,255,0.09)",
            border: muted ? "1px solid rgba(247,106,74,0.35)" : "1px solid rgba(255,255,255,0.12)",
          }}>
          {muted
            ? <MicOff size={18} style={{ color: "#F76A4A" }} />
            : <Mic size={18} style={{ color: "rgba(245,243,239,0.70)" }} />}
          {/* LiveKit connection status dot */}
          {lkConnState && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#1A0F14]"
              style={{ background: lkConnState === ConnectionState.Connected ? "#6BE89E" : lkConnState === ConnectionState.Reconnecting ? "#E8B14A" : "#888" }} />
          )}
        </motion.button>

        {/* Queue / raise hand */}
        {!isHost && (
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={() => setTab("queue")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-['Inter'] relative"
            style={{
              background: myEntry?.status === "pending" ? "rgba(232,177,74,0.14)" : "rgba(255,255,255,0.07)",
              border: myEntry?.status === "pending" ? "1px solid rgba(232,177,74,0.40)" : "1px solid rgba(255,255,255,0.10)",
              color: myEntry?.status === "pending" ? "#E8B14A" : "rgba(245,243,239,0.60)",
            }}>
            <Hand size={14} />
            <span>{myEntry?.status === "pending" ? "Waiting…" : "Speak"}</span>
          </motion.button>
        )}

        {isHost && (
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={() => setTab("queue")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-['Inter'] relative"
            style={{
              background: pendingQueue.length > 0 ? "rgba(232,177,74,0.14)" : "rgba(255,255,255,0.07)",
              border: pendingQueue.length > 0 ? "1px solid rgba(232,177,74,0.40)" : "1px solid rgba(255,255,255,0.10)",
              color: pendingQueue.length > 0 ? "#E8B14A" : "rgba(245,243,239,0.60)",
            }}>
            <Users size={14} />
            <span>Queue</span>
            {pendingQueue.length > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
                style={{ background: "#E8B14A", color: "#1A0F14" }}>
                {pendingQueue.length}
              </span>
            )}
          </motion.button>
        )}
      </div>

      {/* Support sheet */}
      <AnimatePresence>
        {supportOpen && mehfil.hostId && (
          <SupportSheet
            toUserId={mehfil.hostId}
            toUserName={host?.displayName ?? "Host"}
            mehfilId={id}
            onClose={() => setSupportOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
