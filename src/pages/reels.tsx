/**
 * Immersive vertical reel browse — Instagram-style snap scroll with Mo Katha mood.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Pause, Play } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useFeed, Post, useLike, useUser } from "@/lib/store";
import { useAudioPlayer } from "@/lib/audioContext";

function ReelSlide({
  post,
  active,
  index,
}: {
  post: Post;
  active: boolean;
  index: number;
}) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const ambientBg =
    post.coverUrl
      ? undefined
      : "linear-gradient(165deg, #0E0717 0%, #1A0F2E 42%, #0A1020 72%, #120A1C 100%)";

  return (
    <div
      data-reel-slide
      data-reel-index={index}
      className="relative min-h-[100dvh] w-full snap-start snap-always flex flex-col justify-end overflow-hidden shrink-0"
      style={{ scrollSnapStop: "always" }}
    >
      {post.coverUrl ? (
        <img
          src={post.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[1.03]"
          decoding="async"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: ambientBg }} />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 28%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.88) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(15,8,20,0.45) 0%, transparent 35%, transparent 65%, rgba(15,8,20,0.45) 100%)",
        }}
      />

      <motion.div
        className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[120%] h-[45%] rounded-[50%] opacity-40 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.35), transparent 70%)" }}
        animate={{ opacity: active ? 0.5 : 0.28 }}
        transition={{ duration: 1.2 }}
      />

      <div className="relative z-10 px-6 pb-28 pt-24 flex flex-col justify-end min-h-[100dvh]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-['Inter'] tracking-[0.32em] uppercase px-2.5 py-1 rounded-full backdrop-blur-md font-semibold"
            style={{ background: "rgba(155,89,182,0.55)", color: "rgba(255,255,255,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}>
            Reel
          </span>
          {active && (
            <span className="text-[9px] font-['Inter'] tracking-[0.22em] uppercase text-white/55">
              Now playing
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 mb-4">
          {author?.avatarUrl ? (
            <img
              src={author.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
              style={{ border: "1.5px solid rgba(255,255,255,0.22)" }}
              decoding="async"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15" />
          )}
          <div>
            <div className="text-[13px] font-['Inter'] text-white/90">{author?.displayName ?? "Creator"}</div>
            {author?.handle ? (
              <Link href={`/u/${author.handle}`} className="text-[11px] text-white/45 font-['Inter'] pointer-events-auto">
                Profile
              </Link>
            ) : (
              <span className="text-[11px] text-white/35 font-['Inter']">Creator</span>
            )}
          </div>
        </div>

        <h2 className="font-['Playfair_Display'] text-[26px] leading-[1.22] text-white italic mb-6 max-w-[95%]"
          style={{ textShadow: "0 3px 28px rgba(0,0,0,0.55)" }}>
          {post.title}
        </h2>

        <div className="flex items-center gap-3 pointer-events-auto">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => like.mutate()}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-['Inter'] backdrop-blur-md border ${post.liked ? "bg-white/18 border-white/25 text-white" : "bg-black/25 border-white/15 text-white/85"}`}
          >
            <Heart size={15} fill={post.liked ? "currentColor" : "none"} />
            {post.likes}
          </motion.button>
          <Link href={`/post/${post.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-['Inter'] bg-black/22 backdrop-blur-md border border-white/12 text-white/85">
            <MessageCircle size={15} />
            {post.comments}
          </Link>
          <Link href={`/post/${post.id}`}
            className="ml-auto text-[11px] font-['Inter'] tracking-[0.14em] uppercase text-white/50 px-3 py-2 rounded-full border border-white/10">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ReelsBrowse() {
  useTitle("Reels");
  const [, setLocation] = useLocation();
  const { data: posts = [], isLoading } = useFeed();
  const reels = useMemo(() => posts.filter((p) => p.kind === "reel" && p.audioUrl), [posts]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { play, pause, playing, track } = useAudioPlayer();

  useEffect(() => {
    return () => {
      pause();
    };
  }, [pause]);

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
        let bestIdx = -1;
        let bestRatio = 0;
        for (const e of entries) {
          const ratio = e.intersectionRatio;
          if (ratio < 0.45) continue;
          const i = Number.parseInt(e.target.getAttribute("data-reel-index") ?? "", 10);
          if (!Number.isFinite(i)) continue;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) setActive(bestIdx);
      },
      { root, threshold: [0.45, 0.6, 0.75, 0.9] },
    );
    slides.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length]);

  const activeSafe = reels.length > 0 ? Math.min(active, reels.length - 1) : 0;

  useEffect(() => {
    if (reels.length > 0 && active !== activeSafe) setActive(activeSafe);
  }, [reels.length, active, activeSafe]);

  const activePost = reels[activeSafe];

  useEffect(() => {
    if (!activePost?.audioUrl) return;
    play({
      postId: activePost.id,
      title: activePost.title,
      audioUrl: activePost.audioUrl,
      coverUrl: activePost.coverUrl,
      kind: "reel",
      durationSec: activePost.durationSec,
      tags: activePost.tags,
    });
  }, [activePost?.id, activePost?.audioUrl, play]);

  const isCurrentPlaying = playing && track?.postId === activePost?.id;

  return (
    <div className="min-h-[100dvh] w-full bg-[#07040A] text-white relative">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 bg-gradient-to-b from-black/55 to-transparent pointer-events-none"
      >
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/12 bg-black/25 active:scale-[0.96] transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-white/90" />
        </button>
        <span className="text-[10px] font-['Inter'] tracking-[0.38em] uppercase text-white/40 pointer-events-none">Reels</span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => (isCurrentPlaying ? pause() : activePost?.audioUrl && play({
            postId: activePost.id,
            title: activePost.title,
            audioUrl: activePost.audioUrl,
            coverUrl: activePost.coverUrl,
            kind: "reel",
            durationSec: activePost.durationSec,
            tags: activePost.tags,
          }))}
          className="pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/12 bg-black/25"
          aria-label={isCurrentPlaying ? "Pause" : "Play"}
        >
          {isCurrentPlaying ? <Pause size={17} className="text-white" /> : <Play size={17} className="text-white ml-0.5" fill="white" />}
        </motion.button>
      </header>

      {isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4 px-8 text-center">
          <div className="w-9 h-9 rounded-full border-2 border-[rgba(201,168,76,0.5)] border-t-transparent animate-spin" />
          <p className="text-[13px] font-['Playfair_Display'] italic text-white/45 leading-relaxed">
            Gathering reels…
          </p>
        </div>
      )}

      {!isLoading && reels.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 text-center pb-24">
          <div className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-5 backdrop-blur-md">
            <Play size={26} className="text-white/35 ml-1" />
          </div>
          <div className="font-['Playfair_Display'] text-[20px] text-white/90 mb-2 italic">The reel room is still</div>
          <p className="text-[13px] font-['Inter'] text-white/45 leading-relaxed max-w-xs">
            When short voices arrive, they will drift through here — calm, vertical, one breath at a time.
          </p>
          <button type="button" onClick={() => setLocation("/")} className="mt-8 text-[12px] font-['Inter'] tracking-[0.12em] uppercase text-[#C9A84C]/90 border border-[#C9A84C]/35 rounded-full px-6 py-2.5">
            Return home
          </button>
        </div>
      )}

      {!isLoading && reels.length > 0 && (
        <div
          ref={containerRef}
          className="h-[100dvh] overflow-y-auto overscroll-y-contain snap-y snap-mandatory no-scrollbar"
        >
          {reels.map((p, i) => (
            <ReelSlide key={p.id} post={p} active={i === activeSafe} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
