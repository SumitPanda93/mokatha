import { Link } from "wouter";
import {
  Play, Heart, MessageCircle, Lock, Mic, MoreHorizontal, BadgeCheck, PenLine,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getCurrentUserId, Post, Mehfil, useUser, useLike, useIsPostUnlocked,
} from "@/lib/store";
import {
  FEED_BG, FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_PURPLE, FEED_PURPLE_SOFT, FEED_TEXT,
  formatFeedStat, formatFeedTime, isNewPost, type FeedTile,
} from "./home-feed-ui";

const cardBase = "rounded-2xl overflow-hidden border";
const cardStyle = { background: FEED_CARD, borderColor: FEED_BORDER };

function VerifiedDot() {
  return <BadgeCheck size={12} className="text-[#3B82F6] shrink-0" fill="#3B82F6" stroke={FEED_BG} />;
}

function PostMenu() {
  return (
    <button type="button" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ color: FEED_MUTED }} aria-label="More">
      <MoreHorizontal size={16} />
    </button>
  );
}

// ─── Voice ───────────────────────────────────────────────────────────────────

export function FeedVoiceCard({
  post,
  size,
  onTip,
}: {
  post: Post;
  size: "hero" | "tall" | "compact";
  onTip: () => void;
}) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const me = getCurrentUserId() ?? "";
  const { data: unlocked = post.accessType === "free" } = useIsPostUnlocked(me, post.id);
  const locked = post.accessType === "tip" && !unlocked;
  const hero = size === "hero";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardBase} ${hero ? "col-span-2" : ""}`}
      style={cardStyle}
    >
      <Link href={`/post/${post.id}`} className={`relative block overflow-hidden ${hero ? "h-[220px]" : "h-[148px]"}`}>
        {post.coverUrl ? (
          <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(145deg, #1a1008 0%, #2a1810 45%, #1a0d18 100%)" }}
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)" }} />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="text-[8px] font-['Inter'] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(201,168,76,0.9)", color: FEED_BG }}
          >
            Voice
          </span>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div
            className={`${hero ? "w-14 h-14" : "w-11 h-11"} rounded-full flex items-center justify-center`}
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <Mic size={hero ? 22 : 18} style={{ color: FEED_GOLD }} />
          </div>
          {hero && (
            <div className="flex items-end gap-[3px] h-4">
              {[0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.5, 0.7].map((_, i) => (
                <div key={i} className="w-[2px] rounded-full" style={{ background: FEED_GOLD, animation: `feed-bar ${0.6 + (i % 3) * 0.2}s ease-in-out infinite ${i * 0.08}s` }} />
              ))}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <div className={`font-['Playfair_Display'] text-white leading-snug line-clamp-2 ${hero ? "text-[18px]" : "text-[14px]"}`}>
            {post.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <img src={author?.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white/20" />
            <span className="text-[10px] font-['Inter'] text-white/70">{author?.displayName}</span>
            {author?.verified && <VerifiedDot />}
          </div>
        </div>
      </Link>

      <div className="px-3 py-2.5 flex items-center gap-2 border-t" style={{ borderColor: FEED_BORDER }}>
        {locked ? (
          <button
            type="button"
            onClick={onTip}
            className="flex-1 py-2 rounded-xl text-[11px] font-['Inter'] font-semibold"
            style={{ background: `linear-gradient(90deg, ${FEED_GOLD}, #E8B14A)`, color: FEED_BG }}
          >
            <Lock size={11} className="inline mr-1" />
            Tip ₹{post.minTip ?? 20} to unlock
          </button>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => like.mutate()}
              className="flex items-center gap-1 text-[11px] font-['Inter']"
              style={{ color: post.liked ? FEED_GOLD : FEED_MUTED }}>
              <Heart size={13} fill={post.liked ? "currentColor" : "none"} />{post.likes}
            </motion.button>
            <Link href={`/post/${post.id}`} className="flex items-center gap-1 text-[11px] font-['Inter']" style={{ color: FEED_MUTED }}>
              <MessageCircle size={13} />{post.comments}
            </Link>
            <div className="flex-1" />
            <span className="text-[9px] font-['Inter']" style={{ color: FEED_MUTED }}>{formatFeedTime(post.createdAt)}</span>
          </>
        )}
        <PostMenu />
      </div>
    </motion.article>
  );
}

// ─── Text ────────────────────────────────────────────────────────────────────

export function FeedTextCard({ post, size, onTip }: { post: Post; size: "hero" | "tall" | "compact"; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const tall = size === "tall" || size === "hero";
  const isNew = isNewPost(post.createdAt);

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${cardBase} ${tall ? "" : "min-h-0"}`}
      style={cardStyle}
    >
      {post.coverUrl && (
        <Link href={`/post/${post.id}`} className="block relative h-[88px]">
          <img src={post.coverUrl} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,8,6,0.9), transparent)" }} />
        </Link>
      )}

      <div className={`px-3.5 ${post.coverUrl ? "pt-3" : "pt-4"} pb-3`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {!post.coverUrl && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.12)" }}>
                <PenLine size={14} style={{ color: FEED_GOLD }} />
              </div>
            )}
            <div className="min-w-0">
              <Link href={`/u/${author?.handle ?? ""}`} className="text-[11px] font-['Inter'] font-medium truncate block" style={{ color: FEED_TEXT }}>
                {author?.displayName}
              </Link>
              {isNew && (
                <span className="text-[8px] font-['Inter'] tracking-[0.12em] uppercase font-bold" style={{ color: FEED_GOLD }}>
                  New
                </span>
              )}
            </div>
          </div>
          <PostMenu />
        </div>

        <Link href={`/post/${post.id}`} className="block group">
          <div className={`font-['Playfair_Display'] leading-snug line-clamp-2 mb-1.5 group-hover:opacity-90 ${tall ? "text-[16px]" : "text-[13px]"}`} style={{ color: FEED_TEXT }}>
            {post.title}
          </div>
          {post.body && (
            <p className={`font-['Playfair_Display'] italic leading-relaxed line-clamp-3 ${tall ? "text-[12px]" : "text-[11px]"}`} style={{ color: FEED_MUTED }}>
              {post.body.split("\n")[0]}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-3 mt-3 pt-2 border-t" style={{ borderColor: FEED_BORDER }}>
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => like.mutate()}
            className="flex items-center gap-1 text-[11px] font-['Inter']"
            style={{ color: post.liked ? FEED_GOLD : FEED_MUTED }}>
            <Heart size={12} fill={post.liked ? "currentColor" : "none"} />{post.likes}
          </motion.button>
          <Link href={`/post/${post.id}`} className="flex items-center gap-1 text-[11px] font-['Inter']" style={{ color: FEED_MUTED }}>
            <MessageCircle size={12} />{post.comments}
          </Link>
          <div className="flex-1" />
          <button type="button" onClick={onTip} className="text-[10px] font-['Inter']" style={{ color: FEED_GOLD }}>
            Tip
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ─── Reel (compact) ──────────────────────────────────────────────────────────

export function FeedReelCard({ post, onTip }: { post: Post; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);

  return (
    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cardBase} style={cardStyle}>
      <Link href={`/reels?focus=${post.id}`} className="relative block h-[160px]">
        {post.coverUrl ? (
          <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #0E0717, #1A0F2E)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent 50%)" }} />
        <span className="absolute top-2 left-2 text-[8px] font-['Inter'] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full font-semibold" style={{ background: FEED_PURPLE_SOFT, color: "#fff" }}>
          Reel
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <Play size={18} className="text-white ml-0.5" fill="white" />
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-[12px] font-['Playfair_Display'] text-white line-clamp-2 italic">{post.title}</div>
          <div className="text-[9px] font-['Inter'] text-white/55 mt-0.5">{author?.displayName}</div>
        </div>
      </Link>
      <div className="px-2.5 py-2 flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => like.mutate()} className="text-[10px] flex items-center gap-1" style={{ color: FEED_MUTED }}>
          <Heart size={11} />{post.likes}
        </motion.button>
        <button type="button" onClick={onTip} className="text-[10px] ml-auto" style={{ color: FEED_GOLD }}>Tip</button>
      </div>
    </motion.article>
  );
}

// ─── Live Mehfil ─────────────────────────────────────────────────────────────

export function FeedMehfilCard({ mehfil }: { mehfil: Mehfil }) {
  const { data: host } = useUser(mehfil.hostId);

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cardBase}
      style={{ ...cardStyle, background: "linear-gradient(160deg, rgba(139,45,74,0.35) 0%, rgba(10,8,6,0.95) 55%)" }}
    >
      <Link href={`/mehfil/${mehfil.id}`} className="block">
        <div className="relative h-[120px] overflow-hidden">
          <img src={mehfil.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" loading="lazy" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,8,6,0.95), rgba(10,8,6,0.2))" }} />
          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[8px] font-['Inter'] tracking-[0.14em] uppercase font-bold text-white bg-red-600/90 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="px-3 pb-3 -mt-6 relative">
          <div className="font-['Playfair_Display'] text-[15px] leading-snug line-clamp-2 mb-1" style={{ color: FEED_TEXT }}>
            {mehfil.title}
          </div>
          <div className="text-[10px] font-['Inter'] mb-2.5" style={{ color: FEED_MUTED }}>
            {formatFeedStat(mehfil.listeners)} listening
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex -space-x-2">
              {[host?.avatarUrl, mehfil.coverUrl].filter(Boolean).slice(0, 3).map((url, i) => (
                <img key={i} src={url} alt="" className="w-6 h-6 rounded-full object-cover border-2" style={{ borderColor: FEED_BG }} />
              ))}
            </div>
            <span
              className="shrink-0 px-4 py-2 rounded-xl text-[11px] font-['Inter'] font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${FEED_PURPLE}, #7D3C98)` }}
            >
              Join
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function FeedTileView({ tile, onTip }: { tile: FeedTile; onTip: (postId: string) => void }) {
  if (tile.kind === "mehfil") {
    return <FeedMehfilCard mehfil={tile.mehfil} />;
  }
  const tip = () => onTip(tile.post.id);
  if (tile.post.kind === "voice") return <FeedVoiceCard post={tile.post} size={tile.size} onTip={tip} />;
  if (tile.post.kind === "reel") return <FeedReelCard post={tile.post} onTip={tip} />;
  return <FeedTextCard post={tile.post} size={tile.size} onTip={tip} />;
}
