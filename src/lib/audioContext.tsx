import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioTrack {
  postId: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  authorName?: string;
  kind: "voice" | "reel";
  durationSec?: number;
}

interface AudioCtxValue {
  track: AudioTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  progressPct: number;
  play: (t: AudioTrack) => void;
  pause: () => void;
  toggle: () => void;
  seek: (pct: number) => void;
  dismiss: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<AudioCtxValue | null>(null);

export function useAudioPlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAudioPlayer must be inside AudioProvider");
  return v;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCT] = useState(0);
  const [duration, setDur] = useState(0);

  // Create a single audio element for the app lifetime
  useEffect(() => {
    const el = new Audio();
    elRef.current = el;
    const onEnded = () => setPlaying(false);
    const onTU = () => setCT(el.currentTime);
    const onMeta = () => setDur(isFinite(el.duration) ? el.duration : 0);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTU);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.pause();
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTU);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const play = useCallback((t: AudioTrack) => {
    const el = elRef.current;
    if (!el || !t.audioUrl) return;
    if (el.src !== t.audioUrl) { el.src = t.audioUrl; el.load(); }
    el.play().catch(() => {});
    setTrack(t);
    setPlaying(true);
    if (t.durationSec) setDur(t.durationSec);
  }, []);

  const pause = useCallback(() => {
    elRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) { elRef.current?.pause(); setPlaying(false); }
    else { elRef.current?.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  const seek = useCallback((pct: number) => {
    const el = elRef.current;
    if (el && duration > 0) el.currentTime = (pct / 100) * duration;
  }, [duration]);

  const dismiss = useCallback(() => {
    const el = elRef.current;
    if (el) { el.pause(); el.src = ""; }
    setTrack(null); setPlaying(false); setCT(0); setDur(0);
  }, []);

  const progressPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <Ctx.Provider value={{ track, playing, currentTime, duration, progressPct, play, pause, toggle, seek, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}
