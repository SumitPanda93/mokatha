/**
 * Reels — vertical video-first fullscreen feed (native <video>, no voice-post coupling).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, MessageCircle, Pause, Play, Volume2, VolumeX, Share2,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useFeed, Post, useLike, useUser } from "@/lib/store";
import { EASE_CINEMA } from "@/lib/motionTokens";

function ReelItem({
  post,
  active,
  index,
  muted,
  onToggleMute,
}: {
  post: Post;
  active: boolean;
  index: number;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const primaryVideo = Boolean(post.videoUrl);
  const legacyAudio = !primaryVideo && Boolean(post.audioUrl);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (primaryVideo && v) {
      v.muted = muted;
      if (active) void v.play().catch(() => {});
      else {
        v.pause();
        v.currentTime = 0;
      }
    }
    if (legacyAudio && a) {
      if (active) {
        void a.play().catch(() => {});
      } else {
        a.pause();
        a.currentTime = 0;
      }
    }
  }, [active, primaryVideo, legacyAudio, muted, post.id]);

  const ambient =
    !post.coverUrl && !primaryVideo
      ? "linear-gradient(165deg, #0e0717 0%, #1a0f2e 42%, #0a1020 72%, #120a1c 100%)"
      : undefined;

  return (
    <motion.div
      data-reel-slide
      data-reel-index={index}
      className="relative min-h-[100dvh] w-full snap-start snap-always shrink-0 overflow-hidden bg-black"
      style={{ scrollSnapStop: "always" }}
      initial={false}
      animate={{ opacity: active ? 1 : 0.78, scale: active ? 1 : 0.985 }}
      transition={{ duration: 0.55, ease: EASE_CINEMA }}
    >
      {primaryVideo ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          poster={post.coverUrl || undefined}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          loop
          preload={index < 2 ? "auto" : "metadata"}
        />
      ) : legacyAudio ? (
        <>
          {post.coverUrl ? (
            <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" decoding="async" />
          ) : (
            <div className="absolute inset-0" style={{ background: ambient }} />
          )}
          <audio ref={audioRef} src={post.audioUrl} preload="auto" />
        </>
      ) : post.coverUrl ? (
        <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" decoding="async" />
      ) : (
        <div className="absolute inset-0" style={{ background: ambient }} />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 35%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <div className="absolute top-[max(env(safe-area-inset-top),12px)] right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onToggleMute}
          className="w-11 h-11 rounded-full backdrop-blur-md bg-black/35 border border-white/15 flex items-center justify-center"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
        </motion.button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-[max(env(safe-area-inset-bottom),28px)] pt-16 flex flex-col justify-end pointer-events-none">
        <div className="pointer-events-auto space-y-4">
          <div className="flex items-center gap-3">
            {author?.avatarUrl ? (
              <img src={author.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-white/20" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-white truncate font-['Inter']">{author?.displayName ?? "Creator"}</div>
              {author?.handle ? (
                <Link href={`/u/${author.handle}`} className="text-[11px] text-white/45 font-['Inter']">
                  @{author.handle}
                </Link>
              ) : null}
            </div>
          </div>

          <h2 className="font-['Playfair_Display'] text-[26px] leading-[1.15] text-white italic max-w-[95%]" style={{ textShadow: "0 4px 28px rgba(0,0,0,0.55)" }}>
            {post.title}
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => like.mutate()}
              className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border border-white/15 bg-black/30 text-white text-[12px] font-['Inter']">
              <Heart size={16} fill={post.liked ? "currentColor" : "none"} /> {post.likes}
            </motion.button>
            <Link href={`/post/${post.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border border-white/15 bg-black/28 text-white/90 text-[12px] font-['Inter']">
              <MessageCircle size={16} /> {post.comments}
            </Link>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                const url = `${window.location.origin}/reels?focus=${post.id}`;
                void navigator.share?.({ title: post.title, url }).catch(() => {
                  void navigator.clipboard.writeText(url);
                });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border border-white/15 bg-black/28 text-white/85 text-[12px] font-['Inter'] ml-auto"
            >
              <Share2 size={15} /> Share
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReelsVideoPage() {
  useTitle("Reels");
  const [, setLocation] = useLocation();
  const { data: posts = [], isLoading, refetch, isFetching } = useFeed();
  const reels = useMemo(() => posts.filter((p) => p.kind === "reel"), [posts]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  const activeSafe = reels.length > 0 ? Math.min(active, reels.length - 1) : 0;
  const activePost = reels[activeSafe];

  useEffect(() => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("focus") : null;
    if (!q || reels.length === 0) return;
    const ix = reels.findIndex((p) => p.id === q);
    if (ix < 0) return;
    setActive(ix);
    requestAnimationFrame(() => {
      containerRef.current?.querySelector(`[data-reel-index="${ix}"]`)?.scrollIntoView({ block: "start" });
    });
  }, [reels]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return;
    const slides = root.querySelectorAll<HTMLElement>("[data-reel-slide]");
    const obs = new IntersectionObserver(
      (entries) => {
        let best = -1;
        let bestR = 0;
        for (const e of entries) {
          if (e.intersectionRatio < 0.42) continue;
          const i = Number.parseInt(e.target.getAttribute("data-reel-index") ?? "", 10);
          if (!Number.isFinite(i)) continue;
          if (e.intersectionRatio > bestR) {
            bestR = e.intersectionRatio;
            best = i;
          }
        }
        if (best >= 0) setActive(best);
      },
      { root, threshold: [0.42, 0.55, 0.68, 0.8, 0.92], rootMargin: "0px 0px -8% 0px" },
    );
    slides.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length]);

  useEffect(() => {
    if (reels.length > 0 && active !== activeSafe) setActive(activeSafe);
  }, [reels.length, active, activeSafe]);

  const nextMedia = useMemo(() => {
    for (let j = activeSafe + 1; j < reels.length; j++) {
      const r = reels[j];
      if (r.videoUrl) return { type: "video" as const, url: r.videoUrl };
      if (r.audioUrl) return { type: "audio" as const, url: r.audioUrl };
    }
    return null;
  }, [reels, activeSafe]);

  useEffect(() => {
    if (!nextMedia) return;
    if (nextMedia.type === "video") {
      const v = document.createElement("link");
      v.rel = "preload";
      v.as = "video";
      v.href = nextMedia.url;
      document.head.appendChild(v);
      return () => {
        document.head.removeChild(v);
      };
    }
    const a = new Audio();
    a.preload = "auto";
    a.src = nextMedia.url;
    return () => {
      a.src = "";
    };
  }, [nextMedia]);

  useEffect(() => {
    reels.slice(activeSafe + 1, activeSafe + 3).forEach((p) => {
      if (!p.coverUrl) return;
      const img = new Image();
      img.decoding = "async";
      img.src = p.coverUrl;
    });
  }, [reels, activeSafe]);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const slide = containerRef.current?.querySelector(`[data-reel-index="${activeSafe}"]`);
    const vid = slide?.querySelector("video");
    const aud = slide?.querySelector("audio");
    const el = vid ?? aud;
    if (!el) {
      setProgress(0);
      return;
    }
    const onTime = () => {
      const d = (el as HTMLMediaElement).duration;
      const t = (el as HTMLMediaElement).currentTime;
      setProgress(d > 0 && Number.isFinite(d) ? (t / d) * 100 : 0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onTime);
    };
  }, [activeSafe, activePost?.id]);

  const togglePlayback = useCallback(() => {
    const slide = containerRef.current?.querySelector(`[data-reel-index="${activeSafe}"]`);
    const vid = slide?.querySelector("video") as HTMLVideoElement | null;
    const aud = slide?.querySelector("audio") as HTMLAudioElement | null;
    const el = vid ?? aud;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, [activeSafe]);

  const [pausedLocal, setPausedLocal] = useState(false);
  useEffect(() => {
    const slide = containerRef.current?.querySelector(`[data-reel-index="${activeSafe}"]`);
    const el = slide?.querySelector("video, audio") as HTMLMediaElement | null;
    if (!el) return;
    const onPlay = () => setPausedLocal(false);
    const onPause = () => setPausedLocal(true);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    setPausedLocal(el.paused);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [activeSafe, activePost?.id]);

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white relative">
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2 pointer-events-none">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => setLocation("/")}
          className="pointer-events-auto w-10 h-10 rounded-full backdrop-blur-md border border-white/12 bg-black/30 flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <span className="text-[10px] font-['Inter'] tracking-[0.38em] uppercase text-white/35 pointer-events-none">Reels</span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => void refetch()}
          className="pointer-events-auto text-[11px] font-['Inter'] tracking-[0.14em] uppercase text-white/45 px-3 py-2 rounded-full border border-white/12 bg-black/30"
        >
          {isFetching ? "…" : "Refresh"}
        </motion.button>
      </header>

      {progress > 0 && (
        <div className="fixed top-[max(env(safe-area-inset-top),52px)] left-4 right-4 z-30 h-[3px] rounded-full bg-white/10 overflow-hidden pointer-events-none">
          <motion.div className="h-full bg-white/75 rounded-full" style={{ width: `${progress}%` }} transition={{ duration: 0.12 }} />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4">
          <div className="w-9 h-9 rounded-full border-2 border-[rgba(201,168,76,0.45)] border-t-transparent animate-spin" />
          <p className="text-[13px] font-['Playfair_Display'] italic text-white/40">Opening reels…</p>
        </div>
      )}

      {!isLoading && reels.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 text-center pb-24">
          <p className="font-['Playfair_Display'] text-[22px] text-white/88 mb-3">Still frames ahead</p>
          <p className="text-[13px] font-['Inter'] text-white/45 leading-relaxed max-w-sm mb-8">
            Vertical stories will gather here — calm, full-screen, one breath at a time.
          </p>
          <button type="button" onClick={() => setLocation("/")} className="text-[12px] tracking-[0.12em] uppercase text-[#c9a84c] border border-[#c9a84c]/35 rounded-full px-6 py-2.5">
            Home
          </button>
        </div>
      )}

      {!isLoading && reels.length > 0 && (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={togglePlayback}
            className="fixed bottom-[max(env(safe-area-inset-bottom),100px)] left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full backdrop-blur-lg bg-black/45 border border-white/18 flex items-center justify-center pointer-events-auto"
            aria-label={pausedLocal ? "Play" : "Pause"}
          >
            {pausedLocal ? <Play size={22} className="text-white ml-0.5" fill="white" /> : <Pause size={22} className="text-white" />}
          </motion.button>

          <div
            ref={containerRef}
            className="h-[100dvh] overflow-y-auto overscroll-y-contain snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {reels.map((p, i) => (
              <ReelItem
                key={p.id}
                post={p}
                active={i === activeSafe}
                index={i}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
