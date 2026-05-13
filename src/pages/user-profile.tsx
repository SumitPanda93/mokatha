import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, Heart, MessageCircle, Play, Check, Star, X, Mic, FileText, BookOpen, Clapperboard, Mail } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useUserByHandle, useFollow, usePostsByAuthor, useIsFollowing, getCurrentUserId,
  useAuthorPlan, useSubscribersOf, useIsSubscribedTo, useSubscribeToAuthor,
  useUnsubscribeFromAuthor, useWalletBalance, getOrCreateConversationId,
  Post,
} from "@/lib/store";
import SupportSheet from "@/components/SupportSheet";
import AudioLetterRecorder from "@/components/AudioLetterRecorder";
import { ProfileShareSheet } from "@/components/ProfileShareSheet";
import { ProfileGatheringsSection } from "@/components/ProfileGatheringsSection";
import { trackEvent } from "@/lib/analytics";

// ─── Kind gradient fallback ───────────────────────────────────────────────────

function kindGradient(kind: string): string {
  switch (kind) {
    case "voice": return "linear-gradient(135deg, #1C0F06, #2E1A0C)";
    case "story": return "linear-gradient(135deg, #1A0A14, #2A1528)";
    case "reel":  return "linear-gradient(135deg, #0E0717, #1A0F2E)";
    default:      return "linear-gradient(135deg, hsl(var(--ochre)/0.14), hsl(var(--plum)/0.14))";
  }
}

function kindIcon(kind: string) {
  switch (kind) {
    case "voice": return <Mic size={12} className="text-ochre" />;
    case "reel":  return <Clapperboard size={12} className="text-plum" />;
    case "story": return <BookOpen size={12} className="text-violet" />;
    default:      return <FileText size={12} className="text-sage" />;
  }
}

// ─── Featured post card ───────────────────────────────────────────────────────

function FeaturedCard({ post }: { post: Post }) {
  const isAudio = post.kind === "voice" || post.kind === "reel";
  return (
    <Link href={`/post/${post.id}`} className="block">
      <motion.div whileTap={{ scale: 0.985 }} className="relative rounded-2xl overflow-hidden">
        {post.coverUrl
          ? <img src={post.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" />
          : <div className="w-full aspect-[16/9]" style={{ background: kindGradient(post.kind) }} />
        }
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }} />

        {/* Kind badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white/90 text-[9px] font-['Inter'] tracking-[0.15em] uppercase rounded-full px-2.5 py-1">
          {kindIcon(post.kind)}<span className="ml-0.5">{post.kind}</span>
        </div>

        {/* Play icon for audio */}
        {isAudio && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)", border: "1.5px solid rgba(255,255,255,0.35)", backdropFilter: "blur(4px)" }}>
              <Play size={16} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-[18px] font-['Playfair_Display'] text-white leading-tight">{post.title}</div>
          <div className="flex gap-3 text-[11px] text-white/60 mt-1.5">
            <span className="flex items-center gap-1"><Heart size={11} fill="currentColor" />{post.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle size={11} />{post.comments}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Post grid item ───────────────────────────────────────────────────────────

function PostGridItem({ p }: { p: Post }) {
  const isAudio = p.kind === "voice" || p.kind === "reel";
  return (
    <Link href={`/post/${p.id}`} className="block rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-terracotta/25 transition-all duration-300 active:scale-[0.992]">
      <div className="relative aspect-[4/5] bg-muted">
        {p.coverUrl
          ? <img src={p.coverUrl} alt="" className="w-full h-full object-cover" decoding="async" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center px-3" style={{ background: kindGradient(p.kind) }}>
              <div className="font-['Playfair_Display'] text-[13px] text-white/80 text-center line-clamp-3">{p.title}</div>
            </div>
        }
        {p.accessType && p.accessType !== "free" && (
          <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-bold shadow-sm ${p.accessType === "premium" ? "bg-plum text-white" : "bg-ochre text-white"}`}>
            {p.accessType === "premium" ? "Premium" : `₹${p.minTip}`}
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/45 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/8">
          {kindIcon(p.kind)}
        </div>
        {isAudio && (
          <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center">
            <Play size={11} className="ml-0.5" />
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 bg-card/90 backdrop-blur-sm border-t border-border/25">
        <div className="text-[12px] font-['Playfair_Display'] line-clamp-1">{p.title}</div>
        <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Heart size={10} />{p.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle size={10} />{p.comments}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserProfile() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle ?? "";
  const [, setLocation] = useLocation();
  const { data: user } = useUserByHandle(handle);
  const [tab, setTab] = useState<"posts" | "tipped" | "saved">("posts");
  const [subSheet, setSubSheet] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [audioLetterOpen, setAudioLetterOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  useEffect(() => {
    const uid = user?.id;
    const self = getCurrentUserId();
    if (!uid || !self || uid === self) return;
    trackEvent("creator_profile_open", { creator_id: uid });
  }, [user?.id]);

  if (!user) return <div className="p-10 text-center text-muted-foreground">User not found.</div>;

  const isMe = me === user.id;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${user.handle}` : "";

  // Pick the most prominent recent post for the featured card
  const featuredPost = posts.find((p) => p.kind === "voice" || p.kind === "story") ?? posts[0];
  const gridPosts = posts.filter((p) => p !== featuredPost);

  // Split bio into quote (first line) and rest
  const bioLines = (user.bio ?? "").split("\n");
  const bioQuote = bioLines[0];
  const bioRest = bioLines.slice(1).join("\n").trim();

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">@{user.handle}</div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted/40 transition-colors"
          aria-label="Share profile"
        >
          <Share2 size={16} strokeWidth={1.6} />
        </button>
      </div>

      {/* ── Creator Hero ── */}
      <div className="px-6 mt-2">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative shrink-0">
            <img src={user.avatarUrl} alt="" className="w-[76px] h-[76px] rounded-2xl object-cover" />
            {user.verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sage border-2 border-background flex items-center justify-center text-[9px] text-white font-bold">✓</div>
            )}
          </div>
          <div className="flex-1 pt-0.5">
            <div className="font-['Playfair_Display'] text-[24px] leading-tight text-foreground">{user.displayName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">@{user.handle}</div>
            {user.location && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-[0.12em]">
                {user.location} · {user.language === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
              </div>
            )}
          </div>
        </div>

        {/* Creator quote / bio */}
        {bioQuote && (
          <div className="relative pl-4 mb-2" style={{ borderLeft: "2px solid hsl(var(--terracotta)/0.5)" }}>
            <div className="font-['Playfair_Display'] text-[16px] italic leading-[1.55] text-foreground/85">{bioQuote}</div>
          </div>
        )}
        {bioRest && (
          <div className="text-[12px] font-['Inter'] text-muted-foreground leading-[1.65] mt-2">{bioRest}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <Link href={`/u/${user.handle}/followers`}>
            <div className="text-[18px] font-['Playfair_Display']">{user.followers.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Followers</div>
          </Link>
          <Link href={`/u/${user.handle}/following`}>
            <div className="text-[18px] font-['Playfair_Display']">{user.following.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Following</div>
          </Link>
          <div>
            <div className="text-[18px] font-['Playfair_Display']">{posts.length}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Posts</div>
          </div>
          <div>
            <div className="text-[18px] font-['Playfair_Display']">{subscribers.length}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Subs</div>
          </div>
        </div>

        {/* Actions */}
        {!isMe && (
          <>
            <div className="mt-5 flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => follow.mutate({ userId: user.id, on: !following })}
                className={`flex-1 py-3 rounded-xl text-[13px] font-['Inter'] transition-colors ${following ? "bg-card border border-border text-foreground" : "bg-foreground text-background"}`}>
                {following ? "Following" : "Follow"}
              </motion.button>
              <button
                disabled={msgLoading || !me}
                onClick={async () => {
                  if (!me) { setLocation("/auth/login"); return; }
                  setMsgLoading(true);
                  try {
                    const convId = await getOrCreateConversationId(me, user.id);
                    setLocation(`/messages?open=${convId}`);
                  } finally { setMsgLoading(false); }
                }}
                className="flex-1 py-3 rounded-xl border border-border text-[13px] font-['Inter'] hover:bg-card transition-colors disabled:opacity-50">
                {msgLoading ? "…" : "Message"}
              </button>
            </div>
            {/* Appreciation row */}
            {me && (
              <div className="mt-2 flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => setSupportOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[12px] font-['Inter'] transition-colors"
                  style={{ borderColor: "hsl(var(--ochre)/0.35)", color: "hsl(var(--ochre))", background: "hsl(var(--ochre)/0.06)" }}>
                  ☕ Appreciate
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => setAudioLetterOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-[12px] font-['Inter'] hover:bg-card transition-colors text-muted-foreground">
                  <Mail size={13} /> Voice letter
                </motion.button>
              </div>
            )}
          </>
        )}

        {/* Subscription plan card */}
        {!isMe && plan?.enabled && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-ochre/30 bg-ochre/5 p-4">
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

      <ProfileGatheringsSection hostId={user.id} forVisitor={!isMe} />

      {/* ── Featured post ── */}
      {featuredPost && (
        <div className="px-5 mt-7">
          <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-terracotta" />
            Featured work
          </div>
          <FeaturedCard post={featuredPost} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="relative border-b border-border/40 mt-6">
        <div className="flex px-6 gap-0">
          {(["posts", "tipped", "saved"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative pb-3 pt-0.5 pr-5 text-[11px] uppercase tracking-[0.15em] transition-colors ${tab === t ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
              {t}
              {tab === t && (
                <motion.div layoutId="profile-tab-line"
                  className="absolute bottom-0 left-0 right-3 h-[1.5px] rounded-full bg-terracotta"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content type legend ── */}
      {tab === "posts" && posts.length > 0 && (
        <div className="px-5 mt-3 flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {(["voice", "text", "story", "reel"] as const).filter((k) => posts.some((p) => p.kind === k)).map((k) => (
            <div key={k} className="flex items-center gap-1.5 shrink-0 text-[10px] font-['Inter'] text-muted-foreground">
              {kindIcon(k)}<span className="capitalize">{k}</span>
              <span className="text-muted-foreground/50">({posts.filter((p) => p.kind === k).length})</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Posts grid ── */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-4 pb-16">
        {(tab === "posts" ? gridPosts : posts).map((p) => (
          <PostGridItem key={p.id} p={p} />
        ))}
        {posts.length === 0 && (
          <div className="col-span-2 flex flex-col items-center py-16 px-6 text-center gap-3">
            <div className="w-14 h-14 rounded-3xl bg-muted/80 border border-border/50 flex items-center justify-center">
              <FileText size={22} className="text-muted-foreground/60" />
            </div>
            <div className="font-['Playfair_Display'] text-[17px] italic text-muted-foreground">Still waters.</div>
            <p className="text-[12px] text-muted-foreground/65 font-['Inter'] leading-relaxed max-w-[280px]">
              This creator has not shared a public piece here yet — check back when inspiration strikes.
            </p>
          </div>
        )}
      </div>

      {/* ── Subscribe sheet ── */}
      <AnimatePresence>
        {subSheet && plan && (
          <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSubSheet(false)}>
            <motion.div initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] bg-background rounded-t-3xl p-6 pb-10">
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

      {/* Appreciation sheet */}
      <AnimatePresence>
        {supportOpen && (
          <SupportSheet
            toUserId={user.id}
            toUserName={user.displayName}
            onClose={() => setSupportOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Voice letter recorder */}
      <AnimatePresence>
        {audioLetterOpen && (
          <AudioLetterRecorder
            toUserId={user.id}
            toUserName={user.displayName}
            onClose={() => setAudioLetterOpen(false)}
          />
        )}
      </AnimatePresence>

      <ProfileShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        profileUrl={shareUrl}
        displayName={user.displayName}
        handle={user.handle}
        avatarUrl={user.avatarUrl}
      />
    </div>
  );
}
