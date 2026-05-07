import { useState } from "react";
import { Link } from "wouter";
import { Radio, Mic, Plus, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import { useMehfils, useUser } from "@/lib/store";

function MehfilCard({ m, index }: { m: any; index: number }) {
  const { data: host } = useUser(m.hostId);
  const startsAt = new Date(m.startsAt);
  const isUpcoming = !m.isLive && startsAt > new Date();
  const timeStr = startsAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = startsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/mehfil/${m.id}`}>
        <div className="relative rounded-2xl overflow-hidden cursor-pointer group">
          {/* Cover image */}
          <img src={m.coverUrl} alt="" className="w-full h-[160px] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />

          {/* Live badge */}
          {m.isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-destructive/90 backdrop-blur-sm text-white text-[10px] font-['Inter'] font-bold tracking-[0.1em] rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          )}
          {isUpcoming && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-ochre/90 backdrop-blur-sm text-white text-[10px] font-['Inter'] font-bold tracking-[0.1em] rounded-full px-2.5 py-1">
              <Clock size={10} />
              {dateStr} · {timeStr}
            </div>
          )}

          {/* Language */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white/80 text-[9px] font-['Inter'] tracking-[0.15em] uppercase rounded-full px-2 py-1">
            {m.language === "or" ? "Odia" : "Hindi"}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="text-[16px] font-['Playfair_Display'] text-white leading-tight mb-1.5">{m.title}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {host && <img src={host.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30" />}
                <span className="text-[11px] font-['Inter'] text-white/70">{host?.displayName ?? "Host"}</span>
              </div>
              {m.isLive && (
                <div className="flex items-center gap-1 text-white/70">
                  <Users size={11} />
                  <span className="text-[11px] font-['Inter']">{m.listeners.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Tags */}
      {m.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 ml-1 flex-wrap">
          {m.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-[10px] font-['Inter'] text-muted-foreground border border-border rounded-full px-2 py-0.5">#{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function MehfilList() {
  useTitle("Mehfil");
  const { data: mehfils = [] } = useMehfils();
  const [tab, setTab] = useState<"all" | "live" | "upcoming">("all");

  const live = mehfils.filter((m) => m.isLive);
  const upcoming = mehfils.filter((m) => !m.isLive);
  const displayed = tab === "all" ? mehfils : tab === "live" ? live : upcoming;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-center sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-terracotta" />
            <span className="text-[18px] font-['Playfair_Display'] text-foreground">Mehfil</span>
          </div>
          <div className="text-[10px] font-['Inter'] text-muted-foreground mt-0.5">Live salons &amp; gatherings</div>
        </div>
        <Link href="/mehfil/host/new">
          <div className="flex items-center gap-1.5 bg-terracotta text-white text-[12px] font-['Inter'] font-medium rounded-full px-3 py-1.5">
            <Plus size={13} />
            Host
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4 flex gap-2">
        {([["all", "All"], ["live", `Live${live.length ? ` ${live.length}` : ""}`], ["upcoming", "Upcoming"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="text-[12px] font-['Inter'] rounded-full px-4 py-1.5 transition-all"
            style={{ background: tab === id ? "hsl(var(--foreground))" : "transparent", color: tab === id ? "hsl(var(--background))" : "hsl(var(--muted-foreground))", border: tab === id ? "none" : "1px solid hsl(var(--border))" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Live banner */}
      {live.length > 0 && tab !== "upcoming" && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "linear-gradient(135deg, hsl(var(--terracotta)/0.12), hsl(var(--ochre)/0.08))", border: "1px solid hsl(var(--terracotta)/0.2)" }}>
          <Mic size={16} className="text-terracotta shrink-0" />
          <div>
            <div className="text-[13px] font-['Inter'] font-medium text-foreground">{live.length} session{live.length > 1 ? "s" : ""} live right now</div>
            <div className="text-[11px] font-['Inter'] text-muted-foreground">{mehfils.reduce((s, m) => s + (m.isLive ? m.listeners : 0), 0).toLocaleString()} listening in total</div>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 px-5 pt-4 pb-28 space-y-5">
        {displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[14px] font-['Playfair_Display'] italic text-muted-foreground">No mehfils here yet</div>
            <Link href="/create/voice">
              <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-['Inter'] text-terracotta hover:underline">
                <Mic size={14} /> Start one now
              </div>
            </Link>
          </div>
        ) : (
          displayed.map((m, i) => <MehfilCard key={m.id} m={m} index={i} />)
        )}
      </div>
    </div>
  );
}
