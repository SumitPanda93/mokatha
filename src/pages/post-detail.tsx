import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Share2, Play, Pause, Send, MoreHorizontal, Lock, Star, Zap, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  usePost, useComments, useUser, useLike, useAddComment, useTip, useFeed,
  getCurrentUserId, useIsPostUnlocked, useUnlockPostWithTip, useUnlockPostWithPoints,
  useIsSubscribedTo, useAuthorPlan, useInkReward, useEarnInkPoints,
  useUpdatePost, useDeletePost,
} from "@/lib/store";
import { toast } from "sonner";
import PaymentModal from "@/components/PaymentModal";

const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function LockedOverlay({ post, author, onUnlocked }: { post: any; author: any; onUnlocked: () => void }) {
  const unlockTip = useUnlockPostWithTip();
  const unlockPts = useUnlockPostWithPoints();
  const { data: plan } = useAuthorPlan(post.authorId);
  const me = getCurrentUserId() ?? "";
  const { data: ink } = useInkReward(me);
  const hasPts = (ink?.points ?? 0) >= 50;
  const [, setLocation] = useLocation();

  const doTipUnlock = (amount: number) => {
    unlockTip.mutate({ postId: post.id, amount }, { onSuccess: (r) => { if (r === "ok") onUnlocked(); } });
  };
  const doPtsUnlock = () => {
    unlockPts.mutate(post.id, { onSuccess: (r) => { if (r === "ok") onUnlocked(); } });
  };

  return (
    <div className="mx-5 mt-6 rounded-2xl border border-border overflow-hidden">
      {/* Blurred preview of text */}
      <div className="relative p-5">
        <div className="font-['Playfair_Display'] text-[17px] leading-[1.7] text-foreground/80 line-clamp-3 select-none">
          {post.body?.split("\n")[0]}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" style={{ backdropFilter: "blur(4px)" }} />
      </div>

      {/* Lock CTA */}
      <div className="px-5 pb-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-foreground/8 border border-border flex items-center justify-center mx-auto mb-3">
          <Lock size={20} className="text-muted-foreground" />
        </div>

        {post.accessType === "premium" ? (
          <>
            <div className="font-['Playfair_Display'] text-[18px] mb-1">Subscribers only</div>
            <div className="text-[12px] text-muted-foreground mb-4">Subscribe to {author?.displayName} to read this piece</div>
            {plan?.enabled ? (
              <div className="space-y-2">
                <button onClick={() => setLocation(`/u/${author?.handle}`)}
                  className="w-full py-3 rounded-xl text-white text-[13px]"
                  style={{ background: "linear-gradient(90deg, hsl(var(--ochre)), hsl(var(--terracotta)))" }}>
                  <Star size={13} className="inline mr-1.5" />
                  Subscribe · ₹{plan.priceMonthly}/month
                </button>
              </div>
            ) : (
              <button onClick={() => setLocation(`/u/${author?.handle}`)}
                className="w-full py-3 rounded-xl bg-foreground text-background text-[13px]">
                View author profile
              </button>
            )}
          </>
        ) : (
          <>
            <div className="font-['Playfair_Display'] text-[18px] mb-1">Tip to read</div>
            <div className="text-[12px] text-muted-foreground mb-4">Minimum ₹{post.minTip ?? 10} to unlock this piece</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Array.from(new Set([post.minTip ?? 10, (post.minTip ?? 10) * 2, (post.minTip ?? 10) * 5, 100])).slice(0, 4).map((v: number) => (
                <button key={v} onClick={() => doTipUnlock(v)}
                  disabled={unlockTip.isPending}
                  className="py-2.5 rounded-xl border border-ochre text-ochre text-[13px] hover:bg-ochre hover:text-white transition-colors disabled:opacity-50">
                  Tip ₹{v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
              <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
            </div>
            <button onClick={doPtsUnlock} disabled={!hasPts || unlockPts.isPending}
              className={`w-full py-2.5 rounded-xl text-[13px] border transition-colors ${hasPts ? "border-violet text-violet hover:bg-violet hover:text-white" : "border-border text-muted-foreground opacity-50 cursor-not-allowed"}`}>
              <Zap size={13} className="inline mr-1.5" />
              Use 50 Ink Points {!hasPts && `(you have ${ink?.points ?? 0})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();
  const { data: post } = usePost(id);
  const { data: comments = [] } = useComments(id);
  const { data: author } = useUser(post?.authorId ?? "");
  const { data: feed = [] } = useFeed();
  const like = useLike(id);
  const addC = useAddComment(id);
  const tip = useTip("post");
  const earnPts = useEarnInkPoints();
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [stripeTipOpen, setStripeTipOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useTitle(post?.title ?? "Poem");

  const me = getCurrentUserId() ?? "";
  const isAuthor = post?.authorId === me;
  useIsSubscribedTo(me, post?.authorId ?? "");
  const { data: remoteUnlocked = false } = useIsPostUnlocked(me, post?.id ?? "");

  const locked = post ? !isAuthor && !unlocked && !remoteUnlocked : false;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Wire ended event to reset play state
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [post?.audioUrl]);

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().catch(() => {});
      setPlaying(true);
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const progressPct = post?.durationSec ? Math.min((currentTime / post.durationSec) * 100, 100) : 0;

  const updatePost = useUpdatePost();
  const deletePostMut = useDeletePost();

  // Earn +5 points when reading a post (once per session)
  useEffect(() => {
    if (post && me && !isAuthor) {
      earnPts.mutate({ userId: me, points: 5 });
    }
  }, [post?.id]);

  if (!post) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const isAudio = post.kind === "voice" || post.kind === "reel";
  const related = feed.filter((p) => p.id !== post.id && p.tags.some((t) => post.tags.includes(t))).slice(0, 3);

  const ACCESS_BADGE: Record<string, { label: string; cls: string }> = {
    free:    { label: "Free",    cls: "bg-sage text-white" },
    tip:     { label: `Tip ₹${post.minTip ?? ""}`, cls: "bg-ochre text-white" },
    premium: { label: "Premium", cls: "bg-plum text-white" },
  };
  const badge = post.accessType ? ACCESS_BADGE[post.accessType] : null;

  const sendTip = (amt: number) => { tip.mutate({ id: post.id, amount: amt }); setTipOpen(false); };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <style>{`
        @keyframes pd-bar { 0%,100% { height: 18%; } 50% { height: 100%; } }
      `}</style>
      <div className="px-5 py-3 flex items-center justify-between sticky top-0 z-30 bg-background/85 backdrop-blur-md">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{post.kind}</div>
          {badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>}
        </div>
        <button onClick={() => setOwnerMenuOpen(true)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><MoreHorizontal size={16} /></button>
      </div>

      {/* Cover */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5">
        <div className="relative rounded-2xl overflow-hidden">
          {post.coverUrl && <img src={post.coverUrl} alt="" className={`w-full aspect-[16/10] object-cover ${locked ? "blur-sm" : ""}`} />}
          {!post.coverUrl && <div className="w-full aspect-[16/10] bg-gradient-to-br from-ochre/20 to-plum/20" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/80 mb-1">{post.tags[0]}</div>
            <div className="font-['Playfair_Display'] text-[28px] leading-tight text-white">{post.title}</div>
          </div>
        </div>
      </motion.div>

      {/* Author strip */}
      {author && (
        <div className="px-5 mt-4 flex items-center justify-between">
          <Link href={`/u/${author.handle}`} className="flex items-center gap-3">
            <img src={author.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            <div>
              <div className="text-[14px] font-medium leading-tight">{author.displayName}</div>
              <div className="text-[11px] text-muted-foreground">@{author.handle}</div>
            </div>
          </Link>
          <button onClick={() => setStripeTipOpen(true)} className="text-[12px] px-3 py-1.5 rounded-full border border-ochre text-ochre hover:bg-ochre hover:text-white transition-colors">Tip</button>
        </div>
      )}

      {/* Audio player */}
      {isAudio && !locked && (
        <div className="mx-5 mt-5 rounded-2xl border border-border bg-card p-4">
          {post.audioUrl && (
            <audio ref={audioRef} src={post.audioUrl} preload="metadata" className="hidden" />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              disabled={!post.audioUrl}
              className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-40"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className="flex-1">
              {post.audioUrl ? (
                <>
                  {/* Waveform bars */}
                  <div className="flex items-end gap-[2px] h-7">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <span key={i} className="w-[3px] bg-terracotta rounded-sm" style={{ height: `${20 + ((i * 17) % 80)}%`, animation: playing ? `pd-bar 1.${(i % 9) + 2}s ease-in-out infinite` : "none" }} />
                    ))}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-terracotta rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{fmtTime(currentTime)}</span>
                    <span>{fmt(post.durationSec)}</span>
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-muted-foreground italic">No audio available for this post</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Locked overlay or Body */}
      {locked ? (
        <LockedOverlay post={post} author={author} onUnlocked={() => setUnlocked(true)} />
      ) : (
        <div className="px-6 mt-6">
          <div className="font-['Playfair_Display'] text-[18px] leading-[1.7] text-foreground whitespace-pre-line">{post.body}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground">#{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="px-5 mt-5 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => like.mutate()} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border ${post.liked ? "bg-terracotta text-white border-terracotta" : "border-border text-foreground"}`}>
          <Heart size={15} fill={post.liked ? "currentColor" : "none"} /><span className="text-[12px]">{post.likes}</span>
        </motion.button>
        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border">
          <MessageCircle size={15} /><span className="text-[12px]">{post.comments}</span>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); earnPts.mutate({ userId: me, points: 5 }); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border ml-auto">
          <Share2 size={15} /><span className="text-[12px]">Share</span>
        </button>
      </div>

      {/* Comments */}
      {!locked && (
        <div className="px-5 mt-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Comments · {comments.length}</div>
          <div className="space-y-3">
            {comments.map((c, i) => <CommentRow key={c.id} c={c} idx={i} />)}
            {comments.length === 0 && <div className="text-[12px] text-muted-foreground italic">Be the first to leave a quiet word.</div>}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" className="flex-1 bg-card border border-border rounded-full px-4 py-2.5 text-[13px] outline-none focus:border-terracotta" />
            <button onClick={() => { if (draft.trim()) { addC.mutate(draft); setDraft(""); } }} className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Related */}
      {!locked && related.length > 0 && (
        <div className="px-5 mt-9 mb-10">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Read next</div>
          <div className="space-y-2">
            {related.map((r) => (
              <Link key={r.id} href={`/post/${r.id}`} className="block p-3 rounded-xl bg-card border border-border hover:border-terracotta">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{r.kind}</div>
                <div className="text-[15px] font-['Playfair_Display']">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stripeTipOpen && post && author && (
        <PaymentModal
          mode="tip"
          recipientId={post.authorId}
          postId={post.id}
          onClose={() => setStripeTipOpen(false)}
        />
      )}

      {/* Owner action sheet */}
      {ownerMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => { setOwnerMenuOpen(false); setConfirmDelete(false); }}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-4 pb-10"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

            {isAuthor ? (
              <>
                {/* Edit */}
                <button
                  onClick={() => { setOwnerMenuOpen(false); setLocation(`/post/${post.id}/edit`); }}
                  className="w-full flex items-center gap-4 py-4 border-b border-border"
                >
                  <div className="w-9 h-9 rounded-full bg-ochre/12 flex items-center justify-center">
                    <Edit2 size={15} className="text-ochre" />
                  </div>
                  <span className="text-[14px] font-['Inter']">Edit post</span>
                </button>

                {/* Private/Public toggle */}
                <button
                  onClick={() => {
                    updatePost.mutate({ postId: post.id, patch: { isPrivate: !post.isPrivate } });
                    setOwnerMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 py-4 border-b border-border"
                >
                  <div className="w-9 h-9 rounded-full bg-plum/12 flex items-center justify-center">
                    {post.isPrivate ? <Eye size={15} className="text-plum" /> : <EyeOff size={15} className="text-plum" />}
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-['Inter']">{post.isPrivate ? "Make public" : "Make private"}</div>
                    <div className="text-[11px] text-muted-foreground">{post.isPrivate ? "Everyone can see" : "Only you can see"}</div>
                  </div>
                </button>

                {/* Delete */}
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-4 py-4">
                    <div className="w-9 h-9 rounded-full bg-red-500/12 flex items-center justify-center">
                      <Trash2 size={15} className="text-red-500" />
                    </div>
                    <span className="text-[14px] font-['Inter'] text-red-500">Delete post</span>
                  </button>
                ) : (
                  <div className="pt-4">
                    <div className="text-[13px] text-muted-foreground text-center mb-4">This cannot be undone. Are you sure?</div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl border border-border text-[13px]">Cancel</button>
                      <button
                        onClick={() => {
                          deletePostMut.mutate(post.id, { onSuccess: () => { setOwnerMenuOpen(false); setLocation("/"); } });
                        }}
                        disabled={deletePostMut.isPending}
                        className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[13px] disabled:opacity-50"
                      >
                        {deletePostMut.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 text-center text-muted-foreground text-[13px]">No actions available.</div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ c, idx }: any) {
  const { data: author } = useUser(c.authorId);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="flex gap-3">
      <img src={author?.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
      <div className="flex-1">
        <div className="text-[12px] font-medium">{author?.displayName}</div>
        <div className="text-[13px] text-foreground/85 leading-snug">{c.body}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</div>
      </div>
    </motion.div>
  );
}
