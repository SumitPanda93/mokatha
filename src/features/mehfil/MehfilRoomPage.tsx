/**
 * Mehfil — rebuilt shell: audio-first, minimal chrome, calm gathering atmosphere.
 */
import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useMehfil,
  useUser,
  getCurrentUserId,
  useEarnInkPoints,
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
} from "@/lib/store";
import MehfilReplaySheet from "@/components/MehfilReplaySheet";
import SupportSheet from "@/components/SupportSheet";
import {
  Mic, MicOff, Send, Hand, Settings, X, CheckCircle, XCircle, Radio, Users,
} from "lucide-react";
import { isLiveKitConfigured } from "@/lib/livekit";
import { OVERLAY_FADE, PAGE_ENTER } from "@/lib/motionTokens";
import {
  useMehfilRoomSession,
  type PresencePayload,
  type ChatMsg,
} from "@/features/mehfil/useMehfilRoomSession";

const BG = "#0a0609";
const FG = "#f5f3ef";
const GOLD = "#c9a84c";
const MINT = "#8fffdf";

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
    <div className="flex items-end justify-center gap-[3px] h-8">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: active ? GOLD : "rgba(201,168,76,0.22)" }}
          animate={{ height: active ? [6, 26, 10, 22, 8][i % 5] : 5 }}
          transition={{ duration: 0.55 + (i % 4) * 0.07, repeat: Infinity, repeatType: "mirror", delay: i * 0.06 }}
        />
      ))}
    </div>
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
      className="mt-6 px-4 py-3 rounded-2xl flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg, rgba(143,255,223,0.08), rgba(201,168,76,0.05))",
        border: "1px solid rgba(143,255,223,0.25)",
      }}
    >
      <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-white/15">
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full flex items-center justify-center text-sm" style={{ background: "rgba(143,255,223,0.12)", color: MINT }}>{name.charAt(0)}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-[0.24em] font-['Inter'] font-semibold" style={{ color: MINT }}>Speaking</div>
        <div className="font-['Playfair_Display'] text-[16px] truncate text-white">{name}</div>
      </div>
      <WaveOrb active />
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

  const { data: mehfil, isLoading } = useMehfil(id);
  const { data: host } = useUser(mehfil?.hostId ?? "");
  const me = getCurrentUserId();

  useTitle(mehfil?.title ?? "Mehfil");
  useMehfilRealtime(id);
  useMehfilQueueRealtime(id);
  const { data: queue = [] } = useMehfilQueue(id);
  const { data: publishedReplay } = usePublishedMehfilReplay(id);

  const session = useMehfilRoomSession(id, mehfil, queue, navigateOut);

  const raiseHandMut = useRaiseHand();
  const lowerHandMut = useLowerHand();
  const approveEntry = useApproveQueueEntry();
  const rejectEntry = useRejectQueueEntry();
  const endTurnMut = useEndSpeakerTurn();
  const endMehfilMut = useEndMehfil();
  const startMehfilMut = useStartMehfil();

  const [dock, setDock] = useState<"chat" | "stage">("chat");

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

  const needsTicket = !session.isHost && (mehfil.isTicketed ?? false) && (mehfil.ticketPrice ?? 0) > 0 && !session.hasTicket;
  if (needsTicket && !session.joined) {
    return <TicketGate mehfil={mehfil} host={host} onPay={session.buyTicket} onLeave={navigateOut} paying={session.payingTicket} />;
  }

  if (!session.joined) {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 pb-12 font-['Inter']" style={{ background: BG, color: FG }}>
        <div className="pt-12 pb-8 flex justify-between items-center">
          <button type="button" onClick={navigateOut} className="text-[13px]" style={{ color: "rgba(245,243,239,0.5)" }}>←</button>
          <span className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "rgba(232,177,74,0.55)" }}>{mehfil.isLive ? "Live" : "Soon"}</span>
          <span className="w-8" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="relative w-[140px] h-[140px] flex items-center justify-center">
            <div className="absolute inset-6 rounded-full blur-2xl opacity-30" style={{ background: "radial-gradient(circle, #f76a4a, transparent)" }} />
            <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden ring-2 ring-white/10">
              <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <h1 className="font-['Playfair_Display'] text-[28px] leading-tight mb-2">{mehfil.title}</h1>
            <p className="text-[13px]" style={{ color: "rgba(245,243,239,0.45)" }}>{host?.displayName ?? "Host"}</p>
          </div>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => void session.joinRoom()}
            className="px-12 py-3.5 rounded-full text-[15px] font-medium"
            style={{ background: mehfil.isLive ? `linear-gradient(135deg,${GOLD},#f76a4a)` : "rgba(255,255,255,0.08)", color: mehfil.isLive ? BG : FG }}>
            {mehfil.isLive ? "Join gathering" : "Remind me"}
          </motion.button>
        </div>
      </div>
    );
  }

  const activeSpeakerPresence = session.activeSpeaker
    ? session.presence.find((p) => p.user_id === session.activeSpeaker!.userId)
    : undefined;

  return (
    <motion.div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden font-['Inter']"
      style={{ background: BG, color: FG }}
      initial={PAGE_ENTER.initial}
      animate={PAGE_ENTER.animate}
      transition={PAGE_ENTER.transition}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,168,76,0.12), transparent)" }} />

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

      <header className="relative z-20 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <button type="button" onClick={session.leaveRoom} className="text-[13px] px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">Leave</button>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.1] bg-black/20 backdrop-blur-md">
          <span className={`w-1.5 h-1.5 rounded-full ${mehfil.isLive ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">Live</span>
          {isLiveKitConfigured() && (
            <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: session.lkConnected ? "#6be89e" : session.lkReconnecting ? GOLD : "rgba(255,255,255,0.25)" }} />
          )}
        </div>
        {session.isHost ? (
          <button type="button" onClick={() => session.setHostMenuOpen((v) => !v)} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center border border-white/[0.08]">
            <Settings size={15} className="opacity-70" />
          </button>
        ) : <span className="w-9" />}
      </header>

      <AnimatePresence>
        {session.hostMenuOpen && session.isHost && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-[72px] right-5 z-50 w-52 rounded-2xl border border-white/10 overflow-hidden shadow-xl" style={{ background: "#141018" }}>
            {!mehfil.isLive && (
              <button type="button" className="w-full text-left px-4 py-3 text-[13px]" style={{ color: GOLD }} onClick={() => { startMehfilMut.mutate(id); session.setHostMenuOpen(false); }}><Radio size={14} className="inline mr-2" />Go live</button>
            )}
            {session.activeSpeaker && (
              <button type="button" className="w-full text-left px-4 py-3 text-[13px] border-t border-white/[0.06]" onClick={() => { endTurnMut.mutate(id); session.setHostMenuOpen(false); }}><MicOff size={14} className="inline mr-2 opacity-70" />End turn</button>
            )}
            <button type="button" className="w-full text-left px-4 py-3 text-[13px] border-t border-white/[0.06] text-rose-300" onClick={() => endMehfilMut.mutate(id, { onSuccess: () => { session.setHostMenuOpen(false); session.finalizeHostEnd(); } })}><X size={14} className="inline mr-2" />End gathering</button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 pt-2 pb-4">
        <div className="w-[104px] h-[104px] rounded-full overflow-hidden ring-2 ring-white/10 mb-4 shadow-2xl shadow-black/50">
          <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(232,177,74,0.55)" }}>Host</p>
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

      <div className="relative z-10 mx-5 flex-1 min-h-[11rem] max-h-[38vh] rounded-2xl border border-white/[0.06] bg-black/30 overflow-hidden flex flex-col backdrop-blur-sm">
        {dock === "chat" ? (
          <>
            <div ref={session.chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-[12px]">
              {session.chat.length === 0 && <div className="text-center py-8 opacity-30 text-[12px]">Silence before the first word…</div>}
              {session.chat.map((m: ChatMsg) => (
                <div key={m.id}>
                  {m.userId === me ? (
                    <span style={{ color: MINT }} className="font-medium">{m.name}: </span>
                  ) : (
                    <span style={{ color: GOLD }} className="font-medium">{m.name}: </span>
                  )}
                  <span style={{ color: "rgba(245,243,239,0.75)" }}>{m.text}</span>
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

      <footer className="relative z-10 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] flex items-center justify-between gap-3 border-t border-white/[0.05]">
        <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => session.setSupportOpen(true)} className="px-4 py-2.5 rounded-full text-[12px] border border-white/[0.08] bg-white/[0.04]">Chai</motion.button>
        <motion.button type="button" whileTap={{ scale: 0.96 }}
          onClick={async () => {
            const nm = !session.muted;
            session.setMuted(nm);
            await session.livekitRef.current?.setMicEnabled(!nm);
          }}
          className="w-12 h-12 rounded-full flex items-center justify-center border border-white/[0.1]"
          style={{ background: session.muted ? "rgba(247,106,74,0.12)" : "rgba(255,255,255,0.06)" }}>
          {session.muted ? <MicOff size={18} className="text-rose-300" /> : <Mic size={18} className="opacity-70" />}
        </motion.button>
        {!session.isHost ? (
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setDock("stage")} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] bg-white/[0.05] border border-white/[0.08]">
            <Hand size={14} /><span>Stage</span>
          </motion.button>
        ) : (
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setDock("stage")} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] bg-white/[0.05] border border-white/[0.08]">
            <Users size={14} /><span>Queue</span>
          </motion.button>
        )}
      </footer>

      <AnimatePresence>
        {session.supportOpen && mehfil.hostId && (
          <SupportSheet toUserId={mehfil.hostId} toUserName={host?.displayName ?? "Host"} mehfilId={id} onClose={() => session.setSupportOpen(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
