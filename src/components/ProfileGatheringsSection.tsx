import { useState } from "react";
import { Link } from "wouter";
import { Radio, MoreVertical, Archive, ArchiveRestore, Trash2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useArchiveMehfil,
  useDeleteMehfil,
  useRestoreMehfilFeedVisibility,
  useMehfilsForHost,
  getCurrentUserId,
  isMehfilDiscoveryExpired,
  type Mehfil,
} from "@/lib/store";

function GatheringHostMenu({
  m,
  onClose,
}: {
  m: Mehfil;
  onClose: () => void;
}) {
  const del = useDeleteMehfil();
  const arch = useArchiveMehfil();
  const restoreFeed = useRestoreMehfilFeedVisibility();
  const expired = isMehfilDiscoveryExpired(m);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute top-8 right-0 z-30 min-w-[168px] rounded-xl bg-background border border-border shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {expired && !m.isLive ? (
        <button
          type="button"
          onClick={() => { restoreFeed.mutate(m.id); onClose(); }}
          disabled={restoreFeed.isPending}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-muted/50 transition-colors text-left"
        >
          <RotateCcw size={14} className="text-sage" /> Show on feed 24h
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => { arch.mutate({ id: m.id, archived: !m.archived }); onClose(); }}
        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-muted/50 transition-colors text-left ${expired && !m.isLive ? "border-t border-border/40" : ""}`}
      >
        {m.archived ? (
          <><ArchiveRestore size={14} className="text-sage" /> Restore archive</>
        ) : (
          <><Archive size={14} className="text-ochre" /> Archive</>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this gathering? Replays stay in posts unless removed separately.")) {
            del.mutate(m.id);
            onClose();
          }
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] text-destructive hover:bg-destructive/10 transition-colors text-left border-t border-border/40"
      >
        <Trash2 size={14} /> Delete
      </button>
    </motion.div>
  );
}

function GatheringRow({ m }: { m: Mehfil }) {
  const me = getCurrentUserId();
  const isOwn = !!me && me === m.hostId;
  const [menuOpen, setMenuOpen] = useState(false);
  const expiredOffFeed = isMehfilDiscoveryExpired(m);

  const statusLabel = m.isLive
    ? "Live"
    : m.archived
      ? "Archived"
      : expiredOffFeed
        ? "Library"
        : "Ended";

  const statusCls = m.isLive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-muted-foreground";

  return (
    <div className="relative flex items-center gap-3 py-3 border-b border-border/35 last:border-0">
      <Link href={`/mehfil/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:opacity-80">
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-muted ring-1 ring-black/[0.04]">
          {m.coverUrl ? (
            <img src={m.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              <Radio size={16} className="text-muted-foreground/70" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-['Playfair_Display'] text-[15px] leading-snug truncate">{m.title}</div>
          <div className={`text-[10px] font-['Inter'] uppercase tracking-[0.16em] mt-0.5 ${statusCls}`}>{statusLabel}</div>
        </div>
      </Link>
      {isOwn && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
            aria-label="Gathering options"
          >
            <MoreVertical size={15} className="text-muted-foreground" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <GatheringHostMenu m={m} onClose={() => setMenuOpen(false)} />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** Full gathering history for a host — includes sessions hidden from global discovery. */
export function ProfileGatheringsSection({ hostId, forVisitor }: { hostId: string; forVisitor?: boolean }) {
  const { data: list = [] } = useMehfilsForHost(hostId);
  if (list.length === 0) return null;

  return (
    <div className="mx-5 mb-6 rounded-2xl border border-border/40 bg-card/35 backdrop-blur-[2px] px-4 pt-4 pb-2">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[10px] font-['Inter'] uppercase tracking-[0.22em] text-muted-foreground">Gatherings</div>
        <Link href="/mehfil" className="text-[10px] font-['Inter'] text-muted-foreground/80 hover:text-foreground transition-colors">
          Discover
        </Link>
      </div>
      <p className="text-[11px] font-['Inter'] text-muted-foreground/70 mb-3 leading-relaxed">
        {forVisitor ? "Hosted salons from this creator." : "Salon history stays here after it leaves the public Mehfil list."}
      </p>
      <div>
        {list.map((m) => (
          <GatheringRow key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
