import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Heart, MessageCircle, Bookmark, Play, Mic, Lock, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useFeed, useCurrentUser, useMehfils, useLike, useTip, useUser, useSavePost,
  getCurrentUserId, Post, useIsPostUnlocked, useInkReward,
  usePostsRealtime, useMehfilRealtime,
} from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";

const KIND_COLOR: Record<string, string> = {
  voice: "bg-ochre text-white", text: "bg-sage text-white",
  story: "bg-violet text-white", reel: "bg-plum text-white",
};
const KIND_LABEL: Record<string, string> = {
  voice: "Voice", text: "Text", story: "Story", reel: "Reel",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night"; if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening";
  return "Late evening";
}

const FILTERS = ["For you", "Voice", "Text", "Story", "Reel", "Odia", "Hindi"] as const;
type Filter = typeof FILTERS[number];

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

      {/* Top bar */}
      <div className="px-5 py-3 flex justify-between items-center sticky top-0 z-20 bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Mo Katha" className="w-9 h-9 object-contain" draggable={false} />
          <div>
            <div className="font-['Playfair_Display'] text-[18px] text-foreground leading-none">
              Mo <span className="italic" style={{ background: "linear-gradient(90deg,hsl(var(--terracotta)),hsl(var(--plum)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Katha</span>
            </div>
            <div className="text-[10px] font-['Inter'] text-muted-foreground capitalize">{dayTime}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rewards" className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center hover:bg-ochre/10 hover:border-ochre transition-colors relative">
            <Zap strokeWidth={1.75} size={16} className="text-ochre" />
          </Link>
          <Link href="/search" className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center hover:bg-black/5">
            <Search strokeWidth={1.75} size={16} />
          </Link>
          <Link href="/me" className="relative">
            <img src={user?.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=faces"} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sage border-2 border-background" />
          </Link>
        </div>
      </div>

      {/* Mehfil story row */}
      <div className="px-5 pb-3 pt-1 flex gap-3 overflow-x-auto no-scrollbar">
        <Link href="/create/story" className="flex flex-col items-center gap-1 shrink-0 w-[60px]">
          <div className="w-[54px] h-[54px] rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-[24px] text-muted-foreground hover:border-terracotta hover:text-terracotta transition-colors">+</div>
          <div className="text-[10px] font-['Inter'] text-muted-foreground">You</div>
        </Link>
        {mehfils.slice(0, 6).map((m) => (
          <Link key={m.id} href={`/mehfil/${m.id}`} className="flex flex-col items-center gap-1 shrink-0 w-[60px]">
            <div className="relative">
              {m.isLive && (
                <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, hsl(var(--terracotta)), hsl(var(--ochre)), hsl(var(--plum)), hsl(var(--terracotta)))", animation: "feed-spin 4s linear infinite", padding: "2px" }}>
                  <div className="w-full h-full rounded-full bg-background" />
                </div>
              )}
              {!m.isLive && <div className="absolute inset-0 rounded-full border-2 border-muted/30" />}
              <img src={m.coverUrl} alt="" className="relative w-[54px] h-[54px] rounded-full object-cover border-2 border-background" />
              {m.isLive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-['Inter'] tracking-[0.1em] uppercase text-white bg-destructive rounded-sm px-1 py-0.5 font-bold whitespace-nowrap">LIVE</div>}
            </div>
            <div className="text-[10px] font-['Inter'] text-foreground text-center line-clamp-1 w-full">{m.title.split(" ")[0]}</div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 pb-3 pt-1 flex gap-2 text-[12px] font-['Inter'] overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-3 py-1 transition-colors ${filter === f ? "bg-foreground text-background" : "border border-muted-foreground/30 text-muted-foreground hover:border-terracotta hover:text-terracotta"}`}>{f}</button>
        ))}
      </div>

      {/* Live banner */}
      {liveMehfil && (
        <Link href={`/mehfil/${liveMehfil.id}`}>
          <div className="mx-5 mt-2 mb-6 rounded-2xl overflow-hidden relative shadow-lg cursor-pointer hover:scale-[1.01] transition-transform"
            style={{ background: "linear-gradient(135deg, hsl(var(--wine)) 0%, #1A0F14 50%, #3B1A1F 100%)" }}>
            <div className="absolute -top-10 -right-10 w-[180px] h-[180px] rounded-full opacity-40" style={{ background: "radial-gradient(circle,hsl(var(--terracotta)),transparent 70%)", filter: "blur(30px)" }} />
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[10px] font-['Inter'] tracking-[0.2em] uppercase text-white bg-destructive rounded-full px-3 py-1 font-semibold">
                  <div className="relative w-1.5 h-1.5">
                    <div className="absolute inset-0 rounded-full bg-white" />
                    <div className="absolute inset-0 rounded-full bg-white" style={{ animation: "feed-pulse-ring 1.5s ease-out infinite" }} />
                  </div>
                  LIVE NOW
                </div>
                <div className="text-[10px] font-['Inter'] text-white/70">{liveMehfil.listeners} listening</div>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <img src={liveMehfil.coverUrl} alt="" className="relative w-12 h-12 rounded-full object-cover border-2 border-[#1A0F14]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-['Playfair_Display'] text-white leading-tight italic">{liveMehfil.title}</div>
                </div>
                <div className="flex items-end gap-[2px] h-5">
                  {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7].map((_, i) => (
                    <div key={i} className="w-[2px] rounded-full bg-ochre" style={{ animation: `feed-bar ${0.6 + (i % 3) * 0.2}s ease-in-out infinite ${i * 0.08}s` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="px-6 mb-4 flex items-center">
        <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase font-semibold">
          <span className="text-terracotta">●</span> {filter === "For you" ? "Today's voices" : filter}
        </div>
      </div>

      <div className="flex-1 pb-6 space-y-5 px-5">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} onTip={() => setTipPostId(post.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-[14px] font-['Playfair_Display'] italic">A quiet moment. Nothing here yet.</div>
        )}
      </div>

      <AnimatePresence>
        {tipPostId && <TipSheet postId={tipPostId} onClose={() => setTipPostId(null)} />}
      </AnimatePresence>
    </div>
  );
}

function AccessBadge({ post }: { post: Post }) {
  const me = getCurrentUserId() ?? "";
  const { data: unlocked = post.accessType === "free" } = useIsPostUnlocked(me, post.id);

  if (!post.accessType || post.accessType === "free") {
    return <span className="text-[9px] font-['Inter'] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full font-semibold bg-sage/20 text-sage">Free</span>;
  }
  if (post.accessType === "tip") {
    return (
      <span className={`text-[9px] font-['Inter'] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${unlocked ? "bg-sage/20 text-sage" : "bg-ochre text-white"}`}>
        {unlocked ? "Unlocked" : <><Lock size={8} /> Tip ₹{post.minTip}</>}
      </span>
    );
  }
  if (post.accessType === "premium") {
    return (
      <span className={`text-[9px] font-['Inter'] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${unlocked ? "bg-sage/20 text-sage" : "bg-plum text-white"}`}>
        {unlocked ? "Access ✓" : <><Lock size={8} /> Premium</>}
      </span>
    );
  }
  return null;
}

function PostCard({ post, onTip }: { post: Post; onTip: () => void }) {
  const { data: author } = useUser(post.authorId);
  const like = useLike(post.id);
  const save = useSavePost();
  const me = getCurrentUserId() ?? "";
  const saved = post.saved ?? false;
  const isAudio = post.kind === "voice" || post.kind === "reel";
  const timeAgo = () => {
    const s = Math.floor((Date.now() - +new Date(post.createdAt)) / 1000);
    if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {post.coverUrl && (
        <Link href={`/post/${post.id}`} className="block relative">
          <img src={post.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-3 right-3 flex gap-1.5">
            <span className={`text-[9px] font-['Inter'] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full font-semibold ${KIND_COLOR[post.kind]}`}>
              {KIND_LABEL[post.kind]}{post.durationSec ? ` · ${Math.floor(post.durationSec / 60)}:${String(post.durationSec % 60).padStart(2, "0")}` : ""}
            </span>
          </div>
          <div className="absolute top-3 left-3">
            <AccessBadge post={post} />
          </div>
          {isAudio && (
            <div className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              {post.kind === "voice" ? <Mic size={14} className="text-terracotta" /> : <Play size={14} className="text-plum ml-0.5" />}
            </div>
          )}
        </Link>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/u/${author?.handle ?? ""}`}>
            <img src={author?.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          </Link>
          <Link href={`/u/${author?.handle ?? ""}`} className="text-[12px] font-['Inter'] font-medium text-foreground hover:text-terracotta transition-colors">{author?.displayName}</Link>
          <span className="text-[10px] text-muted-foreground">· {timeAgo()}</span>
          {!post.coverUrl && (
            <div className="ml-auto flex gap-1.5">
              <span className={`text-[9px] font-['Inter'] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full font-semibold ${KIND_COLOR[post.kind]}`}>{KIND_LABEL[post.kind]}</span>
              <AccessBadge post={post} />
            </div>
          )}
        </div>

        <Link href={`/post/${post.id}`} className="block mb-3">
          <div className="text-[20px] font-['Playfair_Display'] font-normal text-foreground leading-tight hover:text-terracotta transition-colors">{post.title}</div>
          {post.kind === "text" && post.body && (
            <div className="text-[13px] font-['Playfair_Display'] italic text-foreground/75 leading-[1.6] mt-1.5 line-clamp-2">{post.body.split("\n")[0]}</div>
          )}
        </Link>

        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => like.mutate()} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] transition-colors ${post.liked ? "bg-terracotta text-white border-terracotta" : "border-border text-muted-foreground hover:border-terracotta hover:text-terracotta"}`}>
            <Heart size={13} fill={post.liked ? "currentColor" : "none"} /><span>{post.likes.toLocaleString()}</span>
          </motion.button>
          <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-[12px] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
            <MessageCircle size={13} /><span>{post.comments}</span>
          </Link>
          <button onClick={onTip} className="ml-auto text-[12px] px-3 py-1.5 rounded-full border border-ochre text-ochre hover:bg-ochre hover:text-white transition-colors font-medium">Tip ₹</button>
          <button onClick={() => save.mutate({ postId: post.id, on: !saved })} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${saved ? "bg-violet text-white border-violet" : "border-border text-muted-foreground hover:border-violet hover:text-violet"}`}>
            <Bookmark size={13} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TipSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const tip = useTip("post");
  const { data: post } = useFeed();
  const p = (post ?? []).find((x: Post) => x.id === postId);
  const { data: author } = useUser(p?.authorId ?? "");
  const sendTip = (amt: number) => { tip.mutate({ id: postId, amount: amt }); onClose(); };
  return (
    <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[430px] bg-background rounded-t-3xl p-6 pb-10">
        <div className="w-8 h-1 rounded-full bg-muted mx-auto mb-5" />
        <div className="font-['Playfair_Display'] text-[22px] mb-1">Send a tip</div>
        <div className="text-[12px] text-muted-foreground mb-5">A quiet thank-you to {author?.displayName}.</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[20, 50, 100, 250].map((v) => (
            <button key={v} onClick={() => sendTip(v)} className="py-3 rounded-xl border border-border text-[14px] font-['Playfair_Display'] hover:bg-terracotta hover:text-white hover:border-terracotta transition-colors">₹{v}</button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-3 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      </motion.div>
    </motion.div>
  );
}
