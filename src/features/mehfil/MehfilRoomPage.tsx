/**
 * Mehfil — rebuilt shell: audio-first, minimal chrome, calm gathering atmosphere.
 */
import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTitle } from "@/hooks/useTitle";
import {
  useMehfilRoom,
  useUser,
  getCurrentUserId,
  useMehfilRealtime,
  useMehfilQueue,
  useMehfilQueueRealtime,
  useRaiseHand,
  useLowerHand,
  useApproveQueueEntry,
  useRejectQueueEntry,
  useEndSpeakerTurn,
  useEndMehfil,
  useStartMehfil,
  usePublishedMehfilReplay,
  useHostInviteSpeaker,
  useHostRemoveFromStage,
  type QueueEntry,
  startMehfilRecording,
  stopMehfilRecording,
} from "@/lib/store";
import MehfilReplaySheet from "@/components/MehfilReplaySheet";
import SupportSheet from "@/components/SupportSheet";
import {
  Mic, MicOff, Send, Hand, Settings, X, CheckCircle, XCircle, Radio, Users,
  UserPlus, Video, VideoOff, Coffee,
} from "lucide-react";
import { isLiveKitConfigured } from "@/lib/livekit";
import { OVERLAY_FADE, PAGE_ENTER, SHEET_SPRING } from "@/lib/motionTokens";
import {
  useMehfilRoomSession,
  type PresencePayload,
  type ChatMsg,
} from "@/features/mehfil/useMehfilRoomSession";

const BG = "#0a0609";
const FG = "#f5f3ef";
const GOLD = "#c9a84c";
const MINT = "#8fffdf";

function supportKindLabel(kind: string) {
  if (kind === "chai") return "Chai";
  if (kind === "rose") return "Rose";
  if (kind === "applaud") return "Applause";
  if (kind === "support") return "Support";
  return kind;
}

function AvatarStack({ users, max = 7 }: { users: PresencePayload[]; max?: number }) {
  const visible = users.slice(0, max);
  const extra = users.length - max;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div
          key={u.user_id}
          className="w-8 h-8 rounded-full border-2 overflow-hidden shrink-0"
          style={{ borderColor: BG, marginLeft: i > 0 ? -10 : 0, zIndex: max - i }}
        >
          {u.avatar_url ? (
            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[10px] font-medium"
              style={{ background: "rgba(201,168,76,0.25)", color: GOLD }}
            >
              {u.display_name.charAt(0)}
            </div>
          )}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px]"
          style={{ borderColor: BG, marginLeft: -10, background: "rgba(255,255,255,0.08)", color: "rgba(245,243,239,0.65)" }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function WaveOrb({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-11 px-1">
      {Array.from({ length: 16 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[2.5px] rounded-full"
          style={{ background: active ? GOLD : "rgba(201,168,76,0.12)" }}
          animate={{ height: active ? [6, 26, 9, 22, 14][i % 5] : 4 }}
          transition={{ duration: 0.62 + (i % 5) * 0.05, repeat: Infinity, repeatType: "mirror", delay: i * 0.045 }}
        />
      ))}
    </div>
  );
}

function PendingHandRow({
  entry,
  isHost,
  presenceRow,
  onApprove,
  onReject,
}: {
  entry: QueueEntry;
  isHost: boolean;
  presenceRow?: PresencePayload;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { data: u } = useUser(entry.userId);
  const name = presenceRow?.display_name ?? u?.displayName ?? "Guest";
  const avatar = presenceRow?.avatar_url ?? u?.avatarUrl ?? "";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/[0.035] border border-white/[0.07]"
    >
      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-1 ring-white/12">
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-medium bg-white/[0.06]">{name.charAt(0)}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-35 font-['Inter']">Raised hand</div>
        <div className="text-[14px] truncate font-['Playfair_Display']">{name}</div>
      </div>
      {isHost && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={onApprove} className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-500/14 border border-emerald-400/35" aria-label="Approve">
            <CheckCircle size={16} className="text-emerald-300" />
          </button>
          <button type="button" onClick={onReject} className="w-9 h-9 rounded-full flex items-center justify-center bg-rose-500/14 border border-rose-400/35" aria-label="Decline">
            <XCircle size={15} className="text-rose-300" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function StageSpeaker({ userId, row }: { userId: string; row?: PresencePayload }) {
  const { data: u } = useUser(userId);
  const name = row?.display_name ?? u?.displayName ?? "Speaker";
  const avatar = row?.avatar_url ?? u?.avatarUrl ?? "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mt-7 px-5 py-4 rounded-[26px] flex items-center gap-4 overflow-hidden"
      style={{
        border: "1px solid rgba(143,255,223,0.12)",
        background: "linear-gradient(135deg, rgba(143,255,223,0.06), rgba(255,255,255,0.02))",
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[26px]"
        animate={{ opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          boxShadow: "inset 0 0 42px rgba(143,255,223,0.07)",
        }}
      />
      <div className="relative w-[52px] h-[52px] rounded-full overflow-hidden shrink-0 ring-2 ring-[rgba(143,255,223,0.38)]">
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full flex items-center justify-center text-sm" style={{ background: "rgba(143,255,223,0.12)", color: MINT }}>{name.charAt(0)}</div>
        )}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-[0.24em] font-['Inter'] font-semibold" style={{ color: MINT }}>Speaking</div>
        <div className="font-['Playfair_Display'] text-[17px] truncate text-white">{name}</div>
      </div>
      <div className="relative">
        <WaveOrb active />
      </div>
    </motion.div>
  );
}

function TicketGate({
  mehfil, host, onPay, onLeave, paying,
}: { mehfil: { title: string; ticketPrice?: number }; host: { displayName?: string; avatarUrl?: string } | null | undefined; onPay: () => void; onLeave: () => void; paying: boolean }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center" style={{ background: BG, color: FG }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(ellipse at top, rgba(247,106,74,0.14), transparent 55%)" }} />
      {host?.avatarUrl && (
        <div className="w-[72px] h-[72px] rounded-full overflow-hidden mb-5 ring-2 ring-white/10">
          <img src={host.avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <p className="text-[10px] tracking-[0.28em] uppercase mb-2 font-['Inter']" style={{ color: "rgba(201,168,76,0.75)" }}>Gathering</p>
      <h1 className="font-['Playfair_Display'] text-[26px] leading-tight mb-2">{mehfil.title}</h1>
      <p className="text-[13px] mb-10 font-['Inter']" style={{ color: "rgba(245,243,239,0.45)" }}>
        {host?.displayName ? <>Hosted by {host.displayName}. </> : null}
        A quiet contribution opens the room.
      </p>
      <motion.button type="button" whileTap={{ scale: 0.98 }} disabled={paying} onClick={onPay}
        className="w-full max-w-xs py-3.5 rounded-full text-[14px] font-['Inter'] font-medium mb-4"
        style={{ background: `linear-gradient(135deg, ${GOLD}, #e08055)`, color: BG }}>
        {paying ? "…" : `Enter · ₹${mehfil.ticketPrice ?? 0}`}
      </motion.button>
      <button type="button" onClick={onLeave} className="text-[12px] font-['Inter']" style={{ color: "rgba(245,243,239,0.35)" }}>Leave</button>
    </div>
  );
}

export default function MehfilRoomPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();
  const navigateOut = () => setLocation("/mehfil");

  const { data: mehfil, isLoading } = useMehfilRoom(id);
  const { data: host } = useUser(mehfil?.hostId ?? "");
  const me = getCurrentUserId();

  useTitle(mehfil?.title ?? "Mehfil");
  useMehfilRealtime(id);
  useMehfilQueueRealtime(id);
  const { data: queue = [] } = useMehfilQueue(id);
  const { data: publishedReplay } = usePublishedMehfilReplay(id);

  const session = useMehfilRoomSession(id, mehfil, queue, navigateOut);

  const needsTicket =
    !!mehfil &&
    !session.isHost &&
    (mehfil.isTicketed ?? false) &&
    (mehfil.ticketPrice ?? 0) > 0 &&
    !session.hasTicket;

  /* Single gate from lobby → joined room whenever DB marks live (host resume + follower deep-link). */
  useEffect(() => {
    if (!mehfil || session.joined || session.roomEnded) return;
    if (!mehfil.isLive || needsTicket) return;
    void session.joinRoom();
  }, [mehfil, session.joined, session.roomEnded, needsTicket, session.joinRoom]);

  const recordingStartedRef = useRef(false);
  const localVidRef = useRef<HTMLDivElement>(null);
  const remoteVidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mehfil?.isLive) recordingStartedRef.current = false;
  }, [mehfil?.isLive]);

  useEffect(() => {
    if (!session.isHost || !mehfil?.isLive || !session.lkConnected || !isLiveKitConfigured()) return;
    if (recordingStartedRef.current) return;
    recordingStartedRef.current = true;
    void startMehfilRecording(id).then((res) => {
      if (!res.ok) {
        toast.message(`Recording couldn’t start (${res.error ?? "egress"}). Check LiveKit egress + S3 env.`, { duration: 7000 });
      }
    });
  }, [session.isHost, mehfil?.isLive, session.lkConnected, id]);

  useEffect(() => {
    if (session.isHost && session.supportOpen) session.setSupportOpen(false);
  }, [session.isHost, session.supportOpen, session.setSupportOpen]);

  useEffect(() => {
    if (!session.joined || !session.studio) return;
    let cancelled = false;
    const bind = () => {
      if (cancelled) return;
      const local = session.isHost ? localVidRef.current : null;
      const remote = session.isHost ? null : remoteVidRef.current;
      session.bindLiveKitVideo(local, remote);
    };
    const rafId = requestAnimationFrame(() => {
      bind();
      requestAnimationFrame(bind);
    });
    const lateId = window.setTimeout(bind, 150);
    const lateId2 = window.setTimeout(bind, 480);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(lateId);
      clearTimeout(lateId2);
    };
  }, [
    session.joined,
    session.lkConnected,
    session.lkRoomReady,
    session.bindLiveKitVideo,
    session.studio,
    session.hostCameraOn,
    session.isHost,
  ]);

  const raiseHandMut = useRaiseHand();
  const lowerHandMut = useLowerHand();
  const approveEntry = useApproveQueueEntry();
  const rejectEntry = useRejectQueueEntry();
  const endTurnMut = useEndSpeakerTurn();
  const endMehfilMut = useEndMehfil();
  const startMehfilMut = useStartMehfil();
  const hostInviteMut = useHostInviteSpeaker();
  const hostRemoveMut = useHostRemoveFromStage();

  const handleLeave = () => {
    if (session.isHost && mehfil.isLive) {
      void stopMehfilRecording(id);
      endMehfilMut.mutate(id, {
        onSuccess: () => session.leaveRoom(),
        onError: (err: Error) => toast.error(err.message || "Could not end session"),
      });
    } else {
      session.leaveRoom();
    }
  };

  const [dock, setDock] = useState<"chat" | "stage">("chat");
  const [participantsOpen, setParticipantsOpen] = useState(false);

  if (isLoading || !mehfil) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: BG }}>
        <motion.div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: GOLD, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (session.roomEnded && session.replaySheetOpen && session.isHost) {
    return (
      <AnimatePresence>
        <MehfilReplaySheet mehfilId={id} defaultTitle={mehfil.title} onClose={session.closeReplayAndExit} />
      </AnimatePresence>
    );
  }

  if (session.roomEnded) {
    const replayPid = publishedReplay?.postId;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center font-['Inter']" style={{ background: BG, color: FG }}>
        <p className="text-[10px] tracking-[0.32em] uppercase mb-4" style={{ color: "rgba(232,177,74,0.6)" }}>Ended</p>
        <h2 className="font-['Playfair_Display'] text-[24px] mb-3">{mehfil.title}</h2>
        <p className="text-[13px] mb-10 max-w-xs leading-relaxed" style={{ color: "rgba(245,243,239,0.4)" }}>The voices rest — what stays is yours to keep.</p>
        {replayPid ? (
          <Link href={`/post/${replayPid}`} className="px-8 py-3 rounded-full text-[14px] font-medium mb-6" style={{ background: `linear-gradient(135deg,${GOLD},#f76a4a)`, color: BG }}>Listen again</Link>
        ) : null}
        <button type="button" onClick={navigateOut} className="text-[13px]" style={{ color: "rgba(245,243,239,0.4)" }}>← Back</button>
      </div>
    );
  }

  if (needsTicket && !session.joined) {
    return <TicketGate mehfil={mehfil} host={host} onPay={session.buyTicket} onLeave={navigateOut} paying={session.payingTicket} />;
  }

  if (!session.joined && mehfil.isLive && !session.roomEnded) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 gap-5 font-['Inter']" style={{ background: BG, color: FG }}>
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${GOLD}55`, borderTopColor: "transparent" }}
        />
        <p className="text-[13px] text-center leading-relaxed" style={{ color: "rgba(245,243,239,0.42)" }}>
          Joining the gathering…
        </p>
      </div>
    );
  }

  if (!session.joined) {
    const dbLive = mehfil.isLive;
    const phaseLabel = session.isHost ? (dbLive ? "Live" : "Scheduled") : dbLive ? "Live" : "Scheduled";
    const pulseLive = dbLive;

    return (
      <div className="min-h-[100dvh] flex flex-col px-6 pb-12 font-['Inter']" style={{ background: BG, color: FG }}>
        <div className="pt-12 pb-8 flex justify-between items-center">
          <button type="button" onClick={navigateOut} className="text-[13px]" style={{ color: "rgba(245,243,239,0.5)" }}>←</button>
          <span
            className="text-[10px] tracking-[0.25em] uppercase font-semibold"
            style={{
              color: pulseLive ? "rgba(143,255,223,0.88)" : "rgba(232,177,74,0.55)",
            }}
          >
            {phaseLabel}
          </span>
          <span className="w-8" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="relative w-[140px] h-[140px] flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full opacity-[0.38]"
              style={{
                background: "radial-gradient(circle at 50% 45%, rgba(201,168,76,0.4), transparent 62%)",
                filter: "blur(20px)",
              }}
            />
            {session.isHost ? (
              <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden ring-1 ring-white/15">
                {(host?.avatarUrl || mehfil.coverUrl) ? (
                  <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg bg-white/[0.06]">{mehfil.title.charAt(0)}</div>
                )}
              </div>
            ) : (
              <div className="relative w-[92px] h-[92px] rounded-full flex items-center justify-center border border-white/[0.12] bg-white/[0.04] backdrop-blur-sm">
                <Radio size={28} style={{ color: GOLD, opacity: 0.85 }} />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-['Playfair_Display'] text-[28px] leading-tight mb-2">{mehfil.title}</h1>
            <p className="text-[13px]" style={{ color: "rgba(245,243,239,0.45)" }}>{host?.displayName ?? "Host"}</p>
          </div>
          {session.isHost ? (
            <motion.button
              type="button"
              whileTap={{ scale: startMehfilMut.isPending ? 1 : 0.97 }}
              disabled={startMehfilMut.isPending}
              onClick={() => {
                void session.startHostMehfilLive(async (mehfilId) => {
                  await new Promise<void>((resolve, reject) => {
                    startMehfilMut.mutate(mehfilId, {
                      onSuccess: () => resolve(),
                      onError: (err: Error) => reject(err),
                    });
                  });
                }).catch((err: Error) => toast.error(err.message || "Could not start"));
              }}
              className="px-12 py-3.5 rounded-full text-[15px] font-semibold border border-white/[0.14]"
              style={{
                background: `linear-gradient(135deg,${GOLD},#e08055)`,
                color: BG,
                opacity: startMehfilMut.isPending ? 0.75 : 1,
              }}
            >
              {startMehfilMut.isPending ? "Starting…" : "Start the mehfil"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 1 }}
              disabled
              className="px-12 py-3.5 rounded-full text-[15px] font-medium transition-opacity"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(245,243,239,0.35)",
                opacity: 0.88,
              }}
            >
              Waiting for host
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  const activeSpeakerPresence = session.activeSpeaker
    ? session.presence.find((p) => p.user_id === session.activeSpeaker!.userId)
    : undefined;

  const hostPresence = session.presence.find((p) => p.user_id === mehfil.hostId);
  const listeningRows = session.presence.filter(
    (p) => p.role === "listener" && p.user_id !== mehfil.hostId,
  );

  const dbLiveRoom = mehfil.isLive;
  const livePulse = dbLiveRoom;

  return (
    <motion.div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden font-['Inter']"
      style={{ background: BG, color: FG }}
      initial={PAGE_ENTER.initial}
      animate={PAGE_ENTER.animate}
      transition={PAGE_ENTER.transition}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,168,76,0.12), transparent)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ background: "radial-gradient(ellipse 65% 55% at 80% 85%, rgba(143,255,223,0.07), transparent)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 38%, rgba(0,0,0,0.55) 88%, rgba(0,0,0,0.85) 100%)" }} />

      <AnimatePresence mode="wait">
        {session.audioBlocked && (
          <motion.button
            key="ab"
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={OVERLAY_FADE}
            onClick={() => {
              session.livekitRef.current?.enableAudio();
              session.livekitRef.current?.primeRemotePlayback("tap_unblock");
              session.setAudioBlocked(false);
            }}
            className="relative z-40 mx-4 mt-3 py-2.5 rounded-full text-[12px] font-medium border border-white/10 bg-white/[0.06]">
            Tap to hear the room
          </motion.button>
        )}
        {!session.audioBlocked && session.lkConnecting && (
          <motion.div
            key="lkc"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={OVERLAY_FADE}
            className="relative z-40 mx-4 mt-3 py-2 rounded-full text-center text-[11px] border border-white/[0.07] bg-white/[0.04]"
            style={{ color: "rgba(245,243,239,0.45)" }}
          >
            Connecting audio…
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session.supportMoment ? (
          <motion.div
            key="support-moment"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={OVERLAY_FADE}
            className="relative z-30 mx-5 mt-1 px-4 py-2.5 rounded-[999px] border border-white/[0.08] bg-black/35 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-[999px] opacity-40"
              animate={{ opacity: [0.28, 0.42, 0.28] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: "linear-gradient(110deg, rgba(201,168,76,0.14), transparent 55%, rgba(143,255,223,0.08))",
              }}
            />
            <p className="relative text-center text-[11px] font-['Inter'] tracking-[0.02em]" style={{ color: "rgba(245,243,239,0.72)" }}>
              <span className="font-['Playfair_Display'] text-[14px]" style={{ color: "#e8c97a" }}>
                {session.supportMoment.from_display_name}
              </span>
              <span className="opacity-50"> · </span>
              <span>{supportKindLabel(session.supportMoment.kind)}</span>
              {session.supportMoment.amount > 1 ? (
                <span style={{ color: "rgba(245,243,239,0.45)" }}> ×{session.supportMoment.amount}</span>
              ) : null}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <header className="relative z-20 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3 gap-2">
        <button type="button" onClick={handleLeave} className="text-[13px] px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] shrink-0">Leave</button>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.1] bg-black/20 backdrop-blur-md">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${livePulse ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold whitespace-nowrap">
            {livePulse ? "Live" : session.isHost ? "Studio" : "Lobby"}
          </span>
          {isLiveKitConfigured() && (
            <span className="w-1.5 h-1.5 rounded-full ml-1 shrink-0" style={{ background: session.lkConnected ? "#6be89e" : session.lkReconnecting ? GOLD : "rgba(255,255,255,0.25)" }} />
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setParticipantsOpen(true)} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center border border-white/[0.08]" aria-label="Participants">
            <Users size={15} className="opacity-75" />
          </button>
          {session.isHost ? (
            <button type="button" onClick={() => session.setHostMenuOpen((v) => !v)} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center border border-white/[0.08]">
              <Settings size={15} className="opacity-70" />
            </button>
          ) : null}
        </div>
      </header>

      <AnimatePresence>
        {session.hostMenuOpen && session.isHost && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-[72px] right-5 z-50 w-52 rounded-2xl border border-white/10 overflow-hidden shadow-xl" style={{ background: "#141018" }}>
            {session.activeSpeaker && (
              <button type="button" className="w-full text-left px-4 py-3 text-[13px] border-t border-white/[0.06]" onClick={() => { endTurnMut.mutate(id); session.setHostMenuOpen(false); }}><MicOff size={14} className="inline mr-2 opacity-70" />End turn</button>
            )}
            <button type="button" className="w-full text-left px-4 py-3 text-[13px] border-t border-white/[0.06] text-rose-300" onClick={() => {
              void stopMehfilRecording(id);
              endMehfilMut.mutate(id, { onSuccess: () => { session.setHostMenuOpen(false); session.finalizeHostEnd(); } });
            }}><X size={14} className="inline mr-2" />End gathering</button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex-1 flex flex-col items-center min-h-0 px-6 pt-1 pb-3">
        {session.studio ? (
          <div className="relative mb-4 w-full max-w-[340px] mx-auto shrink-0">
            <motion.div
              className="pointer-events-none absolute rounded-[36px]"
              style={{
                inset: -14,
                background: "radial-gradient(circle, rgba(201,168,76,0.18), transparent 68%)",
                filter: "blur(22px)",
              }}
              animate={{ opacity: livePulse ? [0.42, 0.78, 0.42] : 0.26 }}
              transition={{ duration: livePulse ? 2.8 : 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative mx-auto w-full aspect-[9/16] max-h-[48vh] rounded-[30px] overflow-hidden ring-1 ring-white/12 shadow-[0_42px_120px_rgba(0,0,0,0.72)] bg-[#120e14]">
              {(host?.avatarUrl || mehfil.coverUrl) ? (
                <div
                  className="pointer-events-none absolute inset-0 z-0 scale-[1.08]"
                  style={{
                    backgroundImage: `url(${host?.avatarUrl || mehfil.coverUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(36px) saturate(1.12)",
                    opacity: session.isHost ? (session.hostCameraOn ? 0.42 : 0.72) : 0.65,
                  }}
                  aria-hidden
                />
              ) : (
                <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#1c1420] via-[#0f0a12] to-black" aria-hidden />
              )}
              <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/50 via-transparent to-black/20" aria-hidden />
              {session.isHost ? (
                <>
                  <div ref={localVidRef} className="absolute inset-0 z-[2] w-full h-full" />
                  {!session.hostCameraOn && (
                    <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/72 via-black/35 to-transparent">
                      {(host?.avatarUrl || mehfil.coverUrl) ? (
                        <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-[76px] h-[76px] rounded-full object-cover ring-2 ring-[rgba(201,168,76,0.35)] shadow-[0_0_40px_rgba(201,168,76,0.22)] opacity-92" />
                      ) : (
                        <div className="w-[76px] h-[76px] rounded-full flex items-center justify-center font-['Playfair_Display'] text-2xl opacity-55 bg-white/[0.08] ring-1 ring-white/12">
                          {(host?.displayName ?? mehfil.title).charAt(0)}
                        </div>
                      )}
                      <p className="text-[10px] font-['Inter'] uppercase tracking-[0.28em]" style={{ color: "rgba(245,243,239,0.38)" }}>Camera off · voice carries</p>
                    </div>
                  )}
                </>
              ) : (
                <div ref={remoteVidRef} className="absolute inset-0 z-[2] w-full h-full" />
              )}
            </div>
          </div>
        ) : (
          <div className="relative mb-4">
            <motion.div
              className="pointer-events-none absolute rounded-full"
              style={{
                inset: -18,
                background: "radial-gradient(circle, rgba(201,168,76,0.22), transparent 68%)",
                filter: "blur(16px)",
              }}
              animate={{ opacity: livePulse ? [0.45, 0.85, 0.45] : 0.28, scale: livePulse ? [1, 1.06, 1] : 1 }}
              transition={{ duration: livePulse ? 2.8 : 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative w-[118px] h-[118px] rounded-full overflow-hidden ring-1 ring-white/12 shadow-[0_28px_80px_rgba(0,0,0,0.68)] bg-white/[0.04]">
              {(host?.avatarUrl || mehfil.coverUrl) ? (
                <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-['Playfair_Display'] text-3xl opacity-40">
                  {(host?.displayName ?? mehfil.title).charAt(0)}
                </div>
              )}
            </div>
          </div>
        )}
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 font-['Inter']" style={{ color: "rgba(232,177,74,0.48)" }}>Host</p>
        <h2 className="font-['Playfair_Display'] text-[22px] text-center leading-tight">{host?.displayName ?? "Host"}</h2>
        <p className="text-[13px] mt-2 text-center font-['Playfair_Display'] italic opacity-50 max-w-[18rem]">{mehfil.title}</p>

        <WaveOrb active={session.canPublishNow ? !session.muted : !!session.activeSpeaker} />

        <p className="text-[11px] mt-3 font-['Inter']" style={{ color: "rgba(245,243,239,0.38)" }}>
          <span style={{ color: MINT }}>{session.gatheredVoices}</span> voices nearby
        </p>

        <AnimatePresence mode="wait">
          {session.activeSpeaker && session.activeSpeaker.userId !== mehfil.hostId && (
            <StageSpeaker key={session.activeSpeaker.userId} userId={session.activeSpeaker.userId} row={activeSpeakerPresence} />
          )}
        </AnimatePresence>

        {session.benchListeners.length > 0 && (
          <div className="mt-6 flex items-center gap-3 opacity-80">
            <AvatarStack users={session.benchListeners} />
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(245,243,239,0.28)" }}>listening</span>
          </div>
        )}
      </main>

      <div className="relative z-10 mx-5 mb-2 flex rounded-2xl border border-white/[0.07] bg-black/25 overflow-hidden backdrop-blur-md">
        {(["chat", "stage"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDock(d)} className={`flex-1 py-2.5 text-[11px] uppercase tracking-[0.18em] ${dock === d ? "text-white bg-white/[0.06]" : "text-white/35"}`}>{d}</button>
        ))}
      </div>

      <div className="relative z-10 mx-5 flex-1 min-h-[9.5rem] max-h-[min(34vh,280px)] rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden flex flex-col backdrop-blur-sm">
        {dock === "chat" ? (
          <>
            <div ref={session.chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-[12px]">
              {session.chat.length === 0 && <div className="text-center py-8 opacity-30 text-[12px]">Silence before the first word…</div>}
              {session.chat.map((m: ChatMsg) => (
                <div key={m.id}>
                  {m.userId === "__system__" ? (
                    <div className="text-[11px] text-center py-0.5 opacity-80">
                      <span style={{ color: GOLD }} className="font-['Playfair_Display']">{m.name}</span>
                      <span style={{ color: "rgba(245,243,239,0.5)" }}>{m.text}</span>
                    </div>
                  ) : (
                    <>
                      {m.userId === me ? (
                        <span style={{ color: MINT }} className="font-medium">{m.name}: </span>
                      ) : (
                        <span style={{ color: GOLD }} className="font-medium">{m.name}: </span>
                      )}
                      <span style={{ color: "rgba(245,243,239,0.75)" }}>{m.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-2 border-t border-white/[0.06]">
              <input value={session.draft} onChange={(e) => session.setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && session.sendChat()}
                placeholder="Whisper to the room…" className="flex-1 rounded-full px-3 py-2 text-[12px] bg-white/[0.06] border border-white/[0.06] outline-none" />
              <button type="button" onClick={session.sendChat} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: GOLD }}><Send size={13} color={BG} /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 text-[13px] space-y-3">
            {session.isHost && session.pendingQueue.map((entry) => {
              const p = session.presence.find((pr) => pr.user_id === entry.userId);
              return (
                <div key={entry.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex-1 truncate">{p?.display_name ?? "Guest"}</div>
                  <button type="button" onClick={() => approveEntry.mutate(entry.id)} className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-400/40"><CheckCircle size={15} className="text-emerald-300" /></button>
                  <button type="button" onClick={() => rejectEntry.mutate(entry.id)} className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/15 border border-rose-400/35"><XCircle size={15} className="text-rose-300" /></button>
                </div>
              );
            })}
            {session.isHost && session.pendingQueue.length === 0 && <div className="text-center py-6 opacity-35 text-[12px]">No hands raised</div>}
            {!session.isHost && (
              <div className="flex flex-col items-center gap-4 py-6">
                {session.myEntry?.status === "pending" ? (
                  <>
                    <Hand size={28} style={{ color: GOLD }} />
                    <p className="text-center text-[13px] opacity-60">Waiting for host…</p>
                    <button type="button" onClick={() => lowerHandMut.mutate(id)} className="text-[12px] px-4 py-2 rounded-full bg-white/[0.06]">Lower hand</button>
                  </>
                ) : session.myEntry?.status === "speaking" ? (
                  <div className="text-center space-y-4">
                    <p style={{ color: MINT }} className="font-['Playfair_Display'] italic">You have the floor</p>
                    <button type="button" onClick={() => { const nm = !session.muted; session.setMuted(nm); void session.livekitRef.current?.setMicEnabled(!nm); }}
                      className="w-14 h-14 rounded-full mx-auto flex items-center justify-center border-2" style={{ borderColor: session.muted ? "#f76a4a" : MINT }}>
                      {session.muted ? <MicOff /> : <Mic />}
                    </button>
                  </div>
                ) : (
                  <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => raiseHandMut.mutate(id)}
                    className="px-6 py-3 rounded-full border text-[13px]" style={{ borderColor: `${GOLD}55`, color: GOLD }}>
                    Raise hand
                  </motion.button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {session.joined && !session.isHost && (
        <motion.button
          type="button"
          className="fixed z-[35] pointer-events-auto flex items-center gap-2 pr-4 pl-3.5 py-2.5 rounded-full border border-white/[0.14] bg-black/58 backdrop-blur-2xl shadow-[0_16px_44px_rgba(0,0,0,0.55)]"
          style={{
            right: "max(env(safe-area-inset-right), 14px)",
            left: "auto",
            bottom: "calc(env(safe-area-inset-bottom) + 92px)",
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => session.setSupportOpen(true)}
        >
          <Coffee size={15} style={{ color: GOLD }} className="opacity-95 shrink-0" />
          <span className="text-[11px] font-['Inter'] font-semibold tracking-[0.04em] text-[rgba(252,248,242,0.94)]">
            Appreciate
          </span>
        </motion.button>
      )}

      <footer className="relative z-10 flex justify-center px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-[999px] border border-white/[0.06] bg-black/40 backdrop-blur-2xl shadow-[0_12px_42px_rgba(0,0,0,0.42)]">
          {!session.isHost && (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => session.setSupportOpen(true)} className="px-4 py-2.5 rounded-full text-[12px] border border-white/[0.08] bg-white/[0.05]">Chai</motion.button>
          )}
          {session.canPublishNow && (
            <motion.button type="button" whileTap={{ scale: 0.96 }}
              onClick={async () => {
                const nextMuted = !session.muted;
                await session.livekitRef.current?.setMicEnabled(!nextMuted);
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center border border-white/[0.1]"
              style={{ background: session.muted ? "rgba(247,106,74,0.12)" : "rgba(255,255,255,0.06)" }}
              aria-label={session.muted ? "Unmute microphone" : "Mute microphone"}
            >
              {session.muted ? <MicOff size={18} className="text-rose-300" /> : <Mic size={18} className="text-emerald-200/90" />}
            </motion.button>
          )}
          {session.isHost && session.studio && session.canPublishNow && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => session.setHostCameraOn(!session.hostCameraOn)}
              className="w-12 h-12 rounded-full flex items-center justify-center border border-white/[0.1]"
              style={{ background: session.hostCameraOn ? "rgba(143,255,223,0.08)" : "rgba(255,255,255,0.06)" }}
              aria-label={session.hostCameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {session.hostCameraOn ? <Video size={18} className="text-emerald-200/85" /> : <VideoOff size={18} className="text-white/35" />}
            </motion.button>
          )}
          {!session.isHost ? (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setDock("stage")} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] bg-white/[0.05] border border-white/[0.08]">
              <Hand size={14} /><span>Stage</span>
            </motion.button>
          ) : (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setDock("stage")} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] bg-white/[0.05] border border-white/[0.08]">
              <Users size={14} /><span>Queue</span>
            </motion.button>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {participantsOpen && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 w-full h-full bg-black/55 backdrop-blur-sm border-0 cursor-default p-0"
              aria-label="Close participants"
              onClick={() => setParticipantsOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SHEET_SPRING}
              className="relative rounded-t-[28px] border border-white/[0.08] max-h-[72vh] flex flex-col overflow-hidden mx-0"
              style={{ background: "#100c12" }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06]">
                <div className="min-w-0">
                  <span className="text-[11px] uppercase tracking-[0.24em] font-['Inter']" style={{ color: "rgba(245,243,239,0.5)" }}>Participants</span>
                  <p className="text-[10px] mt-1 opacity-35 tracking-[0.12em] truncate">{session.presence.length} in this gathering</p>
                </div>
                <button type="button" className="text-[13px] opacity-50 font-['Inter'] shrink-0" onClick={() => setParticipantsOpen(false)}>Done</button>
              </div>
              <div className="overflow-y-auto px-4 py-4 pb-[max(env(safe-area-inset-bottom),24px)] space-y-6">
                <section>
                  <div className="text-[10px] uppercase tracking-[0.26em] mb-2.5 font-['Inter']" style={{ color: "rgba(245,243,239,0.36)" }}>Stage</div>
                  <motion.div layout className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.045] border border-white/[0.08]">
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-amber-200/25">
                      {(hostPresence?.avatar_url || host?.avatarUrl) ? (
                        <img src={hostPresence?.avatar_url || host?.avatarUrl || ""} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm bg-white/[0.06]">{(host?.displayName ?? "H").charAt(0)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-['Playfair_Display'] text-[15px] truncate">{host?.displayName ?? "Host"}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] opacity-38 mt-0.5">
                        Host
                        {session.isHost ? (
                          <span className="ml-2" style={{ color: session.muted ? "#f9a8b6" : MINT }}>
                            {session.muted ? "· muted" : "· live"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>

                  {session.activeSpeaker && session.activeSpeaker.userId !== mehfil.hostId && (
                    <motion.div layout className="flex items-center gap-3 mt-2 p-3 rounded-2xl bg-[rgba(143,255,223,0.05)] border border-[rgba(143,255,223,0.14)]">
                      <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-white/15">
                        {(activeSpeakerPresence?.avatar_url) ? (
                          <img src={activeSpeakerPresence.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs bg-white/[0.08]">
                            {(activeSpeakerPresence?.display_name ?? "S").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.2em] opacity-40">Speaking</div>
                        <div className="font-['Playfair_Display'] text-[15px] truncate">{activeSpeakerPresence?.display_name ?? "Guest"}</div>
                      </div>
                      {session.isHost && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/12 bg-white/[0.06]"
                            aria-label="Mute speaker"
                            onClick={() => session.sendHostMuteSpeaker(session.activeSpeaker!.userId)}
                          >
                            <MicOff size={15} className="text-rose-200/90" />
                          </button>
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full flex items-center justify-center border border-rose-500/28 bg-rose-500/12"
                            disabled={hostRemoveMut.isPending}
                            aria-label="Remove from stage"
                            onClick={() => hostRemoveMut.mutate({ mehfilId: id, userId: session.activeSpeaker!.userId })}
                          >
                            <X size={14} className="text-rose-300" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </section>

                {(session.pendingQueue.length > 0 || (!session.isHost && session.myEntry?.status === "pending")) && (
                  <section>
                    <div className="flex items-baseline justify-between mb-2.5">
                      <span className="text-[10px] uppercase tracking-[0.26em] font-['Inter']" style={{ color: "rgba(245,243,239,0.36)" }}>Requests</span>
                      {session.isHost && session.pendingQueue.length > 0 ? (
                        <span className="text-[10px] opacity-35">{session.pendingQueue.length} waiting</span>
                      ) : null}
                    </div>
                    {!session.isHost && session.myEntry?.status === "pending" && session.myQueuePosition != null ? (
                      <p className="text-[12px] text-center py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]" style={{ color: "rgba(245,243,239,0.45)" }}>
                        You&apos;re <span className="text-white/85 font-medium">#{session.myQueuePosition}</span> in line
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {session.isHost && session.pendingQueue.map((entry) => (
                        <PendingHandRow
                          key={entry.id}
                          entry={entry}
                          isHost
                          presenceRow={session.presence.find((pr) => pr.user_id === entry.userId)}
                          onApprove={() => approveEntry.mutate(entry.id)}
                          onReject={() => rejectEntry.mutate(entry.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <div className="text-[10px] uppercase tracking-[0.26em] mb-2.5 font-['Inter']" style={{ color: "rgba(245,243,239,0.36)" }}>
                    Listening · {listeningRows.length}
                  </div>
                  <div className="space-y-0">
                    {listeningRows.map((p) => (
                      <div key={p.user_id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/[0.06] shrink-0 ring-1 ring-black/30">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium">{p.display_name.charAt(0)}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] truncate">{p.display_name}</div>
                          <div className="text-[10px] uppercase tracking-wider opacity-32">Listening</div>
                        </div>
                        {session.isHost && (
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 bg-white/[0.05]"
                            disabled={hostInviteMut.isPending}
                            onClick={() => hostInviteMut.mutate({ mehfilId: id, userId: p.user_id }, { onSuccess: () => setParticipantsOpen(false) })}
                            aria-label="Invite to stage"
                          >
                            <UserPlus size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    {listeningRows.length === 0 && session.presence.length <= 1 && (
                      <p className="text-[12px] opacity-30 text-center py-6 font-['Inter']">The room is still gathering…</p>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {session.supportOpen && !session.isHost && mehfil.hostId && (
          <SupportSheet toUserId={mehfil.hostId} toUserName={host?.displayName ?? "Host"} mehfilId={id} onSupportSent={session.broadcastRoomSupport} onClose={() => session.setSupportOpen(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
