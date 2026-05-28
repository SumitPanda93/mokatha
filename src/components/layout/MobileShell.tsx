import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Plus, MessageCircle, User, Radio, Play, Pause, X, Mic, ChevronDown,
  Pen, Video, BookOpen, Mic2, X as XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/lib/audioContext";
import { SHEET_SPRING } from "@/lib/motionTokens";
import { useNotificationsRealtime, useUnreadMessageCount } from "@/lib/store";
import { FEED_BG, FEED_BORDER, FEED_GOLD, FEED_MUTED } from "@/components/feed/home-feed-ui";

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ─── Listening Mode ────────────────────────────────────────────────────────────

function ListeningMode({ onClose }: { onClose: () => void }) {
  const { track, playing, progressPct, currentTime, duration, toggle, seek, dismiss } = useAudioPlayer();
  if (!track) return null;

  const totalSec = duration || track.durationSec || 0;
  const hasGlow = !!track.coverUrl;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={SHEET_SPRING}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
    >
      {hasGlow ? (
        <>
          <div className="absolute inset-0">
            <img src={track.coverUrl} alt="" className="w-full h-full object-cover scale-110" />
          </div>
          <div className="absolute inset-0" style={{ backdropFilter: "blur(48px) saturate(1.4)", background: "rgba(0,0,0,0.62)" }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1C0F06 0%, #2E1A0C 40%, #1A0D18 80%, #0E0A18 100%)" }} />
      )}

      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--ochre)), transparent 70%)", filter: "blur(60px)" }} />

      <div className="relative flex flex-col h-full px-6 pt-safe-top pb-safe-bottom" style={{ paddingTop: "max(env(safe-area-inset-top), 40px)", paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <ChevronDown size={20} className="text-white" />
          </button>
          <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-white/50">
            {track.kind === "voice" ? "Voice" : "Reel"}
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex items-center justify-center py-4">
          <motion.div animate={{ scale: playing ? 1 : 0.94 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
            {track.coverUrl ? (
              <div className="w-[220px] h-[220px] rounded-3xl overflow-hidden"
                style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] rounded-3xl flex flex-col items-center justify-center gap-3"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
                <Mic size={40} className="text-ochre/80" />
                <div className="flex items-end gap-[3px] h-6">
                  {[0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.5, 0.7, 0.4, 0.8].map((_, i) => (
                    <div key={i} className="w-[2.5px] rounded-full bg-ochre/60"
                      style={{ animation: playing ? `feed-bar ${0.7 + (i % 4) * 0.15}s ease-in-out infinite ${i * 0.07}s` : "none", height: "30%" }} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <div className="mb-6">
          <div className="font-['Playfair_Display'] text-[24px] text-white leading-tight italic line-clamp-2 mb-1">
            {track.title}
          </div>
          <div className="text-[13px] text-white/55 font-['Inter']">{track.authorName}</div>
        </div>

        <div
          className="h-1.5 rounded-full overflow-hidden mb-2 cursor-pointer active:scale-y-150 transition-transform"
          style={{ background: "rgba(255,255,255,0.18)" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - rect.left) / rect.width) * 100);
          }}
        >
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/40 font-['Inter'] mb-8">
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(totalSec)}</span>
        </div>

        <div className="flex items-center justify-center">
          <motion.button whileTap={{ scale: 0.92 }} onClick={toggle}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
            {playing
              ? <Pause size={26} style={{ color: "#1C0F06" }} />
              : <Play size={26} fill="#1C0F06" style={{ color: "#1C0F06", marginLeft: 3 }} />}
          </motion.button>
        </div>

        <button onClick={() => { dismiss(); onClose(); }}
          className="mt-6 py-3 text-[12px] font-['Inter'] text-white/30 hover:text-white/60 transition-colors text-center">
          Close player
        </button>
      </div>
    </motion.div>
  );
}

// ─── Mini Player ──────────────────────────────────────────────────────────────

function MiniPlayer({ onExpand, immersive }: { onExpand: () => void; immersive?: boolean }) {
  const { track, playing, progressPct, toggle, dismiss } = useAudioPlayer();
  if (!track) return null;

  const bottomOffset = immersive
    ? "calc(14px + env(safe-area-inset-bottom))"
    : "calc(72px + max(env(safe-area-inset-bottom), 0px) + 8px)";

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="fixed left-2 right-2 z-40"
      style={{ bottom: bottomOffset }}
    >
      <div className="rounded-2xl overflow-hidden bg-background border border-border/70"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)" }}>
        <div className="h-[2px]" style={{ background: "hsl(var(--border))" }}>
          <motion.div className="h-full bg-terracotta" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer" onClick={onExpand}>
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1C0F06, #2E1A0C)" }}>
              <Mic size={14} className="text-ochre" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-['Playfair_Display'] leading-tight line-clamp-1">{track.title}</div>
            <div className="text-[10px] text-muted-foreground font-['Inter'] mt-0.5">{track.authorName}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center active:scale-90 transition-transform"
            >
              {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Create Sheet ─────────────────────────────────────────────────────────────

const CREATE_ACTIONS = [
  { id: "voice",   emoji: "🎙️",  label: "Voice Post",  sublabel: "Record audio",      path: "/create/voice",   color: "#F76A4A" },
  { id: "story",   emoji: "✍️",  label: "Write Story", sublabel: "Text or poetry",    path: "/create/story",   color: "#C9A84C" },
  { id: "reel",    emoji: "📹",  label: "Share Reel",  sublabel: "Short video/audio", path: "/create/reel",    color: "#9B59B6" },
  { id: "mehfil",  emoji: "🎤",  label: "Start Mehfil",sublabel: "Live voice room",   path: "/mehfil/host/new",color: "#2ECC71" },
];

function CreateSheet({ onClose, navigate }: { onClose: () => void; navigate: (path: string) => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
      />

      {/* Sheet — tighter spring for snappier feel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.95 }}
        className="relative rounded-t-[32px] bg-background/96 backdrop-blur-2xl border-t border-border/60 px-5 pt-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}
      >
        {/* Drag handle */}
        <div className="w-10 h-[3px] rounded-full bg-border/80 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-['Playfair_Display'] text-[23px] leading-none">Create</div>
            <div className="text-[11px] text-muted-foreground font-['Inter'] mt-1 tracking-[0.02em]">
              What will you make today?
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center mt-0.5">
            <XIcon size={13} className="text-muted-foreground" />
          </motion.button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2">
          {CREATE_ACTIONS.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: "spring", damping: 20, stiffness: 260 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { onClose(); navigate(a.path); }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:opacity-80 transition-opacity"
              style={{ background: `${a.color}0E`, border: `1px solid ${a.color}25` }}
            >
              <span className="text-[26px] leading-none shrink-0">{a.emoji}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-['Inter'] font-semibold text-foreground leading-tight">{a.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{a.sublabel}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface MobileShellProps { children: React.ReactNode }

export default function MobileShell({ children }: MobileShellProps) {
  useNotificationsRealtime();
  const { data: inboxBadge = 0 } = useUnreadMessageCount();
  const [location, navigate] = useLocation();
  const [listeningMode, setListeningMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { track } = useAudioPlayer();

  const immersiveReels = location.startsWith("/reels");

  const navItems = [
    { id: "home",     label: "Home",     path: "/",         icon: Home },
    { id: "mehfil",   label: "Mehfils",  path: "/mehfil",   icon: Radio },
    { id: "create",   label: "Create",   path: "",          icon: Plus, isCreate: true },
    { id: "messages", label: "Inbox",    path: "/messages", icon: MessageCircle, badge: inboxBadge },
    { id: "profile",  label: "Profile",  path: "/me",       icon: User },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/home";
    if (path === "/me") return location.startsWith("/me") || location.startsWith("/settings");
    return path !== "" && location.startsWith(path);
  };

  // Nav height = 72px content + safe-area. Content needs matching bottom padding.
  const navContentHeight = 72;
  const bottomPad = immersiveReels
    ? `calc(${track ? "76px + " : ""}max(env(safe-area-inset-bottom), 10px))`
    : `calc(${navContentHeight}px + ${track ? "76px + " : ""}max(env(safe-area-inset-bottom), 8px))`;

  return (
    <div className="w-full bg-background text-foreground" style={{ minHeight: "100dvh" }}>
      {/* Main content — bottom padding accounts for fixed nav + optional mini player */}
      <div style={{ paddingBottom: bottomPad }}>
        {children}
      </div>

      {/* Mini player — fixed, floats above nav */}
      <AnimatePresence>
        {track && <MiniPlayer immersive={immersiveReels} onExpand={() => setListeningMode(true)} />}
      </AnimatePresence>

      {/* Fixed bottom nav */}
      {!immersiveReels && (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          background: "rgba(10,8,6,0.96)",
          borderTop: `1px solid ${FEED_BORDER}`,
        }}
      >
        <div className="flex justify-between items-center px-5 pt-3 pb-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            if (item.isCreate) {
              return (
                <button key={item.id} type="button" onClick={() => navigate("/create")}>
                  <div className="relative -top-5">
                    <motion.div
                      whileTap={{ scale: 0.88 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${FEED_GOLD}, #E8B14A)`,
                        boxShadow: "0 12px 32px rgba(201,168,76,0.35)",
                      }}
                    >
                      <Plus size={26} className="text-[#0A0806]" strokeWidth={2.25} />
                    </motion.div>
                  </div>
                </button>
              );
            }
            const badge = "badge" in item ? item.badge : 0;
            return (
              <Link key={item.id} href={item.path}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-colors relative"
                  style={{ color: active ? FEED_GOLD : FEED_MUTED }}
                >
                  <div className="relative">
                    <item.icon size={22} strokeWidth={active ? 2.25 : 1.5} style={{ color: active ? FEED_GOLD : FEED_MUTED }} />
                    {badge > 0 && item.id === "messages" && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full text-[7px] font-bold font-['Inter'] flex items-center justify-center leading-none"
                        style={{ background: FEED_GOLD, color: FEED_BG }}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] font-['Inter'] tracking-[0.05em] ${active ? "font-semibold" : ""}`} style={{ color: active ? FEED_GOLD : FEED_MUTED }}>
                    {item.label}
                  </span>
                  {active && <motion.div layoutId="nav-dot" className="w-1 h-1 rounded-full" style={{ background: FEED_GOLD }} />}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      {/* Create sheet */}
      {!immersiveReels && (
      <AnimatePresence>
        {createOpen && (
          <CreateSheet
            onClose={() => setCreateOpen(false)}
            navigate={(path) => { navigate(path); }}
          />
        )}
      </AnimatePresence>
      )}

      {/* Listening Mode overlay */}
      <AnimatePresence>
        {listeningMode && track && (
          <ListeningMode onClose={() => setListeningMode(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
