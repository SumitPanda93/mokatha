import { useEffect, useState, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import { useMehfil, useUser, useTip, joinMehfil, leaveMehfil, getCurrentUserId, useMehfils, useEarnInkPoints } from "@/lib/store";
import { Send } from "lucide-react";
import PaymentModal from "@/components/PaymentModal";

const FMT_SEC = (s = 0) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

type ChatMsg = { id: string; userId: string; name: string; text: string };

const SEED_CHAT: ChatMsg[] = [
  { id: "sc1", userId: "u4", name: "Sanjukta Rout", text: "ଏ ଗଜଲ ବହୁତ ଭଲ ।" },
  { id: "sc2", userId: "u6", name: "Rachita Tripathy", text: "सुबह सुबह ऐसी आवाज़ — बहुत खूब!" },
  { id: "sc3", userId: "u3", name: "Ashutosh Pradhan", text: "ଶୁଣୁ ଅଛୁ, ଆଖୁ ଭର‍ି ଯାଉଛି।" },
];

export default function MehfilRoom() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "m1";
  const [, setLocation] = useLocation();
  const { data: mehfil } = useMehfil(id);
  const { data: host } = useUser(mehfil?.hostId ?? "");
  const tip = useTip("mehfil");
  const earnPts = useEarnInkPoints();
  const [joined, setJoined] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>(SEED_CHAT);
  const [draft, setDraft] = useState("");
  const [tipAmt, setTipAmt] = useState<number | null>(null);
  const [stripePayOpen, setStripePayOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const me = getCurrentUserId();
  const { data: myUser } = useUser(me ?? "");
  useTitle(mehfil?.title ?? "Mehfil");

  useEffect(() => {
    if (!joined || !mehfil?.isLive) return;
    joinMehfil(id);
    if (me) earnPts.mutate({ userId: me, points: 15 });
    return () => { leaveMehfil(id); };
  }, [joined, id, mehfil?.isLive]);

  useEffect(() => {
    if (!joined) return;
    const msgs = [
      "ଆଜି ର ଗଜଲ ଅନ‍ୁପ‍ଅ...",
      "Wah wah wah!",
      "ବହୁତ ସୁନ‍୍ଦର ।",
      "क्या बात है!",
      "ପୁଣ‍ି ଥ‍ରେ ।",
    ];
    const users = [
      { userId: "u3", name: "Ashutosh" },
      { userId: "u4", name: "Sanjukta" },
      { userId: "u5", name: "Debashis" },
      { userId: "u6", name: "Rachita" },
    ];
    const t = setInterval(() => {
      const u = users[Math.floor(Math.random() * users.length)];
      const txt = msgs[Math.floor(Math.random() * msgs.length)];
      setChat((c) => [...c.slice(-30), { id: `auto${Date.now()}`, ...u, text: txt }]);
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, [joined]);

  const sendChat = () => {
    if (!draft.trim()) return;
    setChat((c) => [...c, { id: `msg${Date.now()}`, userId: me ?? "u1", name: myUser?.displayName ?? "You", text: draft.trim() }]);
    setDraft("");
    setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
  };

  const sendTip = (amt: number) => {
    tip.mutate({ id, amount: amt });
    setTipAmt(null);
  };

  if (!mehfil) {
    return (
      <div className="min-h-screen bg-[#1A0F14] flex items-center justify-center">
        <div className="text-white/60 text-[14px] font-['Inter']">Mehfil not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#1A0F14] relative overflow-hidden text-[#F5F3EF]">
      <style>{`
        @keyframes mh-pulse { 0% { transform: scale(0.95); opacity: 0.7; } 70% { transform: scale(1.45); opacity: 0; } 100% { transform: scale(1.45); opacity: 0; } }
        @keyframes mh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mh-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes mh-bar { 0%, 100% { height: 18%; } 50% { height: 100%; } }
        @keyframes mh-glow { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
      `}</style>

      {/* Ambient bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-30" style={{ background: "radial-gradient(circle,#F76A4A,transparent 70%)", filter: "blur(40px)", animation: "mh-glow 4s ease-in-out infinite" }} />
        <div className="absolute bottom-20 -left-10 w-[240px] h-[240px] rounded-full opacity-25" style={{ background: "radial-gradient(circle,#E8B14A,transparent 70%)", filter: "blur(50px)" }} />
      </div>

      {/* Top bar */}
      <div className="px-6 py-4 flex justify-between items-center relative z-10 pt-10">
        <button onClick={() => { leaveMehfil(id); setLocation("/"); }} className="text-[13px] font-['Inter'] text-[#F5F3EF]/70 hover:text-white transition-colors">Leave</button>
        <div className="flex items-center gap-2 text-[10px] font-['Inter'] tracking-[0.2em] uppercase text-white rounded-full px-3 py-1.5 font-semibold shadow-lg" style={{ background: mehfil.isLive ? "linear-gradient(135deg,#F76A4A,#C04A3F)" : "rgba(255,255,255,0.1)" }}>
          {mehfil.isLive ? (
            <>
              <div className="relative w-2 h-2"><div className="absolute inset-0 rounded-full bg-white" /><div className="absolute inset-0 rounded-full bg-white" style={{ animation: "mh-pulse 1.5s ease-out infinite" }} /></div>
              LIVE
            </>
          ) : "UPCOMING"}
        </div>
      </div>

      {/* Stage */}
      <div className="flex flex-col items-center px-6 pt-4 pb-4 relative z-10">
        <div className="text-[9px] font-['Inter'] tracking-[0.4em] uppercase text-[#E8B14A] font-medium mb-5 flex items-center gap-3">
          <span className="w-6 h-[1px] bg-[#E8B14A]" />MEHFIL<span className="w-6 h-[1px] bg-[#E8B14A]" />
        </div>
        <div className="relative w-[200px] h-[200px] flex items-center justify-center mb-4">
          {mehfil.isLive && <div className="absolute w-[170px] h-[170px] rounded-full border-2 border-[#F76A4A]" style={{ animation: "mh-pulse 2.4s ease-out infinite" }} />}
          <div className="absolute w-[140px] h-[140px] rounded-full p-[2.5px]" style={{ background: "conic-gradient(from 0deg,#F76A4A,#E8B14A,#B14A8B,#6A5AE0,#F76A4A)", animation: "mh-spin 6s linear infinite" }}>
            <div className="w-full h-full rounded-full bg-[#1A0F14]" />
          </div>
          <div className="relative w-[90px] h-[90px] rounded-full z-10 overflow-hidden border-[2px] border-[#F5F3EF]/25 shadow-2xl" style={{ animation: "mh-float 4s ease-in-out infinite" }}>
            <img src={host?.avatarUrl || mehfil.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="text-[26px] font-['Playfair_Display'] font-normal text-[#F5F3EF] text-center leading-tight">{host?.displayName ?? "Host"}</div>
        <div className="text-[14px] font-['Playfair_Display'] italic text-[#F5F3EF]/60 mt-1 mb-2 text-center">{mehfil.title}</div>

        {mehfil.isLive && (
          <>
            <div className="flex items-end gap-[3px] h-5 mb-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="w-[3px] rounded-full bg-[#E8B14A]" style={{ animation: `mh-bar ${0.6 + (i % 4) * 0.2}s ease-in-out infinite ${i * 0.08}s` }} />
              ))}
            </div>
            <div className="text-[11px] font-['Inter'] text-[#F5F3EF]/70 flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6BE89E] shrink-0" />
              <span className="text-[#6BE89E] font-semibold">{mehfil.listeners}</span> listening
            </div>
          </>
        )}

        {/* Join / tip buttons */}
        {!joined ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setJoined(true)}
            className="text-[15px] font-['Inter'] font-medium text-[#1A0F14] bg-[#E8B14A] rounded-full px-10 py-3 shadow-lg hover:scale-105 transition-transform">
            {mehfil.isLive ? "Join Mehfil" : "Set Reminder"}
          </motion.button>
        ) : (
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setStripePayOpen(true)}
              className="text-[14px] font-['Playfair_Display'] text-[#1A0F14] bg-[#E8B14A] rounded-full px-7 py-2.5 shadow-md hover:scale-105 transition-transform">
              Send Tip
            </motion.button>
          </div>
        )}
      </div>

      {/* Live chat */}
      {joined && (
        <div className="flex-1 flex flex-col mx-4 mt-2 bg-black/30 rounded-2xl overflow-hidden relative z-10 min-h-0">
          <div className="text-[9px] font-['Inter'] tracking-[0.25em] uppercase text-[#F5F3EF]/50 px-3 py-2">Live chat</div>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5 no-scrollbar" style={{ maxHeight: "180px" }}>
            {chat.map((m) => (
              <div key={m.id} className="text-[12px] font-['Inter']">
                <span className="text-[#E8B14A] font-medium mr-1">{m.name}</span>
                <span className="text-[#F5F3EF]/80">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-2 border-t border-white/10">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Say something..." className="flex-1 bg-white/10 rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-white/40 outline-none" />
            <button onClick={sendChat} className="w-8 h-8 rounded-full bg-[#E8B14A] flex items-center justify-center">
              <Send size={12} className="text-[#1A0F14]" />
            </button>
          </div>
        </div>
      )}

      <div className="h-8" />

      {stripePayOpen && mehfil && (
        <PaymentModal
          mode="tip"
          recipientId={mehfil.hostId}
          mehfilId={id}
          onClose={() => setStripePayOpen(false)}
        />
      )}
    </div>
  );
}
