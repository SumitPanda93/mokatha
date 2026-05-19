/**
 * Reels — vertical video-first fullscreen feed (native <video>, no voice-post coupling).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, MessageCircle, Pause, Play, Volume2, VolumeX, Share2, Lock,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useFeed, Post, useLike, useUser,
  getCurrentUserId,
  useIsPostUnlocked,
  useIsSubscribedTo,
  useUnlockPostWithTip,
  useUnlockPostWithPoints,
  useSubscribeToAuthor,
  useAuthorPlan,
  useInkReward,
} from "@/lib/store";
import { EASE_CINEMA } from "@/lib/motionTokens";

function parseReelTrim(tags: string[] | undefined): { start: number; end: number } | null {
  const raw = tags?.find((t) => t.startsWith("trim:"));
  if (!raw) return null;
  const body = raw.slice("trim:".length);
  const [a, b] = body.split(":");
  const start = Number(a);
  const end = Number(b);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.15) return null;
  return { start: Math.max(0, start), end };
}

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
  const me = getCurrentUserId() ?? "";
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const { data: tipOk = false } = useIsPostUnlocked(me, post.id);
  const { data: subbed = false } = useIsSubscribedTo(me, post.authorId);
  const unlockTip = useUnlockPostWithTip();
  const unlockPts = useUnlockPostWithPoints();
  const subscribeMut = useSubscribeToAuthor();
  const { data: plan } = useAuthorPlan(post.authorId);
  const { data: ink } = useInkReward(me);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const primaryVideo = Boolean(post.videoUrl);
  const legacyAudio = !primaryVideo && Boolean(post.audioUrl);
  const trim = useMemo(() => parseReelTrim(post.tags), [post.tags]);

  const isAuthor = post.authorId === me;
  const tipLocked = !isAuthor && post.accessType === "tip" && !tipOk;
  const premiumLocked = !isAuthor && post.accessType === "premium" && !subbed;
  const locked = tipLocked || premiumLocked;

  const hasPts = (ink?.points ?? 0) >= 50;

  const [videoSilent, setVideoSilent] = useState(false);
  const [progPct, setProgPct] = useState(0);
  const [localPaused, setLocalPaused] = useState(false);

  const toggleCenterPlay = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    const el = primaryVideo ? v : legacyAudio ? a : null;
    if (!el || locked) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, [primaryVideo, legacyAudio, locked]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !primaryVideo) {
      setVideoSilent(false);
      return;
    }
    const detect = () => {
      type VT = HTMLVideoElement & { audioTracks?: { length: number }; mozHasAudio?: boolean };
      const el = v as VT;
      if (el.audioTracks && typeof el.audioTracks.length === "number") {
        setVideoSilent(el.audioTracks.length === 0);
      } else if (typeof el.mozHasAudio === "boolean") {
        setVideoSilent(!el.mozHasAudio);
      } else {
        setVideoSilent(false);
      }
    };
    v.addEventListener("loadedmetadata", detect);
    return () => v.removeEventListener("loadedmetadata", detect);
  }, [primaryVideo, post.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !trim || !primaryVideo) return;
    const onTime = () => {
      if (v.currentTime >= trim.end - 0.06) v.currentTime = trim.start;
    };
    const onMeta = () => {
      if (v.currentTime < trim.start) v.currentTime = trim.start;
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [trim, primaryVideo, post.id]);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (locked) {
      if (v) {
        v.pause();
        try {
          v.currentTime = trim?.start ?? 0;
        } catch {
          /* ignore */
        }
      }
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
      return;
    }
    if (primaryVideo && v) {
      v.muted = muted;
      if (trim && active) {
        if (v.currentTime < trim.start || v.currentTime >= trim.end) v.currentTime = trim.start;
      }
      if (active) void v.play().catch(() => {});
      else {
        v.pause();
        v.currentTime = trim?.start ?? 0;
      }
    }
    if (legacyAudio && a) {
      if (active) void a.play().catch(() => {});
      else {
        a.pause();
        a.currentTime = 0;
      }
    }
  }, [active, primaryVideo, legacyAudio, muted, post.id, locked, trim]);

  useEffect(() => {
    if (!active || locked) {
      setProgPct(0);
      return;
    }
    const v = videoRef.current;
    const a = audioRef.current;
    const el = primaryVideo ? v : legacyAudio ? a : null;
    if (!el) {
      setProgPct(0);
      return;
    }
    const onTime = () => {
      const d = el.duration;
      const t = el.currentTime;
      setProgPct(d > 0 && Number.isFinite(d) ? (t / d) * 100 : 0);
    };
    const syncPause = () => setLocalPaused(el.paused);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onTime);
    el.addEventListener("play", syncPause);
    el.addEventListener("pause", syncPause);
    syncPause();
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onTime);
      el.removeEventListener("play", syncPause);
      el.removeEventListener("pause", syncPause);
    };
  }, [active, locked, primaryVideo, legacyAudio, post.id]);

  const ambient =
    !post.coverUrl && !primaryVideo
      ? "linear-gradient(165deg, #0e0717 0%, #1a0f2e 42%, #0a1020 72%, #120a1c 100%)"
      : undefined;

  const tipAmounts = Array.from(new Set([post.minTip ?? 10, (post.minTip ?? 10) * 2, (post.minTip ?? 10) * 5, 100])).slice(0, 4);

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
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.06) 28%, transparent 44%, transparent 58%, rgba(0,0,0,0.35) 74%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* TOP — creator identity only */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+46px)] left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-auto">
        {author?.handle ? (
          <Link href={`/u/${author.handle}`} className="flex items-center gap-2.5 min-w-0 rounded-full pr-2 py-1 pl-1 bg-black/28 backdrop-blur-md border border-white/[0.09]">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-white/12 bg-white/10">
              {author?.avatarUrl ? <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="min-w-0 text-left">
              <div className="text-[13px] font-['Playfair_Display'] text-white leading-tight truncate max-w-[52vw]">{author?.displayName ?? "Creator"}</div>
              <div className="text-[8px] font-['Inter'] uppercase tracking-[0.32em] text-white/38">Reel</div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 rounded-full pr-2 py-1 pl-1 bg-black/28 backdrop-blur-md border border-white/[0.09]">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-white/12 bg-white/10" />
            <div className="min-w-0 text-left">
              <div className="text-[13px] font-['Playfair_Display'] text-white leading-tight truncate max-w-[52vw]">{author?.displayName ?? "Creator"}</div>
              <div className="text-[8px] font-['Inter'] uppercase tracking-[0.32em] text-white/38">Reel</div>
            </div>
          </div>
        )}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onToggleMute}
            disabled={locked || (!primaryVideo && !legacyAudio)}
            className="w-10 h-10 rounded-full backdrop-blur-md bg-black/38 border border-white/12 flex items-center justify-center disabled:opacity-35"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={17} className="text-white/95" /> : <Volume2 size={17} className="text-white/95" />}
          </motion.button>
          {primaryVideo && videoSilent && !locked ? (
            <span className="text-[7px] font-['Inter'] tracking-[0.28em] uppercase text-white/22">visual</span>
          ) : null}
        </div>
      </div>

      {/* CENTER — floating transport (no typography overlap) */}
      {active && !locked && (primaryVideo || legacyAudio) ? (
        <div className="absolute inset-0 z-[26] flex items-center justify-center pointer-events-none">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={toggleCenterPlay}
            className="pointer-events-auto w-[72px] h-[72px] rounded-full backdrop-blur-xl bg-black/38 border border-white/16 flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            aria-label={localPaused ? "Play" : "Pause"}
          >
            {localPaused ? <Play size={28} className="text-white ml-1" fill="white" /> : <Pause size={28} className="text-white" />}
          </motion.button>
        </div>
      ) : null}

      {locked && (
        <div className="absolute inset-0 z-[28] flex flex-col items-center justify-center px-7 pointer-events-none">
          <div className="pointer-events-auto relative w-full max-w-[308px] rounded-[22px] border border-white/[0.11] bg-black/50 px-6 py-8 text-center backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <Lock className="mx-auto mb-4 text-white/50" size={26} strokeWidth={1.25} />
            <p className="font-['Playfair_Display'] text-[21px] text-white/95 mb-2 leading-snug line-clamp-3">{post.title}</p>
            {tipLocked ? (
              <>
                <p className="text-[12px] font-['Inter'] text-white/42 mb-5 leading-relaxed">
                  Tip to unlock · from ₹{post.minTip ?? 10}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {tipAmounts.map((v: number) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => unlockTip.mutate({ postId: post.id, amount: v })}
                      disabled={unlockTip.isPending}
                      className="py-2.5 rounded-xl border border-white/18 text-white/90 text-[13px] font-['Inter'] hover:bg-white/[0.06] transition-colors disabled:opacity-45"
                    >
                      ₹{v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/35 mb-3 font-['Inter']">
                  <div className="flex-1 h-px bg-white/12" />or<div className="flex-1 h-px bg-white/12" />
                </div>
                <button
                  type="button"
                  onClick={() => unlockPts.mutate(post.id)}
                  disabled={!hasPts || unlockPts.isPending}
                  className={`w-full py-2.5 rounded-xl text-[13px] font-['Inter'] border transition-colors ${hasPts ? "border-violet-400/45 text-violet-100 hover:bg-violet-500/10" : "border-white/10 text-white/35 opacity-50 cursor-not-allowed"}`}
                >
                  50 Ink Points {!hasPts && `· you have ${ink?.points ?? 0}`}
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] font-['Inter'] text-white/42 mb-6 leading-relaxed">
                  This reel is for subscribers of {author?.displayName ?? "this creator"}.
                </p>
                <button
                  type="button"
                  onClick={() => subscribeMut.mutate(post.authorId)}
                  disabled={!plan?.enabled || subscribeMut.isPending}
                  className="w-full py-3 rounded-xl bg-white text-black text-[13px] font-['Inter'] font-medium disabled:opacity-40"
                >
                  {plan?.enabled ? `Subscribe · ₹${plan.priceMonthly}/mo` : "Plan not available"}
                </button>
                {author?.handle ? (
                  <Link href={`/u/${author.handle}`} className="mt-4 inline-block text-[12px] text-white/45 font-['Inter']">
                    View profile
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div
          className="pointer-events-none h-32"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)",
          }}
        />
        <div className={`px-5 pb-[max(env(safe-area-inset-bottom),22px)] pt-0 -mt-20 pointer-events-auto ${locked ? "opacity-38" : ""}`}>
          <h2 className="font-['Playfair_Display'] text-[21px] md:text-[22px] leading-snug text-white max-w-[96%]" style={{ textShadow: "0 6px 32px rgba(0,0,0,0.65)" }}>
            {post.title}
          </h2>
          {post.body?.trim() ? (
            <p className="mt-2 text-[12px] font-['Inter'] text-white/42 leading-relaxed line-clamp-2 max-w-[92%]">{post.body.trim()}</p>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap mt-4">
            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => like.mutate()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/12 bg-black/22 text-white text-[11px] font-['Inter']">
              <Heart size={15} fill={post.liked ? "currentColor" : "none"} /> {post.likes}
            </motion.button>
            <Link href={`/post/${post.id}`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/12 bg-black/18 text-white/88 text-[11px] font-['Inter']">
              <MessageCircle size={15} /> {post.comments}
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/12 bg-black/16 text-white/80 text-[11px] font-['Inter'] ml-auto"
            >
              <Share2 size={14} /> Share
            </motion.button>
          </div>

          {active && !locked && (primaryVideo || legacyAudio) ? (
            <div className="mt-4 h-[2px] rounded-full bg-white/[0.09] overflow-hidden">
              <motion.div className="h-full rounded-full bg-white/[0.42]" style={{ width: `${progPct}%` }} transition={{ duration: 0.08 }} />
            </div>
          ) : null}
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

  useEffect(() => {
    return () => {
      const root = containerRef.current;
      if (!root) return;
      root.querySelectorAll("video, audio").forEach((el) => {
        try {
          (el as HTMLMediaElement).pause();
          if (el instanceof HTMLMediaElement) el.removeAttribute("src");
        } catch {
          /* ignore */
        }
      });
    };
  }, []);

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
