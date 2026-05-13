import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mic, MicOff, X, Hand, Volume2, VolumeX, UserPlus, Radio, ChevronLeft } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useUser, useMehfil, useEndMehfil, getCurrentUserId } from "@/lib/store";
import type { Mehfil } from "@/lib/store";
import { toast } from "sonner";
import { PrepareMehfilForm } from "@/features/mehfil/PrepareMehfilForm";

export default function MehfilHost() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();

  if (!id || id === "new") return <PrepareMehfilForm />;

  return <MehfilHostRoom id={id} />;
}

function MehfilHostRoom({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { data: mehfil } = useMehfil(id);
  const { data: host } = useUser(mehfil?.hostId ?? "");
  const end = useEndMehfil();
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [stage, setStage] = useState<string[]>([]);
  const [requests] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  useTitle(mehfil ? `Hosting · ${mehfil.title}` : "Host");

  useEffect(() => { const i = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(i); }, []);

  if (!mehfil || !host) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center" style={{ background: "linear-gradient(180deg, #1A0F14, #0E0810)" }}>
        <div className="text-center">
          <div className="text-[14px] text-white/60 font-['Inter'] mb-4">Mehfil not found.</div>
          <button onClick={() => setLocation("/mehfil")} className="text-[13px] text-terracotta hover:underline">Back to Mehfil</button>
        </div>
      </div>
    );
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const endLive = () => {
    end.mutate(id, {
      onSuccess: () => {
        toast.success("Mehfil ended");
        setLocation("/mehfil");
      },
      onError: (err: Error) => toast.error(err.message || "Could not end session"),
    });
  };

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "linear-gradient(180deg, #1A0F14 0%, #2A1018 60%, #0E0810 100%)" }}>
      <style>{`
        @keyframes mh-ring { 0% { transform: scale(.95); opacity:.7;} 70% { transform: scale(1.45); opacity:0;} 100% { transform: scale(1.45); opacity:0;} }
        @keyframes mh-bar { 0%,100% { height: 14%;} 50% { height: 100%;} }
      `}</style>

      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-sm bg-destructive text-[9px] uppercase tracking-[0.18em] font-bold">Live</span>
          <span className="text-[12px] opacity-80">{fmt(seconds)}</span>
        </div>
        <button onClick={endLive} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><X size={16} /></button>
      </div>

      <div className="px-6">
        <div className="text-[11px] uppercase tracking-[0.2em] opacity-70">Mehfil</div>
        <div className="font-['Playfair_Display'] text-[28px] mt-1 leading-tight">{mehfil.title}</div>
        <div className="text-[12px] opacity-70 mt-1">{mehfil.listeners} listening · {requests.length} hands raised</div>
      </div>

      <div className="px-6 mt-7">
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-3">Stage</div>
        <div className="flex justify-center gap-7">
          <SpeakerCard userId={host.id} role="Host" speaking={!muted} />
          {stage.map((uid) => <SpeakerCard key={uid} userId={uid} role="Speaker" speaking />)}
        </div>
      </div>

      <div className="px-6 mt-7">
        <div className="flex items-end justify-center gap-[3px] h-12">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="w-[4px] rounded" style={{ background: "linear-gradient(180deg, hsl(var(--ochre)), hsl(var(--terracotta)))", height: `${20 + ((i * 13) % 80)}%`, animation: !muted ? `mh-bar 0.${(i % 9) + 4}s ease-in-out infinite` : "none" }} />
          ))}
        </div>
      </div>

      <div className="px-6 mt-7">
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">Hand raised · {requests.length}</div>
        <div className="space-y-2">
          {requests.map((uid) => <RequestRow key={uid} userId={uid} onAccept={() => setStage((s) => s.includes(uid) ? s : [...s, uid].slice(0, 4))} />)}
          {requests.length === 0 && <div className="text-[12px] opacity-60 italic">No-one raising a hand right now.</div>}
        </div>
      </div>

      <div className="fixed bottom-5 left-0 right-0 flex justify-center px-5">
        <div className="bg-white/8 backdrop-blur-xl border border-white/10 rounded-full px-4 py-3 flex items-center gap-3 max-w-[430px]">
          <button onClick={() => setMuted((m) => !m)} className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? "bg-destructive" : "bg-white text-foreground"}`}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
          <button onClick={() => setMusicOn((m) => !m)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">{musicOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><UserPlus size={18} /></button>
          <button onClick={endLive} className="px-4 h-12 rounded-full bg-destructive text-white text-[12px] font-medium">End mehfil</button>
        </div>
      </div>
    </div>
  );
}

function SpeakerCard({ userId, role, speaking }: { userId: string; role: string; speaking: boolean }) {
  const { data: u } = useUser(userId);
  if (!u) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {speaking && <div className="absolute inset-0 rounded-full border-2 border-terracotta" style={{ animation: "mh-ring 1.6s ease-out infinite" }} />}
        <img src={u.avatarUrl} alt="" className="relative w-16 h-16 rounded-full object-cover border-2 border-white/40" />
      </div>
      <div className="text-[11px]">{u.displayName.split(" ")[0]}</div>
      <div className="text-[8px] uppercase tracking-[0.18em] opacity-60">{role}</div>
    </div>
  );
}

function RequestRow({ userId, onAccept }: { userId: string; onAccept: () => void }) {
  const { data: u } = useUser(userId);
  if (!u) return null;
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
      <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{u.displayName}</div>
        <div className="text-[10px] opacity-60 flex items-center gap-1"><Hand size={10} /> wants to speak</div>
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onAccept} className="px-3 py-1.5 rounded-full bg-sage text-white text-[11px]">Invite</motion.button>
    </div>
  );
}
