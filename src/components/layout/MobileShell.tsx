import React, { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Home, Plus, MessageCircle, User, Radio, Play, Pause, X, Mic, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/lib/audioContext";

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ─── Listening Mode (full-screen ambient overlay) ─────────────────────────────

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
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
    >
      {/* Ambient background */}
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

      {/* Subtle ambient glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--ochre)), transparent 70%)", filter: "blur(60px)" }} />

      {/* Content */}
      <div className="relative flex flex-col h-full px-6 pt-10 pb-8 safe-top safe-bottom">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <ChevronDown size={20} className="text-white" />
          </button>
          <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-white/50">
            {track.kind === "voice" ? "Voice" : "Reel"}
          </div>
          <div className="w-10" />
        </div>

        {/* Cover art */}
        <div className="flex-1 flex items-center justify-center py-4">
          <motion.div
            animate={{ scale: playing ? 1 : 0.94 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            {track.coverUrl ? (
              <div className="w-[220px] h-[220px] rounded-3xl overflow-hidden"
                style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] rounded-3xl flex flex-col items-center justify-center gap-3"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
                <Mic size={40} className="text-ochre/80" />
                {/* Equalizer bars */}
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

        {/* Track info */}
        <div className="mb-6">
          <div className="font-['Playfair_Display'] text-[24px] text-white leading-tight italic line-clamp-2 mb-1">
            {track.title}
          </div>
          <div className="text-[13px] text-white/55 font-['Inter']">{track.authorName}</div>
        </div>

        {/* Seekable progress bar */}
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

        {/* Controls */}
        <div className="flex items-center justify-center">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={toggle}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
          >
            {playing
              ? <Pause size={26} style={{ color: "#1C0F06" }} />
              : <Play size={26} fill="#1C0F06" style={{ color: "#1C0F06", marginLeft: 3 }} />
            }
          </motion.button>
        </div>

        {/* Dismiss player */}
        <button onClick={() => { dismiss(); onClose(); }}
          className="mt-6 py-3 text-[12px] font-['Inter'] text-white/30 hover:text-white/60 transition-colors text-center">
          Close player
        </button>
      </div>
    </motion.div>
  );
}

// ─── Mini Player ──────────────────────────────────────────────────────────────

function MiniPlayer({ onExpand }: { onExpand: () => void }) {
  const { track, playing, progressPct, toggle, dismiss } = useAudioPlayer();
  if (!track) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="absolute bottom-[70px] left-2 right-2 z-40"
    >
      <div className="rounded-2xl overflow-hidden bg-background border border-border/70"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)" }}>
        {/* Thin progress bar at top */}
        <div className="h-[2px]" style={{ background: "hsl(var(--border))" }}>
          <motion.div className="h-full bg-terracotta" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer" onClick={onExpand}>
          {/* Cover */}
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1C0F06, #2E1A0C)" }}>
              <Mic size={14} className="text-ochre" />
            </div>
          )}

          {/* Title + author */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-['Playfair_Display'] leading-tight line-clamp-1">{track.title}</div>
            <div className="text-[10px] text-muted-foreground font-['Inter'] mt-0.5">{track.authorName}</div>
          </div>

          {/* Controls */}
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

// ─── Shell ────────────────────────────────────────────────────────────────────

interface MobileShellProps { children: React.ReactNode }

export default function MobileShell({ children }: MobileShellProps) {
  const [location] = useLocation();
  const [listeningMode, setListeningMode] = useState(false);
  const { track } = useAudioPlayer();

  const navItems = [
    { id: "home",     label: "Home",     path: "/",         icon: Home },
    { id: "mehfil",   label: "Mehfil",   path: "/mehfil",   icon: Radio },
    { id: "create",   label: "Create",   path: "/create",   icon: Plus, isCreate: true },
    { id: "messages", label: "Messages", path: "/messages", icon: MessageCircle },
    { id: "profile",  label: "Profile",  path: "/me",       icon: User },
  ];

  const isActive = (path: string) =>
    path === "/" ? location === "/" || location === "/home" : location.startsWith(path);

  return (
    <div className="w-full h-full flex flex-col relative bg-background text-foreground">
      {/* Main content — extra bottom padding when mini-player is shown */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar transition-[padding] ${track ? "pb-36" : "pb-24"}`}>
        {children}
      </div>

      {/* Mini player — sits above bottom nav */}
      <AnimatePresence>
        {track && <MiniPlayer onExpand={() => setListeningMode(true)} />}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="absolute bottom-0 w-full bg-background/95 backdrop-blur-md border-t border-border z-50">
        <div className="flex justify-between items-center px-5 pt-3 pb-6">
          {navItems.map((item) => {
            const active = isActive(item.path);
            if (item.isCreate) {
              return (
                <Link key={item.id} href={item.path}>
                  <div className="relative -top-5">
                    <motion.div whileTap={{ scale: 0.88 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                      style={{ background: "linear-gradient(135deg, hsl(var(--terracotta)), hsl(var(--ochre)))", boxShadow: "0 12px 32px rgba(247,106,74,0.4)" }}>
                      <Plus size={26} className="text-white" strokeWidth={2} />
                    </motion.div>
                  </div>
                </Link>
              );
            }
            return (
              <Link key={item.id} href={item.path}>
                <motion.div whileTap={{ scale: 0.9 }}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${active ? "text-terracotta" : "text-muted-foreground"}`}>
                  <item.icon size={22} strokeWidth={active ? 2.25 : 1.5} className={active ? "text-terracotta" : ""} />
                  <span className={`text-[9px] font-['Inter'] tracking-[0.05em] ${active ? "font-semibold text-terracotta" : ""}`}>
                    {item.label}
                  </span>
                  {active && <motion.div layoutId="nav-dot" className="w-1 h-1 rounded-full bg-terracotta" />}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Listening Mode — full-screen overlay */}
      <AnimatePresence>
        {listeningMode && track && (
          <ListeningMode onClose={() => setListeningMode(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
