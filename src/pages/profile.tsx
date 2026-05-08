import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Heart, MessageCircle, Play, Mic, Share2, Radio, Star, Zap, BadgeCheck, Eye, EyeOff } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useCurrentUser, usePostsByAuthor, useWalletBalance, useSavedPosts,
  getCurrentUserId, Post, useAuthorPlan, useSubscribersOf, useInkReward,
  useFollowers, useFollowing, usePostsRealtime,
} from "@/lib/store";
import { useAuthState } from "@/lib/auth";

const BADGE_LABELS: Record<string, string> = {
  "supporter": "💛 Supporter",
  "top-reader": "📖 Top Reader",
  "soul-listener": "🎧 Soul Listener",
};

export default function Profile() {
  useTitle("Profile");
  const [, setLocation] = useLocation();
  const { ready } = useAuthState();
  const { data: user } = useCurrentUser();
  const meId = getCurrentUserId() ?? "u1";
  const { data: posts = [] } = usePostsByAuthor(meId);
  const { data: balance = 0 } = useWalletBalance(meId);
  const { data: saved = [] } = useSavedPosts(meId);
  const { data: plan } = useAuthorPlan(meId);
  const { data: subscribers = [] } = useSubscribersOf(meId);
  const { data: ink } = useInkReward(meId);
  const { data: followersData = [] } = useFollowers(meId);
  const { data: followingData = [] } = useFollowing(meId);
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [viewAs, setViewAs] = useState(false);
  usePostsRealtime();

  // Still resolving auth — show spinner to avoid flash
  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Keep the header consistent with the rest of the app */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div className="font-['Playfair_Display'] text-[18px]">Profile</div>
          <div className="w-9 h-9" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center pb-24">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Settings size={26} className="text-muted-foreground" />
          </div>
          <div>
            <div className="font-['Playfair_Display'] text-[24px] text-foreground mb-2">Your profile awaits</div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">Sign in to manage your stories,<br />track earnings and Ink Points.</div>
          </div>
          <button
            onClick={() => setLocation("/auth/login")}
            className="px-10 py-3.5 rounded-full bg-foreground text-background text-[14px] font-['Inter'] font-medium"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const displayed = tab === "saved" ? saved : posts;
  const followersCount = followersData.length;
  const followingCount = followingData.length;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 flex justify-between items-center sticky top-0 bg-background/90 backdrop-blur-md z-20">
        <div className="font-['Playfair_Display'] text-[18px]">
          {viewAs ? "Visitor view" : "Profile"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewAs((v) => !v)}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${viewAs ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border hover:bg-black/5"}`}
            title={viewAs ? "Exit visitor view" : "Preview as visitor"}
          >
            {viewAs ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          {!viewAs && (
            <Link href="/settings" className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-black/5">
              <Settings size={16} strokeWidth={1.5} />
            </Link>
          )}
        </div>
      </div>

      {/* View-as banner */}
      {viewAs && (
        <div className="mx-5 mb-1 px-4 py-2.5 rounded-2xl bg-terracotta/8 border border-terracotta/20 flex items-center gap-2">
          <Eye size={13} className="text-terracotta shrink-0" />
          <span className="text-[12px] text-terracotta font-['Inter']">Viewing as a visitor — this is how others see your profile</span>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="px-6 pt-4 pb-5 relative">
        {/* Ambient glow */}
        <div className="absolute top-0 right-4 w-[120px] h-[120px] rounded-full bg-ochre/15 blur-3xl pointer-events-none" />

        {/* Avatar + name row */}
        <div className="flex items-center gap-4 mb-5 relative">
          <div className="relative shrink-0">
            <div className="absolute -inset-[3px] rounded-full opacity-70 blur-[3px]"
              style={{ background: "linear-gradient(135deg, hsl(var(--terracotta)), hsl(var(--ochre)), hsl(var(--plum)))" }} />
            <img src={user.avatarUrl} alt={user.displayName}
              className="relative w-[76px] h-[76px] rounded-full object-cover border-2 border-background" />
            {user.verified && (
              <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-sage border-2 border-background flex items-center justify-center">
                <span className="text-white text-[8px] font-bold leading-none">✓</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-['Playfair_Display'] text-[24px] text-foreground leading-tight truncate">
              {user.displayName}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">@{user.handle}</div>
            {user.location && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-[0.1em]">{user.location}</div>
            )}
          </div>
        </div>

        {/* Ink badges */}
        {ink && ink.badges.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {ink.badges.map((b) => (
              <span key={b} className="text-[10px] px-2.5 py-1 rounded-full bg-ochre/10 text-ochre border border-ochre/20">
                {BADGE_LABELS[b]}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {user.bio && (
          <div className="text-[14px] font-['Playfair_Display'] italic text-foreground/80 leading-[1.6] mb-5 whitespace-pre-line">
            {user.bio}
          </div>
        )}

        {/* ── Primary stats row: Followers / Following / Works ── */}
        <div className="grid grid-cols-3 gap-0 mb-1">
          <Link href={`/u/${user.handle}/followers`}
            className="text-center py-2.5 rounded-xl hover:bg-card transition-colors">
            <div className="text-[20px] font-['Playfair_Display'] leading-none">{followersCount.toLocaleString()}</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">followers</div>
          </Link>
          <Link href={`/u/${user.handle}/following`}
            className="text-center py-2.5 rounded-xl hover:bg-card transition-colors">
            <div className="text-[20px] font-['Playfair_Display'] leading-none">{followingCount.toLocaleString()}</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">following</div>
          </Link>
          <div className="text-center py-2.5">
            <div className="text-[20px] font-['Playfair_Display'] leading-none">{posts.length}</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">works</div>
          </div>
        </div>

        {/* ── Secondary row: Subscribers + Wallet ── */}
        <div className="flex gap-2 mb-5 mt-1">
          <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border/50">
            <Star size={13} className="text-plum shrink-0" />
            <div>
              <div className="text-[15px] font-['Playfair_Display'] leading-none">{subscribers.length}</div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">subscribers</div>
            </div>
          </div>
          <Link href="/wallet"
            className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border/50 hover:border-sage/40 transition-colors">
            <span className="text-sage text-[14px] font-['Inter'] shrink-0">₹</span>
            <div>
              <div className="text-[15px] font-['Playfair_Display'] leading-none text-sage">
                {balance >= 1000 ? `${(balance / 1000).toFixed(1)}k` : balance}
              </div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">wallet</div>
            </div>
          </Link>
        </div>

        {/* Quick action cards — hidden in visitor view */}
        {!viewAs && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Link href="/rewards"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-card hover:border-ochre/50 hover:bg-ochre/5 transition-colors">
              <Zap size={15} className="text-ochre" />
              <div className="text-[13px] font-['Playfair_Display']">{ink?.points ?? 0}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Ink pts</div>
            </Link>
            <Link href="/creator-plan"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-card hover:border-plum/50 hover:bg-plum/5 transition-colors">
              <Star size={15} className="text-plum" />
              <div className="text-[13px] font-['Playfair_Display']">{plan?.enabled ? `₹${plan.priceMonthly}` : "—"}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">My plan</div>
            </Link>
            <Link href="/settings/account"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-card hover:border-sage/50 hover:bg-sage/5 transition-colors">
              <BadgeCheck size={15} className="text-sage" />
              <div className="text-[13px] font-['Playfair_Display']">Edit</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Profile</div>
            </Link>
          </div>
        )}

        {/* Action buttons — host Mehfil hidden in visitor view */}
        <div className="flex gap-2">
          {!viewAs && (
            <Link href="/mehfil/host/new" className="flex-1">
              <button className="w-full text-[13px] font-['Inter'] text-background bg-foreground rounded-full py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Radio size={14} /> Host Mehfil
              </button>
            </Link>
          )}
          <button
            onClick={() => navigator.clipboard?.writeText(window.location.origin + `/u/${user.handle}`)}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs — only show "saved" when not in visitor view */}
      <div className="border-t border-border px-6 flex gap-6">
        {(viewAs ? (["posts"] as const) : (["posts", "saved"] as const)).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`py-3 text-[12px] uppercase tracking-[0.15em] border-b-2 transition-colors ${tab === t ? "border-terracotta text-foreground" : "border-transparent text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {/* Posts grid */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3 pb-10">
        {displayed.map((p) => <ProfilePostCard key={p.id} post={p} />)}
        {displayed.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted-foreground font-['Playfair_Display'] italic text-[14px]">
            {tab === "saved" ? "No saved works yet." : "Nothing published yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePostCard({ post }: { post: Post }) {
  const isAudio = post.kind === "voice" || post.kind === "reel";
  const KIND_COLOR: Record<string, string> = {
    voice: "bg-ochre", text: "bg-sage", story: "bg-violet", reel: "bg-plum",
  };
  return (
    <Link href={`/post/${post.id}`} className="block rounded-xl overflow-hidden bg-card border border-border hover:border-terracotta transition-colors">
      <div className="relative aspect-[4/5] bg-muted">
        {post.coverUrl
          ? <img src={post.coverUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center p-3 text-center font-['Playfair_Display'] text-[15px] text-foreground/80" style={{ background: "linear-gradient(135deg,hsl(var(--ochre)/0.15),hsl(var(--plum)/0.15))" }}>{post.title}</div>
        }
        <div className="absolute top-2 left-2">
          <span className={`text-[8px] text-white px-1.5 py-0.5 rounded-full ${KIND_COLOR[post.kind]}`}>{post.kind.toUpperCase()}</span>
        </div>
        {isAudio && (
          <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow">
            {post.kind === "voice" ? <Mic size={11} className="text-terracotta" /> : <Play size={10} className="text-plum ml-0.5" />}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-[12px] font-['Playfair_Display'] line-clamp-1">{post.title}</div>
        <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Heart size={9} />{post.likes.toLocaleString()}</span>
          <span className="flex items-center gap-1"><MessageCircle size={9} />{post.comments}</span>
        </div>
      </div>
    </Link>
  );
}
