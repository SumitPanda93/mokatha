import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Heart, MessageCircle, Play, Flame } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useTrendingPosts, useTopCreators, useUser } from "@/lib/store";

const RANGES = ["today", "week", "month"] as const;
const KINDS = ["all", "voice", "text", "story", "reel"] as const;

export default function Trending() {
  useTitle("Trending");
  const [, setLocation] = useLocation();
  const [range, setRange] = useState<typeof RANGES[number]>("today");
  const [kind, setKind] = useState<typeof KINDS[number]>("all");
  const { data: posts = [] } = useTrendingPosts();
  const { data: creators = [] } = useTopCreators(8);
  const visible = kind === "all" ? posts : posts.filter((p) => p.kind === kind);

  return (
    <div className="min-h-screen w-full bg-background pb-10">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="flex-1">
          <div className="font-['Playfair_Display'] text-[20px] leading-tight flex items-center gap-2">Trending <TrendingUp size={16} className="text-terracotta" /></div>
          <div className="text-[11px] text-muted-foreground">What the salon is humming about</div>
        </div>
      </div>

      <div className="px-5 pt-2 pb-3 flex gap-2">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`flex-1 py-2 text-[12px] rounded-full ${range === r ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}>
            {r === "today" ? "Today" : r === "week" ? "This week" : "This month"}
          </button>
        ))}
      </div>

      <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar pb-3">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] rounded-full whitespace-nowrap ${kind === k ? "bg-terracotta text-white" : "bg-card border border-border text-muted-foreground"}`}>{k}</button>
        ))}
      </div>

      {/* Top creators */}
      <div className="px-5 mb-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Top voices · {range}</div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {creators.map((c, i) => (
            <Link key={c.id} href={`/u/${c.handle}`} className="shrink-0 flex flex-col items-center gap-1 w-[64px]">
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-full" style={{ background: "conic-gradient(from 0deg, hsl(var(--terracotta)), hsl(var(--ochre)), hsl(var(--plum)), hsl(var(--terracotta)))" }} />
                <img src={c.avatarUrl} alt="" className="relative w-14 h-14 rounded-full object-cover border-2 border-background" />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">{i + 1}</div>
              </div>
              <div className="text-[10px] text-center truncate w-full">{c.displayName.split(" ")[0]}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Ranked list */}
      <div className="px-5 space-y-3">
        {visible.map((p, i) => <RankedPost key={p.id} post={p} rank={i + 1} />)}
      </div>
    </div>
  );
}

function RankedPost({ post, rank }: { post: any; rank: number }) {
  const { data: author } = useUser(post.authorId);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.03 }}>
      <Link href={`/post/${post.id}`} className="flex gap-3 p-3 rounded-2xl bg-card border border-border hover:border-terracotta">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="font-['Playfair_Display'] text-[24px] leading-none" style={{ color: rank <= 3 ? "hsl(var(--terracotta))" : "hsl(var(--muted-foreground))" }}>{rank}</div>
          {rank <= 3 && <Flame size={11} className="text-terracotta" />}
        </div>
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
          {post.coverUrl ? <img src={post.coverUrl} alt="" className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center text-[20px] font-['Playfair_Display']" style={{ background: "linear-gradient(135deg,hsl(var(--ochre)/0.18),hsl(var(--plum)/0.18))" }}>{post.title.charAt(0)}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{post.kind}</div>
          <div className="text-[14px] font-['Playfair_Display'] leading-tight line-clamp-1">{post.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{author?.displayName}</div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Heart size={10} />{post.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle size={10} />{post.comments}</span>
            {(post.kind === "voice" || post.kind === "reel") && <span className="flex items-center gap-1"><Play size={10} />{post.plays ?? 0}</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
