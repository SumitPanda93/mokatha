import { Link } from "wouter";
import { motion } from "framer-motion";
import { Radio, Users, Eye, AlertTriangle } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useMehfils, useUser, useEndMehfil, useInvalidate } from "@/lib/store";
import { toast } from "sonner";

export default function AdminLive() {
  useTitle("Admin · Live mehfils");
  const { data: mehfils = [] } = useMehfils();
  const live = mehfils.filter((m) => m.isLive);
  const upcoming = mehfils.filter((m) => !m.isLive && m.startsAt && +new Date(m.startsAt) > Date.now());
  const past = mehfils.filter((m) => !m.isLive && (!m.startsAt || +new Date(m.startsAt) <= Date.now()));
  const invalidate = useInvalidate();

  return (
    <AdminShell>
      <div className="font-['Playfair_Display'] text-[28px] mb-1">Live mehfils</div>
      <div className="text-[12px] text-[#A0A0A0] mb-7">{live.length} on air · {upcoming.length} scheduled · {past.length} past</div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Live now", value: live.length, color: "text-destructive", dot: true },
          { label: "Scheduled", value: upcoming.length, color: "text-ochre" },
          { label: "Total listeners", value: live.reduce((s, m) => s + m.listeners, 0).toLocaleString(), color: "text-sage" },
        ].map((s) => (
          <div key={s.label} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              {s.dot && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">{s.label}</span>
            </div>
            <div className={`font-['Playfair_Display'] text-[28px] ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-3">
          <span>On air</span><span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {live.map((m) => <LiveCard key={m.id} m={m} onEnd={invalidate} />)}
          {live.length === 0 && <div className="col-span-2 bg-[#141414] border border-[#2A2A2A] rounded-2xl p-10 text-center text-[#A0A0A0]">Nothing live right now.</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-3">Scheduled</div>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
            {upcoming.map((m) => <ScheduledRow key={m.id} m={m} />)}
            {upcoming.length === 0 && <div className="p-8 text-center text-[#A0A0A0]">Nothing scheduled.</div>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-3">Past</div>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
            {past.map((m) => <PastRow key={m.id} m={m} />)}
            {past.length === 0 && <div className="p-8 text-center text-[#A0A0A0]">No past mehfils logged.</div>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function LiveCard({ m, onEnd }: { m: any; onEnd: () => void }) {
  const { data: host } = useUser(m.hostId);
  const endMehfil = useEndMehfil();
  const handleEnd = () => {
    endMehfil.mutate(m.id, { onSuccess: () => { toast.success(`"${m.title}" ended`); onEnd(); } });
  };
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-[#1A0F14] to-[#2A1018] border border-destructive/40 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <img src={m.coverUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
        <div className="flex-1">
          <div className="font-['Playfair_Display'] text-[17px]">{m.title}</div>
          <div className="text-[11px] text-[#A0A0A0]">hosted by {host?.displayName}</div>
        </div>
        <span className="px-2 py-0.5 rounded-sm bg-destructive text-white text-[9px] uppercase tracking-[0.18em]">Live</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-4 bg-[#0F0F0F]/60 rounded-xl p-3">
        <Stat v={m.listeners} l="listeners" /><Stat v={m.language === "or" ? "Odia" : "Hindi"} l="language" /><Stat v={m.tags.length} l="tags" />
      </div>
      <div className="flex gap-2">
        <Link href={`/mehfil/${m.id}`} className="flex-1 py-2 rounded-lg border border-[#444] text-[11px] flex items-center justify-center gap-1 hover:border-[#6BAE8A] hover:text-[#6BAE8A] transition-colors">
          <Eye size={11} /> Listen in
        </Link>
        <button onClick={handleEnd} disabled={endMehfil.isPending} className="flex-1 py-2 rounded-lg bg-destructive/80 hover:bg-destructive text-white text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50">
          <AlertTriangle size={11} /> {endMehfil.isPending ? "Ending…" : "End room"}
        </button>
      </div>
    </motion.div>
  );
}

function ScheduledRow({ m }: { m: any }) {
  const { data: host } = useUser(m.hostId);
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#1A1A1A] transition-colors">
      <img src={host?.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{m.title}</div>
        <div className="text-[10px] text-[#A0A0A0]">{host?.displayName} · {new Date(m.startsAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="flex items-center gap-1 text-[#A0A0A0]"><Users size={11} /><span className="text-[11px]">0</span></div>
    </div>
  );
}

function PastRow({ m }: { m: any }) {
  const { data: host } = useUser(m.hostId);
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#1A1A1A] transition-colors">
      <img src={host?.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{m.title}</div>
        <div className="text-[10px] text-[#A0A0A0]">{host?.displayName} · {new Date(m.startsAt).toLocaleDateString()}</div>
      </div>
      <span className="text-[10px] text-[#A0A0A0]">{m.listeners} peak</span>
    </div>
  );
}

function Stat({ v, l }: { v: any; l: string }) {
  return <div><div className="text-[16px] font-['Playfair_Display'] text-[#F5F3EF]">{v}</div><div className="text-[9px] uppercase tracking-[0.18em] text-[#A0A0A0]">{l}</div></div>;
}
