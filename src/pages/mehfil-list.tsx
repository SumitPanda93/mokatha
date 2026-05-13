import { useState } from "react";
import { Link } from "wouter";
import { Radio, Mic, Plus, Users, Clock, MoreVertical, Trash2, Archive, ArchiveRestore, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import { useMehfils, useUser, useDeleteMehfil, useArchiveMehfil, useMehfilRealtime, getCurrentUserId } from "@/lib/store";

// ─── Creator menu ─────────────────────────────────────────────────────────────

function CreatorMenu({ mehfilId, archived, onClose }: { mehfilId: string; archived?: boolean; onClose: () => void }) {
  const del = useDeleteMehfil();
  const arch = useArchiveMehfil();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute top-9 right-0 z-30 min-w-[160px] rounded-xl bg-background border border-border shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { arch.mutate({ id: mehfilId, archived: !archived }); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] text-foreground hover:bg-muted/50 transition-colors"
      >
        {archived
          ? <><ArchiveRestore size={14} className="text-sage" /> Restore</>
          : <><Archive size={14} className="text-ochre" /> Archive</>}
      </button>
      <div className="border-t border-border/50" />
      <button
        onClick={() => {
          if (confirm("Delete this Mehfil? This cannot be undone.")) {
            del.mutate(mehfilId);
            onClose();
          }
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 size={14} /> Delete
      </button>
    </motion.div>
  );
}

// ─── Mehfil card ─────────────────────────────────────────────────────────────

function MehfilCard({ m, index }: { m: any; index: number }) {
  const { data: host } = useUser(m.hostId);
  const [menuOpen, setMenuOpen] = useState(false);
  const me = getCurrentUserId();
  const isHost = !!me && me === m.hostId;
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
      <div className="relative rounded-2xl overflow-hidden cursor-pointer group">
        <Link href={`/mehfil/${m.id}`} className="block">
          {/* Cover image */}
          <img src={m.coverUrl} alt="" className="w-full h-[160px] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />
        </Link>

        {/* Live badge */}
        {m.isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-destructive/90 backdrop-blur-sm text-white text-[10px] font-['Inter'] font-bold tracking-[0.1em] rounded-full px-2.5 py-1 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
        {isUpcoming && !m.isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-ochre/90 backdrop-blur-sm text-white text-[10px] font-['Inter'] font-bold tracking-[0.1em] rounded-full px-2.5 py-1 pointer-events-none">
            <Clock size={10} />
            {dateStr} · {timeStr}
          </div>
        )}

        {/* Ticketed badge */}
        {m.isTicketed && (m.ticketPrice ?? 0) > 0 && (
          <div className="absolute top-3 left-3 mt-7 flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white/80 text-[9px] font-['Inter'] tracking-[0.12em] rounded-full px-2 py-1 pointer-events-none"
            style={{ top: m.isLive || (!m.isLive && new Date(m.startsAt) > new Date()) ? 36 : 12 }}>
            <Ticket size={9} />
            ₹{m.ticketPrice}
          </div>
        )}

        {/* Language + creator menu */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <div className="bg-black/50 backdrop-blur-sm text-white/80 text-[9px] font-['Inter'] tracking-[0.15em] uppercase rounded-full px-2 py-1">
            {m.language === "or" ? "Odia" : "Hindi"}
          </div>
          {isHost && (
            <div className="relative">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((p) => !p); }}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <MoreVertical size={13} className="text-white" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <CreatorMenu mehfilId={m.id} archived={m.archived} onClose={() => setMenuOpen(false)} />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom info */}
        <Link href={`/mehfil/${m.id}`} className="block absolute bottom-0 left-0 right-0 p-4">
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
        </Link>
      </div>

      {/* Tags */}
      {m.tags?.length > 0 && (
        <div className="flex gap-1.5 mt-2 ml-1 flex-wrap">
          {m.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-[10px] font-['Inter'] text-muted-foreground border border-border/50 rounded-full px-2 py-0.5">#{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MehfilList() {
  useTitle("Mehfil");
  useMehfilRealtime();
  const { data: mehfils = [] } = useMehfils();
  const [tab, setTab] = useState<"all" | "live" | "upcoming">("all");

  const live = mehfils.filter((m) => m.isLive);
  const upcoming = mehfils.filter((m) => !m.isLive && !m.archived);
  const displayed = tab === "all" ? mehfils.filter((m) => !m.archived) : tab === "live" ? live : upcoming;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-center sticky top-0 z-20 bg-background/92 backdrop-blur-md border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-terracotta" />
            <span className="text-[18px] font-['Playfair_Display'] text-foreground">Mehfil</span>
          </div>
          <div className="text-[10px] font-['Inter'] text-muted-foreground mt-0.5">Live salons &amp; gatherings</div>
        </div>
        <Link href="/mehfil/host/new">
          <div className="flex items-center gap-1.5 bg-terracotta text-white text-[12px] font-['Inter'] font-medium rounded-full px-3.5 py-1.5 active:scale-95 transition-transform">
            <Plus size={13} />
            Host
          </div>
        </Link>
      </div>

      {/* Tabs — underline style matching feed */}
      <div className="relative border-b border-border/40">
        <div className="flex px-4">
          {([
            ["all", "All"],
            ["live", live.length ? `Live · ${live.length}` : "Live"],
            ["upcoming", "Upcoming"],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative shrink-0 px-4 py-3 text-[12px] font-['Inter'] transition-colors whitespace-nowrap ${
                tab === id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              {label}
              {tab === id && (
                <motion.div layoutId="mehfil-tab-line" className="absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full bg-terracotta"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live banner */}
      {live.length > 0 && tab !== "upcoming" && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, hsl(var(--terracotta)/0.12), hsl(var(--ochre)/0.06))", border: "1px solid hsl(var(--terracotta)/0.2)" }}>
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
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Radio size={24} className="text-muted-foreground" />
            </div>
            <div className="font-['Playfair_Display'] text-[18px] mb-2">No gatherings scheduled</div>
            <div className="text-[13px] text-muted-foreground leading-relaxed mb-6">
              When someone opens a Mehfil, a circle forms.<br />Host one — let the room hear you.
            </div>
            <Link href="/mehfil/host/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-['Inter'] font-medium bg-foreground text-background">
              <Mic size={14} /> Host a Mehfil
            </Link>
          </div>
        ) : (
          displayed.map((m, i) => <MehfilCard key={m.id} m={m} index={i} />)
        )}
      </div>
    </div>
  );
}
