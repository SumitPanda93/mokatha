import { useState } from "react";
import { Link } from "wouter";
import { Search, Heart, MessageCircle, Bookmark, Play, Mic, Lock, Zap, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useFeed, useCurrentUser, useMehfils, useLike, useTip, useUser, useSavePost,
  getCurrentUserId, Post, useIsPostUnlocked,
  usePostsRealtime, useMehfilRealtime, useUnreadCount, useNotificationsRealtime,
} from "@/lib/store";

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_ACCENT: Record<string, string> = {
  voice: "hsl(var(--ochre))",
  text:  "hsl(var(--sage))",
  story: "hsl(var(--violet))",
  reel:  "hsl(var(--plum))",
};
const KIND_LABEL: Record<string, string> = {
  voice: "Voice", text: "Text", story: "Story", reel: "Reel",
};

const FILTERS = ["For you", "Voice", "Text", "Story", "Reel", "Odia", "Hindi"] as const;
type Filter = typeof FILTERS[number];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night"; if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening";
  return "Late evening";
}

// ─── Access badge ─────────────────────────────────────────────────────────────

function AccessBadge({ post }: { post: Post }) {
  const me = getCurrentUserId() ?? "";
  const { data: unlocked = post.accessType === "free" } = useIsPostUnlocked(me, post.id);
  if (!post.accessType || post.accessType === "free") return null;
  if (post.accessType === "tip") return (
    <span className={`text-[9px] font-['Inter'] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${unlocked ? "bg-sage/20 text-sage" : "bg-ochre/90 text-white"}`}>
      {unlocked ? "Unlocked" : <><Lock size={8} /> Tip ₹{post.minTip}</>}
    </span>
  );
  return (
    <span className={`text-[9px] font-['Inter'] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${unlocked ? "bg-sage/20 text-sage" : "bg-plum/90 text-white"}`}>
      {unlocked ? "Access ✓" : <><Lock size={8} /> Premium</>}
    </span>
  );
}

// ─── Voice card ───────────────────────────────────────────────────────────────

function VoiceCard({ post, onTip }: { post: Post; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const save = useSavePost();
  const saved = post.saved ?? false;
  const dur = post.durationSec
    ? `${Math.floor(post.durationSec / 60)}:${String(post.durationSec % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      {/* Hero area */}
      <Link href={`/post/${post.id}`} className="relative block h-[192px] overflow-hidden">
        {post.coverUrl
          ? <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1C0F06 0%, #2E1A0C 40%, #1A0D18 100%)" }} />
        }
        {/* Overlay */}
        <div className="absolute inset-0" style={{ background: post.coverUrl ? "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.18) 100%)" : "rgba(0,0,0,0.15)" }} />

        {/* Badges top row */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-['Inter'] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-semibold bg-ochre/90 text-white backdrop-blur-sm">
              Voice
            </span>
            <AccessBadge post={post} />
          </div>
          {dur && (
            <span className="text-[10px] font-['Inter'] font-medium bg-black/50 text-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">{dur}</span>
          )}
        </div>

        {/* Waveform + play CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <motion.div
            whileTap={{ scale: 0.92 }}
            className="w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            <Play size={20} className="text-terracotta ml-0.5" fill="currentColor" />
          </motion.div>
          {/* Equalizer bars */}
          <div className="flex items-end gap-[3px] h-5">
            {[0.5, 0.8, 0.4, 1, 0.6, 0.9, 0.5, 0.7, 0.4, 0.8].map((_, i) => (
              <div key={i} className="w-[2.5px] rounded-full bg-white/50" style={{ animation: `feed-bar ${0.7 + (i % 4) * 0.15}s ease-in-out infinite ${i * 0.07}s` }} />
            ))}
          </div>
        </div>

        {/* Author + title bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="text-[17px] font-['Playfair_Display'] text-white leading-snug mb-1.5 line-clamp-2">{post.title}</div>
          <div className="flex items-center gap-2">
            <img src={author?.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30" />
            <span className="text-[11px] font-['Inter'] text-white/75">{author?.displayName}</span>
          </div>
        </div>
      </Link>

      {/* Action row */}
      <div className="px-4 py-3 bg-card flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => like.mutate()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] transition-colors ${post.liked ? "bg-terracotta text-white" : "text-muted-foreground hover:text-terracotta"}`}>
          <Heart size={13} fill={post.liked ? "currentColor" : "none"} />{post.likes}
        </motion.button>
        <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle size={13} />{post.comments}
        </Link>
        <div className="flex-1" />
        <button onClick={onTip} className="text-[11px] font-['Inter'] font-medium px-3 py-1.5 rounded-full border border-ochre/50 text-ochre hover:bg-ochre hover:text-white transition-colors">Tip ₹</button>
        <button onClick={() => save.mutate({ postId: post.id, on: !saved })}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${saved ? "text-violet" : "text-muted-foreground hover:text-violet"}`}>
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

// ─── Text / Story card ────────────────────────────────────────────────────────

function TextCard({ post, onTip }: { post: Post; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const save = useSavePost();
  const saved = post.saved ?? false;
  const isStory = post.kind === "story";
  const accent = isStory ? "hsl(var(--violet))" : "hsl(var(--sage))";

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/60">
      {/* Cover image (optional) */}
      {post.coverUrl && (
        <Link href={`/post/${post.id}`} className="block relative">
          <img src={post.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="text-[9px] font-['Inter'] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full font-semibold"
              style={{ background: accent, color: "white", opacity: 0.9 }}>{KIND_LABEL[post.kind]}</span>
            <AccessBadge post={post} />
          </div>
        </Link>
      )}

      <div className="px-5 pt-5 pb-4">
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-4">
          <Link href={`/u/${author?.handle ?? ""}`}>
            <img src={author?.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/u/${author?.handle ?? ""}`} className="text-[12px] font-['Inter'] font-medium text-foreground hover:text-terracotta transition-colors">{author?.displayName}</Link>
          </div>
          {!post.coverUrl && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-['Inter'] tracking-[0.15em] uppercase px-2.5 py-1 rounded-full font-semibold"
                style={{ background: accent + "22", color: accent }}>{KIND_LABEL[post.kind]}</span>
              <AccessBadge post={post} />
            </div>
          )}
        </div>

        {/* Literary title + excerpt */}
        <Link href={`/post/${post.id}`} className="block group">
          <div className="text-[22px] font-['Playfair_Display'] font-normal text-foreground leading-[1.3] mb-2.5 group-hover:text-terracotta transition-colors">
            {post.title}
          </div>
          {post.body && (
            <div className="relative pl-4 border-l-2 mb-1" style={{ borderColor: accent + "55" }}>
              <div className="text-[13.5px] font-['Playfair_Display'] italic text-foreground/65 leading-[1.7] line-clamp-3">
                {isStory && <span className="text-[20px] leading-none mr-0.5 text-muted-foreground/50 font-serif" aria-hidden>"</span>}
                {post.body.split("\n")[0]}
              </div>
            </div>
          )}
        </Link>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {post.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] font-['Inter'] text-muted-foreground"># {t}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/40">
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => like.mutate()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] transition-colors ${post.liked ? "text-terracotta" : "text-muted-foreground hover:text-terracotta"}`}>
            <Heart size={13} fill={post.liked ? "currentColor" : "none"} />{post.likes}
          </motion.button>
          <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] text-muted-foreground hover:text-foreground transition-colors">
            <MessageCircle size={13} />{post.comments}
          </Link>
          <div className="flex-1" />
          <button onClick={onTip} className="text-[11px] font-['Inter'] font-medium px-3 py-1.5 rounded-full border border-ochre/50 text-ochre hover:bg-ochre hover:text-white transition-colors">Tip ₹</button>
          <button onClick={() => save.mutate({ postId: post.id, on: !saved })}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${saved ? "text-violet" : "text-muted-foreground hover:text-violet"}`}>
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reel card ────────────────────────────────────────────────────────────────

function ReelCard({ post, onTip }: { post: Post; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const save = useSavePost();
  const saved = post.saved ?? false;
  const dur = post.durationSec
    ? `${Math.floor(post.durationSec / 60)}:${String(post.durationSec % 60).padStart(2, "0")}`
    : null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      {/* Cinematic cover */}
      <Link href={`/post/${post.id}`} className="relative block aspect-[4/3] overflow-hidden">
        {post.coverUrl
          ? <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0E0717 0%, #1A0F2E 50%, #0E1720 100%)" }} />
        }
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)" }} />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="text-[9px] font-['Inter'] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full font-semibold bg-plum/90 text-white backdrop-blur-sm">Reel</span>
            <AccessBadge post={post} />
          </div>
          {dur && <span className="text-[10px] font-['Inter'] font-medium bg-black/55 text-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">{dur}</span>}
        </div>

        {/* Centered play */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div whileTap={{ scale: 0.9 }}
            className="w-[52px] h-[52px] rounded-full border-2 border-white/70 flex items-center justify-center backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.15)" }}>
            <Play size={18} className="text-white ml-0.5" fill="white" />
          </motion.div>
        </div>

        {/* Bottom: title + author */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="text-[18px] font-['Playfair_Display'] text-white leading-snug mb-1.5 line-clamp-2">{post.title}</div>
          <div className="flex items-center gap-2">
            <img src={author?.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30" />
            <span className="text-[11px] font-['Inter'] text-white/75">{author?.displayName}</span>
          </div>
        </div>
      </Link>

      {/* Action row */}
      <div className="px-4 py-3 bg-card flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => like.mutate()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] transition-colors ${post.liked ? "text-terracotta" : "text-muted-foreground hover:text-terracotta"}`}>
          <Heart size={13} fill={post.liked ? "currentColor" : "none"} />{post.likes}
        </motion.button>
        <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-['Inter'] text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle size={13} />{post.comments}
        </Link>
        <div className="flex-1" />
        <button onClick={onTip} className="text-[11px] font-['Inter'] font-medium px-3 py-1.5 rounded-full border border-ochre/50 text-ochre hover:bg-ochre hover:text-white transition-colors">Tip ₹</button>
        <button onClick={() => save.mutate({ postId: post.id, on: !saved })}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${saved ? "text-violet" : "text-muted-foreground hover:text-violet"}`}>
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

// ─── Post card dispatcher ─────────────────────────────────────────────────────

function PostCard({ post, onTip }: { post: Post; onTip: () => void }) {
  if (post.kind === "voice") return <VoiceCard post={post} onTip={onTip} />;
  if (post.kind === "reel")  return <ReelCard  post={post} onTip={onTip} />;
  return <TextCard post={post} onTip={onTip} />;
}

// ─── Tip sheet ────────────────────────────────────────────────────────────────

function TipSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const tip = useTip("post");
  const { data: post } = useFeed();
  const p = (post ?? []).find((x: Post) => x.id === postId);
  const { data: author } = useUser(p?.authorId ?? "");
  const sendTip = (amt: number) => { tip.mutate({ id: postId, amount: amt }); onClose(); };
  return (
    <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-4 pb-10">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
        <div className="font-['Playfair_Display'] text-[22px] mb-1">Send a tip</div>
        <div className="text-[12px] text-muted-foreground mb-6">A quiet thank-you to {author?.displayName}.</div>
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {[20, 50, 100, 250].map((v) => (
            <button key={v} onClick={() => sendTip(v)}
              className="py-3.5 rounded-xl border border-border text-[14px] font-['Playfair_Display'] hover:bg-terracotta hover:text-white hover:border-terracotta transition-all active:scale-95">
              ₹{v}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-3 rounded-xl text-[13px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  useTitle("Home");
  const [filter, setFilter] = useState<Filter>("For you");
  const [tipPostId, setTipPostId] = useState<string | null>(null);
  const { data: posts = [] } = useFeed();
  const { data: user } = useCurrentUser();
  const { data: mehfils = [] } = useMehfils();
  const liveMehfil = mehfils.find((m) => m.isLive);
  usePostsRealtime();
  useMehfilRealtime();
  useNotificationsRealtime();
  const { data: unreadCount = 0 } = useUnreadCount();

  const filtered = posts.filter((p) => {
    if (filter === "For you") return true;
    if (filter === "Voice") return p.kind === "voice";
    if (filter === "Text") return p.kind === "text";
    if (filter === "Story") return p.kind === "story";
    if (filter === "Reel") return p.kind === "reel";
    if (filter === "Odia") return p.language === "or";
    if (filter === "Hindi") return p.language === "hi";
    return true;
  });

  const dayTime = `${new Date().toLocaleDateString("en-US", { weekday: "long" })}, ${greeting().toLowerCase()}`;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <style>{`
        @keyframes feed-bar { 0%,100% { height: 20%; } 50% { height: 100%; } }
        @keyframes feed-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes feed-pulse-ring { 0% { transform: scale(0.95); opacity: 0.6; } 70% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1.6); opacity: 0; } }
      `}</style>

      {/* ── Top bar ── */}
      <div className="px-5 py-3 flex justify-between items-center sticky top-0 z-20 bg-background/92 backdrop-blur-md border-b border-border/30">
        {/* Logo — clickable to home */}
        <Link href="/" className="flex items-center gap-2.5 active:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Mo Katha" className="w-9 h-9 object-contain" draggable={false} />
          <div>
            <div className="font-['Playfair_Display'] text-[18px] text-foreground leading-none">
              Mo{" "}
              <span className="italic" style={{ background: "linear-gradient(90deg,hsl(var(--terracotta)),hsl(var(--plum)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Katha
              </span>
            </div>
            <div className="text-[10px] font-['Inter'] text-muted-foreground capitalize">{dayTime}</div>
          </div>
        </Link>

        {/* Right icons */}
        <div className="flex items-center gap-1.5">
          <Link href="/rewards" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-ochre/10 transition-colors relative" title="Ink Points">
            <Zap strokeWidth={1.75} size={16} className="text-ochre" />
          </Link>
          <Link href="/notifications" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors relative">
            <Bell strokeWidth={1.75} size={16} className={unreadCount > 0 ? "text-terracotta" : "text-muted-foreground"} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-[3px] rounded-full bg-terracotta text-white text-[8px] font-bold font-['Inter'] flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/search" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors">
            <Search strokeWidth={1.75} size={16} className="text-muted-foreground" />
          </Link>
          <Link href="/me">
            <img
              src={user?.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=faces"}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-border ml-0.5"
            />
          </Link>
        </div>
      </div>

      {/* ── Mehfil story row ── */}
      <div className="px-5 pt-2 pb-1 flex gap-2.5 overflow-x-auto no-scrollbar">
        <Link href="/create/story" className="flex flex-col items-center gap-1 shrink-0 w-[52px]">
          <div className="w-[46px] h-[46px] rounded-full border-2 border-dashed border-border flex items-center justify-center text-[20px] text-muted-foreground hover:border-terracotta hover:text-terracotta transition-colors">+</div>
          <div className="text-[9px] font-['Inter'] text-muted-foreground">You</div>
        </Link>
        {mehfils.slice(0, 6).map((m) => (
          <Link key={m.id} href={`/mehfil/${m.id}`} className="flex flex-col items-center gap-1 shrink-0 w-[52px]">
            <div className="relative">
              {m.isLive && (
                <div className="absolute inset-0 rounded-full p-[2px]" style={{ background: "conic-gradient(from 0deg, hsl(var(--terracotta)), hsl(var(--ochre)), hsl(var(--plum)), hsl(var(--terracotta)))", animation: "feed-spin 4s linear infinite" }}>
                  <div className="w-full h-full rounded-full bg-background" />
                </div>
              )}
              {!m.isLive && <div className="absolute inset-0 rounded-full border-2 border-border/50" />}
              <img src={m.coverUrl} alt="" className="relative w-[46px] h-[46px] rounded-full object-cover border-2 border-background" />
              {m.isLive && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-['Inter'] tracking-[0.08em] uppercase text-white bg-destructive rounded-sm px-1.5 py-0.5 font-bold whitespace-nowrap leading-tight">LIVE</div>
              )}
            </div>
            <div className="text-[9px] font-['Inter'] text-foreground/75 text-center line-clamp-1 w-full">{m.title.split(" ")[0]}</div>
          </Link>
        ))}
      </div>

      {/* ── Feed category tabs — editorial underline style ── */}
      <div className="relative border-b border-border/40 mt-0.5">
        <div className="flex overflow-x-auto no-scrollbar px-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative shrink-0 px-3.5 py-3 text-[12px] font-['Inter'] transition-colors whitespace-nowrap select-none ${
                filter === f ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              {f}
              {filter === f && (
                <motion.div
                  layoutId="feed-tab-line"
                  className="absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full bg-terracotta"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live banner ── */}
      {liveMehfil && (
        <Link href={`/mehfil/${liveMehfil.id}`} className="mx-4 mt-2">
          <motion.div
            whileTap={{ scale: 0.985 }}
            className="rounded-2xl overflow-hidden relative shadow-lg cursor-pointer"
            style={{ background: "linear-gradient(135deg, hsl(var(--wine)) 0%, #1A0F14 50%, #3B1A1F 100%)" }}
          >
            <div className="absolute -top-10 -right-10 w-[180px] h-[180px] rounded-full opacity-40" style={{ background: "radial-gradient(circle,hsl(var(--terracotta)),transparent 70%)", filter: "blur(30px)" }} />
            <div className="relative px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[10px] font-['Inter'] tracking-[0.18em] uppercase text-white bg-destructive/90 rounded-full px-3 py-1 font-semibold">
                  <div className="relative w-1.5 h-1.5">
                    <div className="absolute inset-0 rounded-full bg-white" />
                    <div className="absolute inset-0 rounded-full bg-white" style={{ animation: "feed-pulse-ring 1.5s ease-out infinite" }} />
                  </div>
                  LIVE NOW
                </div>
                <div className="text-[10px] font-['Inter'] text-white/60">{liveMehfil.listeners} listening</div>
              </div>
              <div className="flex items-center gap-3">
                <img src={liveMehfil.coverUrl} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-white/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[17px] font-['Playfair_Display'] text-white leading-tight italic line-clamp-1">{liveMehfil.title}</div>
                </div>
                <div className="flex items-end gap-[2.5px] h-5 shrink-0">
                  {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7].map((_, i) => (
                    <div key={i} className="w-[2px] rounded-full bg-ochre" style={{ animation: `feed-bar ${0.6 + (i % 3) * 0.2}s ease-in-out infinite ${i * 0.08}s` }} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </Link>
      )}

      {/* ── Section heading ── */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-terracotta" />
        <div className="text-[10px] font-['Inter'] tracking-[0.28em] uppercase font-semibold text-muted-foreground">
          {filter === "For you" ? "Today's voices" : filter}
        </div>
      </div>

      {/* ── Posts ── */}
      <div className="flex-1 pb-8 space-y-4 px-4">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} onTip={() => setTipPostId(post.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-14">
            <div className="text-[15px] font-['Playfair_Display'] italic text-muted-foreground">A quiet moment. Nothing here yet.</div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tipPostId && <TipSheet postId={tipPostId} onClose={() => setTipPostId(null)} />}
      </AnimatePresence>
    </div>
  );
}
