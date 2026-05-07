import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreHorizontal, Heart, MessageCircle, Play, Check, Star, X } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useUserByHandle, useFollow, usePostsByAuthor, useIsFollowing, getCurrentUserId,
  useAuthorPlan, useSubscribersOf, useIsSubscribedTo, useSubscribeToAuthor,
  useUnsubscribeFromAuthor, useWalletBalance,
} from "@/lib/store";

export default function UserProfile() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle ?? "";
  const [, setLocation] = useLocation();
  const { data: user } = useUserByHandle(handle);
  const [tab, setTab] = useState<"posts" | "tipped" | "saved">("posts");
  const [subSheet, setSubSheet] = useState(false);
  const follow = useFollow();
  const subscribe = useSubscribeToAuthor();
  const unsubscribe = useUnsubscribeFromAuthor();
  useTitle(user ? user.displayName : "Profile");

  const me = getCurrentUserId();
  const { data: plan } = useAuthorPlan(user?.id ?? "");
  const { data: subscribers = [] } = useSubscribersOf(user?.id ?? "");
  const { data: posts = [] } = usePostsByAuthor(user?.id ?? "");
  const { data: following = false } = useIsFollowing(me ?? "", user?.id ?? "");
  const { data: subscribed = false } = useIsSubscribedTo(me ?? "", user?.id ?? "");
  const { data: walletBalance = 0 } = useWalletBalance(me);

  if (!user) return <div className="p-10 text-center text-muted-foreground">User not found.</div>;

  const isMe = me === user.id;
  const followersCount = user.followers;
  const followingCount = user.following;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">@{user.handle}</div>
        <button className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><MoreHorizontal size={16} /></button>
      </div>

      {/* Hero */}
      <div className="px-6 mt-2">
        <div className="flex items-start gap-4">
          <img src={user.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover" />
          <div className="flex-1 pt-1">
            <div className="font-['Playfair_Display'] text-[24px] leading-tight flex items-center gap-2">
              {user.displayName}
              {user.verified && <span className="w-4 h-4 rounded-full bg-sage text-white flex items-center justify-center text-[9px]">✓</span>}
            </div>
            <div className="text-[12px] text-muted-foreground">@{user.handle}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{user.location} · {user.language === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}</div>
          </div>
        </div>
        <div className="text-[14px] mt-3 text-foreground/85 font-['Playfair_Display'] italic leading-snug">{user.bio}</div>

        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <Link href={`/u/${user.handle}/followers`}>
            <div className="text-[18px] font-['Playfair_Display']">{followersCount.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Followers</div>
          </Link>
          <Link href={`/u/${user.handle}/following`}>
            <div className="text-[18px] font-['Playfair_Display']">{followingCount.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Following</div>
          </Link>
          <div>
            <div className="text-[18px] font-['Playfair_Display']">{posts.length}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-[18px] font-['Playfair_Display']">{subscribers.length}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Subs</div>
          </div>
        </div>

        {!isMe && (
          <div className="mt-5 flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => follow.mutate({ userId: user.id, on: !following })}
              className={`flex-1 py-3 rounded-xl text-[13px] transition-colors ${following ? "bg-card border border-border" : "bg-foreground text-background"}`}>
              {following ? "Following" : "Follow"}
            </motion.button>
            <button onClick={() => setLocation("/messages")}
              className="flex-1 py-3 rounded-xl border border-border text-[13px] hover:bg-card transition-colors">
              Message
            </button>
          </div>
        )}

        {/* Subscription plan card */}
        {!isMe && plan?.enabled && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-ochre/30 bg-ochre/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} className="text-ochre" />
              <div className="text-[12px] uppercase tracking-[0.15em] text-ochre">Subscriber plan</div>
            </div>
            <div className="space-y-1 mb-3">
              {plan.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-foreground/80">
                  <Check size={11} className="text-sage shrink-0" />{b}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="font-['Playfair_Display'] text-[20px]">
                ₹{plan.priceMonthly}<span className="text-[12px] text-muted-foreground font-['Inter'] ml-1">/month</span>
              </div>
              {subscribed ? (
                <button onClick={() => unsubscribe.mutate(user.id)}
                  className="px-4 py-2 rounded-xl border border-border text-[12px] text-muted-foreground hover:border-destructive hover:text-destructive transition-colors">
                  Subscribed ✓
                </button>
              ) : (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setSubSheet(true)}
                  className="px-4 py-2 rounded-xl text-[12px] text-white"
                  style={{ background: "linear-gradient(90deg, hsl(var(--ochre)), hsl(var(--terracotta)))" }}>
                  Subscribe
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 mt-7 flex gap-5 border-b border-border">
        {(["posts", "tipped", "saved"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-[12px] uppercase tracking-[0.15em] ${tab === t ? "text-foreground border-b-2 border-terracotta" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {/* Posts grid */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3 pb-10">
        {posts.map((p) => (
          <Link key={p.id} href={`/post/${p.id}`} className="block rounded-xl overflow-hidden bg-card border border-border">
            <div className="relative aspect-[4/5] bg-muted">
              {p.coverUrl ? <img src={p.coverUrl} alt="" className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex items-center justify-center font-['Playfair_Display'] text-[16px] p-3 text-center" style={{ background: "linear-gradient(135deg,hsl(var(--ochre)/0.18),hsl(var(--plum)/0.18))" }}>{p.title}</div>
              )}
              {p.accessType && p.accessType !== "free" && (
                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-bold ${p.accessType === "premium" ? "bg-plum text-white" : "bg-ochre text-white"}`}>
                  {p.accessType === "premium" ? "Premium" : `₹${p.minTip}`}
                </div>
              )}
              {p.kind !== "text" && <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[9px] uppercase">{p.kind}</div>}
              {(p.kind === "voice" || p.kind === "reel") && <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center"><Play size={11} /></div>}
            </div>
            <div className="p-2.5">
              <div className="text-[12px] font-['Playfair_Display'] line-clamp-1">{p.title}</div>
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Heart size={10} />{p.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle size={10} />{p.comments}</span>
              </div>
            </div>
          </Link>
        ))}
        {posts.length === 0 && <div className="col-span-2 text-center text-muted-foreground text-[13px] py-10">No posts yet.</div>}
      </div>

      {/* Subscribe confirmation sheet */}
      <AnimatePresence>
        {subSheet && plan && (
          <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSubSheet(false)}>
            <motion.div initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[430px] bg-background rounded-t-3xl p-6 pb-10">
              <div className="w-8 h-1 rounded-full bg-muted mx-auto mb-5" />
              <div className="flex items-center gap-3 mb-4">
                <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-['Playfair_Display'] text-[18px]">Subscribe to {user.displayName}</div>
                  <div className="text-[12px] text-muted-foreground">₹{plan.priceMonthly}/month · cancel anytime</div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 mb-4 space-y-1.5">
                {plan.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]"><Check size={12} className="text-sage" />{b}</div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-4 px-1">
                <span>Your wallet: ₹{walletBalance.toLocaleString()}</span>
                <span>After: ₹{(walletBalance - plan.priceMonthly).toLocaleString()}</span>
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { subscribe.mutate(user.id); setSubSheet(false); }}
                disabled={subscribe.isPending}
                className="w-full py-3.5 rounded-xl text-white text-[14px] disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, hsl(var(--ochre)), hsl(var(--terracotta)))" }}>
                Subscribe · ₹{plan.priceMonthly}
              </motion.button>
              <button onClick={() => setSubSheet(false)} className="w-full mt-2 py-2.5 rounded-xl border border-border text-[13px] text-muted-foreground">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {subSheet && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSubSheet(false)}
            className="fixed top-5 right-5 z-[51] w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
            <X size={16} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
