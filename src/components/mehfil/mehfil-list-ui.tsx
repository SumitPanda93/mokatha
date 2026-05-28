import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Archive, ArchiveRestore, Clock, Mic, MoreVertical, Play, RotateCcw, Trash2, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mehfil,
  useUser,
  useDeleteMehfil,
  useArchiveMehfil,
  useRestoreMehfilFeedVisibility,
  useMehfilListeners,
  isMehfilDiscoveryExpired,
  getCurrentUserId,
} from "@/lib/store";
import {
  FEED_BG, FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_PURPLE, FEED_PURPLE_SOFT, FEED_TEXT,
  formatFeedStat, MoKathaWordmark,
} from "@/components/feed/home-feed-ui";

export {
  FEED_BG, FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_PURPLE, FEED_PURPLE_SOFT, FEED_TEXT,
  MoKathaWordmark,
};

export const MEHFIL_TABS = ["For You", "Explore", "My Mehfils", "History"] as const;
export type MehfilTab = (typeof MEHFIL_TABS)[number];

export const MEHFIL_CATEGORIES = ["All Mehfils", "Music", "Spiritual", "Talks", "Open Mic"] as const;
export type MehfilCategory = (typeof MEHFIL_CATEGORIES)[number];

export function isMehfilUpcoming(m: Mehfil): boolean {
  return !m.isLive && !m.archived && new Date(m.startsAt) > new Date();
}

export function isMehfilEnded(m: Mehfil): boolean {
  if (m.isLive || m.archived) return false;
  if (m.endedAt) return true;
  if (isMehfilDiscoveryExpired(m)) return true;
  return new Date(m.startsAt) <= new Date();
}

export function matchesMehfilCategory(m: Mehfil, cat: MehfilCategory): boolean {
  if (cat === "All Mehfils") return true;
  const tags = (m.tags ?? []).map((t) => t.toLowerCase());
  switch (cat) {
    case "Music":
      return tags.some((t) => /music|ghazal|singing|song|raag|sangeet/.test(t));
    case "Spiritual":
      return tags.some((t) => /spiritual|bhajan|kirtan|devotional|mantra|puja/.test(t));
    case "Talks":
      return tags.some((t) => /talk|discussion|podcast|debate|storytelling/.test(t));
    case "Open Mic":
      return tags.some((t) => /open.?mic|openmic|open-mic|mic/.test(t));
    default:
      return true;
  }
}

export function entryLabel(m: Mehfil): string {
  if (m.isTicketed && (m.ticketPrice ?? 0) > 0) return `₹${m.ticketPrice} entry`;
  return "Tip based entry";
}

function ListenerAvatar({ userId }: { userId: string }) {
  const { data: user } = useUser(userId);
  if (!user?.avatarUrl) {
    return (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] border-2"
        style={{ borderColor: FEED_BG, background: "rgba(255,255,255,0.08)" }}
      >
        ?
      </div>
    );
  }
  return (
    <img
      src={user.avatarUrl}
      alt=""
      className="w-6 h-6 rounded-full object-cover border-2"
      style={{ borderColor: FEED_BG }}
    />
  );
}

export function MehfilListenerStack({ mehfilId, hostId, size = "sm" }: { mehfilId: string; hostId: string; size?: "sm" | "md" }) {
  const { data: listenerIds = [] } = useMehfilListeners(mehfilId);
  const ids = listenerIds.length > 0 ? listenerIds : [hostId];
  const shown = ids.slice(0, 4);
  const dim = size === "md" ? "w-7 h-7" : "w-6 h-6";

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-2">
        {shown.map((id) => (
          <div key={id} className={dim}>
            <ListenerAvatar userId={id} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HostMenu({ m, onClose }: { m: Mehfil; onClose: () => void }) {
  const del = useDeleteMehfil();
  const arch = useArchiveMehfil();
  const restoreFeed = useRestoreMehfilFeedVisibility();
  const expired = isMehfilDiscoveryExpired(m);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute top-8 right-0 z-30 min-w-[168px] rounded-xl overflow-hidden shadow-xl"
      style={{ background: "#141010", border: `1px solid ${FEED_BORDER}` }}
      onClick={(e) => e.stopPropagation()}
    >
      {expired && !m.isLive ? (
        <button
          type="button"
          onClick={() => { restoreFeed.mutate(m.id); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-white/5 text-left"
        >
          <RotateCcw size={14} className="text-emerald-400" /> Show on feed 24h
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => { arch.mutate({ id: m.id, archived: !m.archived }); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-white/5 text-left"
      >
        {m.archived
          ? <><ArchiveRestore size={14} className="text-emerald-400" /> Restore</>
          : <><Archive size={14} style={{ color: FEED_GOLD }} /> Archive</>}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this Mehfil? This cannot be undone.")) {
            del.mutate(m.id);
            onClose();
          }
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] text-red-400 hover:bg-red-500/10 text-left border-t"
        style={{ borderColor: FEED_BORDER }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </motion.div>
  );
}

export function HeroCarousel({ liveMehfils }: { liveMehfils: Mehfil[] }) {
  const [idx, setIdx] = useState(0);
  const m = liveMehfils[idx];
  const { data: host } = useUser(m?.hostId ?? "");

  if (!m) return null;

  return (
    <div className="relative mb-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={m.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl overflow-hidden border relative"
          style={{
            background: `linear-gradient(145deg, ${FEED_PURPLE_SOFT} 0%, rgba(10,8,6,0.98) 55%)`,
            borderColor: FEED_BORDER,
          }}
        >
          <div className="relative h-[180px]">
            {m.coverUrl ? (
              <img src={m.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(10,8,6,0.95) 0%, rgba(10,8,6,0.35) 60%, transparent 100%)" }}
            />
            <span
              className="absolute top-3 left-3 flex items-center gap-1.5 text-[9px] font-['Inter'] font-bold uppercase tracking-[0.14em] text-white rounded-full px-2.5 py-1"
              style={{ background: "rgba(239,68,68,0.9)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live now
            </span>
          </div>

          <div className="px-4 pb-4 -mt-10 relative">
            <h2 className="font-['Playfair_Display'] text-[20px] leading-tight mb-1 line-clamp-2" style={{ color: FEED_TEXT }}>
              {m.title}
            </h2>
            {m.description ? (
              <p className="text-[11px] font-['Inter'] line-clamp-2 mb-3" style={{ color: FEED_MUTED }}>
                {m.description}
              </p>
            ) : host?.displayName ? (
              <p className="text-[11px] font-['Inter'] mb-3" style={{ color: FEED_MUTED }}>
                Hosted by {host.displayName}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <MehfilListenerStack mehfilId={m.id} hostId={m.hostId} size="md" />
                <span className="text-[10px] font-['Inter'] shrink-0" style={{ color: FEED_MUTED }}>
                  {formatFeedStat(m.listeners)} listening
                </span>
              </div>
              <span className="text-[10px] font-['Inter'] shrink-0" style={{ color: FEED_GOLD }}>
                {entryLabel(m)}
              </span>
            </div>

            <Link
              href={`/mehfil/${m.id}`}
              className="block w-full py-3 rounded-xl text-center text-[13px] font-['Inter'] font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ background: `linear-gradient(135deg, ${FEED_PURPLE}, #7D3C98)`, boxShadow: `0 8px 24px ${FEED_PURPLE_SOFT}` }}
            >
              Join Live
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {liveMehfils.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {liveMehfils.map((lm, i) => (
            <button
              key={lm.id}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                background: i === idx ? FEED_GOLD : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function UpcomingMehfilCard({ m }: { m: Mehfil }) {
  const { data: host } = useUser(m.hostId);
  const startsAt = new Date(m.startsAt);
  const dateStr = startsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const timeStr = startsAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <Link
      href={`/mehfil/${m.id}`}
      className="shrink-0 w-[200px] rounded-2xl overflow-hidden border active:scale-[0.98] transition-transform"
      style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
    >
      <div className="relative h-[96px]">
        {m.coverUrl ? (
          <img src={m.coverUrl} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1C0F06, #2A1528)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }} />
        <span
          className="absolute top-2 left-2 flex items-center gap-1 text-[8px] font-['Inter'] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
          style={{ background: "rgba(201,168,76,0.9)", color: FEED_BG }}
        >
          <Clock size={8} />
          {dateStr}
        </span>
        <span className="absolute bottom-2 left-2 text-[9px] font-['Inter'] text-white/70">{timeStr}</span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          {host?.avatarUrl ? (
            <img src={host.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border" style={{ borderColor: FEED_BORDER }} />
          ) : (
            <div className="w-5 h-5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          )}
          <span className="text-[9px] font-['Inter'] truncate" style={{ color: FEED_MUTED }}>{host?.displayName ?? "Host"}</span>
        </div>
        <div className="text-[13px] font-['Playfair_Display'] line-clamp-2 leading-snug mb-2">{m.title}</div>
        <div className="flex items-center justify-between gap-2">
          <MehfilListenerStack mehfilId={m.id} hostId={m.hostId} />
          <span className="text-[9px] font-['Inter'] shrink-0" style={{ color: FEED_GOLD }}>{entryLabel(m)}</span>
        </div>
      </div>
    </Link>
  );
}

export function TrendingMehfilCard({ m }: { m: Mehfil }) {
  const { data: host } = useUser(m.hostId);

  return (
    <Link
      href={`/mehfil/${m.id}`}
      className="shrink-0 w-[148px] rounded-xl overflow-hidden border active:scale-[0.98] transition-transform"
      style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
    >
      <div className="relative h-[80px]">
        {m.coverUrl ? (
          <img src={m.coverUrl} alt="" className="w-full h-full object-cover opacity-75" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1A0F14, #2A1528)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }} />
        {m.isLive && (
          <span className="absolute top-2 left-2 text-[7px] font-bold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded-full">
            Live
          </span>
        )}
        <div
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
        >
          <Play size={12} fill="white" className="text-white ml-0.5" />
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-[11px] font-['Playfair_Display'] line-clamp-2 leading-snug mb-1">{m.title}</div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-['Inter'] truncate" style={{ color: FEED_MUTED }}>
            {m.isLive ? `${formatFeedStat(m.listeners)} listening` : host?.displayName ?? "Host"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function HostMehfilRow({ m }: { m: Mehfil }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const me = getCurrentUserId();
  const isHost = !!me && me === m.hostId;
  const startsAt = new Date(m.startsAt);
  const statusLabel = m.isLive ? "Live" : m.archived ? "Archived" : isMehfilEnded(m) ? "Ended" : "Upcoming";

  return (
    <div
      className="relative flex items-center gap-3 p-3 rounded-xl border"
      style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
    >
      <Link href={`/mehfil/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:opacity-80">
        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
          {m.coverUrl ? (
            <img src={m.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Mic size={18} style={{ color: FEED_GOLD }} />
            </div>
          )}
          {m.isLive && (
            <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-['Playfair_Display'] line-clamp-1">{m.title}</div>
          <div className="text-[10px] font-['Inter'] mt-0.5" style={{ color: FEED_MUTED }}>
            {statusLabel} · {startsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            {m.isLive ? ` · ${formatFeedStat(m.listeners)} listening` : ""}
          </div>
        </div>
      </Link>
      {isHost && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)" }}
            aria-label="Host menu"
          >
            <MoreVertical size={14} style={{ color: FEED_MUTED }} />
          </button>
          <AnimatePresence>
            {menuOpen && <HostMenu m={m} onClose={() => setMenuOpen(false)} />}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function HistoryMehfilRow({ m }: { m: Mehfil }) {
  const ended = m.endedAt ? new Date(m.endedAt) : new Date(m.startsAt);
  const expired = isMehfilDiscoveryExpired(m);

  return (
    <Link
      href={`/mehfil/${m.id}`}
      className="flex items-center gap-3 p-3 rounded-xl border active:opacity-80"
      style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 opacity-70">
        {m.coverUrl ? (
          <img src={m.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <Users size={16} style={{ color: FEED_MUTED }} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-['Playfair_Display'] line-clamp-1">{m.title}</div>
        <div className="text-[10px] font-['Inter'] mt-0.5" style={{ color: FEED_MUTED }}>
          Ended {ended.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
          {expired ? " · Off discovery" : ""}
        </div>
      </div>
    </Link>
  );
}

export function CreateMehfilBanner() {
  return (
    <div
      className="rounded-2xl p-5 border relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(155,89,182,0.14) 100%)`,
        borderColor: FEED_BORDER,
      }}
    >
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(155,89,182,0.25), transparent 70%)", filter: "blur(24px)" }}
      />
      <div className="relative">
        <div className="font-['Playfair_Display'] text-[18px] mb-1">Create Your Own Mehfil</div>
        <p className="text-[11px] font-['Inter'] mb-4 leading-relaxed" style={{ color: FEED_MUTED }}>
          Open a live voice room. Share stories, ghazals, or open mic — your circle awaits.
        </p>
        <Link
          href="/mehfil/host/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-['Inter'] font-semibold active:scale-95 transition-transform"
          style={{ background: `linear-gradient(90deg, ${FEED_GOLD}, #E8B14A)`, color: FEED_BG }}
        >
          <Mic size={14} />
          Start Mehfil
        </Link>
      </div>
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-3" style={{ color: FEED_MUTED }}>
      {children}
    </h2>
  );
}
