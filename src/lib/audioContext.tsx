import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioTrack {
  postId: string;
  title: string;
  audioUrl: string;
  coverUrl?: string;
  authorName?: string;
  kind: "voice" | "reel";
  durationSec?: number;
  /** Optional tags from post (e.g. mehfil-replay) for lightweight analytics */
  tags?: string[];
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
  const fadeRafRef = useRef<number | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const trackRef = useRef<AudioTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCT] = useState(0);
  const [duration, setDur] = useState(0);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  const cancelFade = () => {
    if (fadeRafRef.current != null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  };

  // Create a single audio element for the app lifetime
  useEffect(() => {
    const el = new Audio();
    elRef.current = el;
    const onEnded = () => {
      cancelFade();
      const t = trackRef.current;
      if (el) el.volume = 1;
      setPlaying(false);
      if (t?.kind === "reel") trackEvent("reel_complete", { post_id: t.postId });
    };
    const onTU = () => setCT(el.currentTime);
    const onMeta = () => setDur(isFinite(el.duration) ? el.duration : 0);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTU);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      cancelFade();
      el.pause();
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTU);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const play = useCallback((t: AudioTrack) => {
    const el = elRef.current;
    if (!el || !t.audioUrl) return;
    cancelFade();
    if (el.src !== t.audioUrl) { el.src = t.audioUrl; el.load(); }
    el.volume = 0;
    void el.play().catch(() => {});
    setTrack(t);
    setPlaying(true);
    if (t.durationSec) setDur(t.durationSec);
    const start = performance.now();
    const fadeIn = (now: number) => {
      const p = Math.min(1, (now - start) / 400);
      el.volume = p;
      if (p < 1) fadeRafRef.current = requestAnimationFrame(fadeIn);
      else fadeRafRef.current = null;
    };
    fadeRafRef.current = requestAnimationFrame(fadeIn);
  }, []);

  const pause = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    cancelFade();
    const start = performance.now();
    const fadeOut = (now: number) => {
      const p = Math.max(0, 1 - (now - start) / 290);
      el.volume = p;
      if (p > 0.04) fadeRafRef.current = requestAnimationFrame(fadeOut);
      else {
        el.pause();
        fadeRafRef.current = null;
        el.volume = 1;
        setPlaying(false);
      }
    };
    fadeRafRef.current = requestAnimationFrame(fadeOut);
  }, []);

  const toggle = useCallback(() => {
    const el = elRef.current;
    if (!el || !track) return;
    if (playing) pause();
    else {
      cancelFade();
      el.volume = 0;
      void el.play().catch(() => {});
      setPlaying(true);
      const start = performance.now();
      const fadeIn = (now: number) => {
        const p = Math.min(1, (now - start) / 360);
        el.volume = p;
        if (p < 1) fadeRafRef.current = requestAnimationFrame(fadeIn);
        else fadeRafRef.current = null;
      };
      fadeRafRef.current = requestAnimationFrame(fadeIn);
    }
  }, [playing, pause, track]);

  const seek = useCallback((pct: number) => {
    const el = elRef.current;
    if (el && duration > 0) el.currentTime = (pct / 100) * duration;
  }, [duration]);

  const dismiss = useCallback(() => {
    cancelFade();
    const el = elRef.current;
    if (el) {
      el.pause();
      el.src = "";
      el.volume = 1;
    }
    setTrack(null); setPlaying(false); setCT(0); setDur(0);
  }, []);

  const progressPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <Ctx.Provider value={{ track, playing, currentTime, duration, progressPct, play, pause, toggle, seek, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}
