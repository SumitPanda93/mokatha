import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Share2, MoreHorizontal, Bell, Check, Star, X, Mail,
  MapPin, Calendar, Mic, Settings, Wallet, Zap, Radio, BadgeCheck, Eye, EyeOff,
  Heart, Archive, ArchiveRestore, Trash2, RotateCcw, MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFollow, usePostsByAuthor, useIsFollowing, getCurrentUserId,
  useAuthorPlan, useSubscribersOf, useIsSubscribedTo, useSubscribeToAuthor,
  useUnsubscribeFromAuthor, useWalletBalance, getOrCreateConversationId,
  useMehfilsForHost, useInkReward, useSavedPosts,
  useArchiveMehfil, useDeleteMehfil, useRestoreMehfilFeedVisibility,
  isMehfilDiscoveryExpired,
  type User, type Post, type Mehfil,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import SupportSheet from "@/components/SupportSheet";
import AudioLetterRecorder from "@/components/AudioLetterRecorder";
import { ProfileShareSheet } from "@/components/ProfileShareSheet";
import {
  ProfileShell, ProfileTopBar, ProfileIconButton, ProfileAvatar, ProfileStat, ProfileStatsRow,
  ProfileStatDivider, ProfileRolePill, ProfileVerifiedCheck, GoldGradientButton, ProfileTabs,
  WaveformBars, ProfileSectionLabel, ProfileCard, AboutRow, EmptyTabState,
  PROFILE_MUTED, PROFILE_GOLD, PROFILE_BORDER, PROFILE_CARD,
  type ProfileTabId,
} from "@/components/profile/profile-ui";

const CREATOR_ROLES = ["Writer", "Poet", "Storyteller", "Listener"] as const;
const BADGE_LABELS: Record<string, string> = {
  supporter: "💛 Supporter",
  "top-reader": "📖 Top Reader",
  "soul-listener": "🎧 Soul Listener",
};

const LANGUAGE_VOICE: Record<string, string> = {
  or: "Odia",
  hi: "Hindi",
};

function extractRole(bio?: string): string {
  if (!bio) return "Storyteller";
  const first = bio.split(" · ")[0]?.trim();
  return CREATOR_ROLES.includes(first as typeof CREATOR_ROLES[number]) ? first! : "Storyteller";
}

function formatJoined(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function mehfilDuration(m: Mehfil): string | null {
  if (!m.endedAt) return m.isLive ? "Live" : null;
  const ms = new Date(m.endedAt).getTime() - new Date(m.startsAt).getTime();
  if (ms <= 0) return null;
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function kindGradient(kind: string): string {
  switch (kind) {
    case "voice": return "linear-gradient(135deg, #1C0F06, #2E1A0C)";
    case "story": return "linear-gradient(135deg, #1A0A14, #2A1528)";
    case "reel": return "linear-gradient(135deg, #0E0717, #1A0F2E)";
    default: return "linear-gradient(135deg, rgba(201,168,76,0.14), rgba(177,74,139,0.14))";
  }
}

// ─── Mehfil host menu (from ProfileGatheringsSection) ───────────────────────

function GatheringHostMenu({ m, onClose }: { m: Mehfil; onClose: () => void }) {
  const del = useDeleteMehfil();
  const arch = useArchiveMehfil();
  const restoreFeed = useRestoreMehfilFeedVisibility();
  const expired = isMehfilDiscoveryExpired(m);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      className="absolute top-8 right-0 z-30 min-w-[168px] rounded-xl overflow-hidden shadow-xl"
      style={{ background: "#141010", border: `1px solid ${PROFILE_BORDER}` }}
      onClick={(e) => e.stopPropagation()}
    >
      {expired && !m.isLive ? (
        <button
          type="button"
          onClick={() => { restoreFeed.mutate(m.id); onClose(); }}
          disabled={restoreFeed.isPending}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-white/5 text-left"
        >
          <RotateCcw size={14} className="text-emerald-400" /> Show on feed 24h
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => { arch.mutate({ id: m.id, archived: !m.archived }); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] hover:bg-white/5 text-left"
      >
        {m.archived ? <><ArchiveRestore size={14} className="text-emerald-400" /> Restore archive</> : <><Archive size={14} style={{ color: PROFILE_GOLD }} /> Archive</>}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this gathering? Replays stay in posts unless removed separately.")) {
            del.mutate(m.id);
            onClose();
          }
        }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-['Inter'] text-red-400 hover:bg-red-500/10 text-left border-t"
        style={{ borderColor: PROFILE_BORDER }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </motion.div>
  );
}

function FeaturedMehfilCard({ m, showHostMenu }: { m: Mehfil; showHostMenu?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dur = mehfilDuration(m);

  return (
    <ProfileCard className="relative">
      <Link href={`/mehfil/${m.id}`} className="block active:opacity-90">
        <div className="relative h-[140px]">
          {m.coverUrl ? (
            <img src={m.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1C0F06, #2A1528)" }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }} />
          {m.isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-['Inter'] font-bold uppercase tracking-wider"
              style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="font-['Playfair_Display'] text-[17px] text-white leading-snug line-clamp-2">{m.title}</div>
            <div className="flex items-center justify-between mt-2 gap-3">
              <span className="text-[11px] font-['Inter']" style={{ color: "rgba(255,255,255,0.55)" }}>
                {m.listeners.toLocaleString()} listened
              </span>
              <div className="flex items-center gap-2">
                <WaveformBars animate={m.isLive} />
                {dur && dur !== "Live" && (
                  <span className="text-[10px] font-['Inter'] text-white/70 shrink-0">{dur}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
      {showHostMenu && (
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            aria-label="Mehfil options"
          >
            <MoreVertical size={15} className="text-white/80" />
          </button>
          <AnimatePresence>
            {menuOpen && <GatheringHostMenu m={m} onClose={() => setMenuOpen(false)} />}
          </AnimatePresence>
        </div>
      )}
    </ProfileCard>
  );
}

function MehfilListRow({ m, showHostMenu }: { m: Mehfil; showHostMenu?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const statusLabel = m.isLive ? "Live" : m.archived ? "Archived" : isMehfilDiscoveryExpired(m) ? "Library" : "Ended";

  return (
    <div className="relative flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: PROFILE_BORDER }}>
      <Link href={`/mehfil/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:opacity-80">
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ background: PROFILE_CARD }}>
          {m.coverUrl ? (
            <img src={m.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Radio size={16} style={{ color: PROFILE_MUTED }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-['Playfair_Display'] text-[15px] leading-snug truncate">{m.title}</div>
          <div className={`text-[10px] font-['Inter'] uppercase tracking-[0.16em] mt-0.5 ${m.isLive ? "text-emerald-400" : ""}`} style={m.isLive ? undefined : { color: PROFILE_MUTED }}>
            {statusLabel}
          </div>
        </div>
      </Link>
      {showHostMenu && (
        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenuOpen((o) => !o)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5" aria-label="Options">
            <MoreVertical size={15} style={{ color: PROFILE_MUTED }} />
          </button>
          <AnimatePresence>
            {menuOpen && <GatheringHostMenu m={m} onClose={() => setMenuOpen(false)} />}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function HighlightCard({ post }: { post: Post }) {
  return (
    <Link href={`/post/${post.id}`} className="shrink-0 w-[140px] block active:opacity-90">
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${PROFILE_BORDER}` }}>
        <div className="relative h-[100px]">
          {post.coverUrl ? (
            <img src={post.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: kindGradient(post.kind) }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 60%)" }} />
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-[12px] font-['Playfair_Display'] text-white line-clamp-2 leading-snug">{post.title}</div>
          </div>
        </div>
        <div className="px-2.5 py-2 flex items-center gap-2 text-[10px]" style={{ color: PROFILE_MUTED }}>
          <Heart size={10} /> {post.likes}
        </div>
      </div>
    </Link>
  );
}

function PhotoGridItem({ post }: { post: Post }) {
  return (
    <Link href={`/post/${post.id}`} className="block rounded-xl overflow-hidden aspect-square active:opacity-90" style={{ border: `1px solid ${PROFILE_BORDER}` }}>
      {post.coverUrl ? (
        <img src={post.coverUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2 text-center font-['Playfair_Display'] text-[12px]" style={{ background: kindGradient(post.kind) }}>
          {post.title}
        </div>
      )}
    </Link>
  );
}

export type ProfileViewProps = {
  user: User;
  /** Own profile at /me */
  isOwnProfile: boolean;
  /** Preview as visitor (own profile only) */
  viewAsVisitor?: boolean;
  onToggleViewAs?: () => void;
};

export function ProfileView({ user, isOwnProfile, viewAsVisitor = false, onToggleViewAs }: ProfileViewProps) {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<ProfileTabId>("mehfils");
  const [subSheet, setSubSheet] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [audioLetterOpen, setAudioLetterOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const me = getCurrentUserId();
  const showVisitorActions = !isOwnProfile || viewAsVisitor;
  const showOwnerTools = isOwnProfile && !viewAsVisitor;

  const follow = useFollow();
  const subscribe = useSubscribeToAuthor();
  const unsubscribe = useUnsubscribeFromAuthor();

  const { data: plan } = useAuthorPlan(user.id);
  const { data: subscribers = [] } = useSubscribersOf(user.id);
  const { data: posts = [] } = usePostsByAuthor(user.id);
  const { data: mehfils = [] } = useMehfilsForHost(user.id);
  const { data: following = false } = useIsFollowing(me ?? "", user.id);
  const { data: subscribed = false } = useIsSubscribedTo(me ?? "", user.id);
  const { data: walletBalance = 0 } = useWalletBalance(me);
  const { data: ink } = useInkReward(showOwnerTools ? user.id : undefined);
  const { data: saved = [] } = useSavedPosts(showOwnerTools ? user.id : undefined);

  useEffect(() => {
    if (!isOwnProfile && user.id && me && user.id !== me) {
      trackEvent("creator_profile_open", { creator_id: user.id });
    }
  }, [user.id, me, isOwnProfile]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${user.handle}` : "";
  const role = extractRole(user.bio);
  const voiceType = `${LANGUAGE_VOICE[user.language] ?? "Odia"} · ${role}`;
  const featuredMehfil = mehfils.find((m) => m.isLive) ?? mehfils[0];
  const restMehfils = mehfils.filter((m) => m !== featuredMehfil);
  const highlights = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 8);
  const photoPosts = posts.filter((p) => p.coverUrl || p.kind === "reel");
  const bioText = user.bio?.replace(/^Storyteller · |^Writer · |^Poet · |^Listener · /, "").trim() || user.bio;

  const handleMessage = async () => {
    if (!me) { setLocation("/auth/login"); return; }
    setMsgLoading(true);
    try {
      const convId = await getOrCreateConversationId(me, user.id);
      setLocation(`/messages?open=${convId}`);
    } finally { setMsgLoading(false); }
  };

  return (
    <ProfileShell>
      {/* Top bar */}
      <ProfileTopBar>
        <ProfileIconButton variant="ghost" label="Back" onClick={() => setLocation(isOwnProfile ? "/" : "/")}>
          <ArrowLeft size={16} strokeWidth={1.75} />
        </ProfileIconButton>
        <div className="flex items-center gap-2">
          {showOwnerTools && onToggleViewAs && (
            <ProfileIconButton variant="ghost" label={viewAsVisitor ? "Exit visitor view" : "Preview as visitor"} onClick={onToggleViewAs}>
              {viewAsVisitor ? <EyeOff size={15} /> : <Eye size={15} />}
            </ProfileIconButton>
          )}
          <ProfileIconButton variant="ghost" label="Share profile" onClick={() => setShareOpen(true)}>
            <Share2 size={16} strokeWidth={1.6} />
          </ProfileIconButton>
          <div className="relative" ref={moreRef}>
            <ProfileIconButton variant="ghost" label="More options" onClick={() => setMoreOpen((o) => !o)}>
              <MoreHorizontal size={16} strokeWidth={1.75} />
            </ProfileIconButton>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-10 z-40 min-w-[180px] rounded-xl overflow-hidden shadow-xl py-1"
                  style={{ background: "#141010", border: `1px solid ${PROFILE_BORDER}` }}
                >
                  {showOwnerTools && (
                    <>
                      <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-['Inter'] hover:bg-white/5" onClick={() => setMoreOpen(false)}>
                        <Settings size={14} style={{ color: PROFILE_GOLD }} /> Settings
                      </Link>
                      <Link href="/wallet" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-['Inter'] hover:bg-white/5" onClick={() => setMoreOpen(false)}>
                        <Wallet size={14} style={{ color: PROFILE_GOLD }} /> Wallet
                      </Link>
                      <Link href="/rewards" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-['Inter'] hover:bg-white/5" onClick={() => setMoreOpen(false)}>
                        <Zap size={14} style={{ color: PROFILE_GOLD }} /> Ink Rewards
                      </Link>
                    </>
                  )}
                  {!showOwnerTools && me && (
                    <button type="button" className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-['Inter'] hover:bg-white/5 text-left" onClick={() => { setSupportOpen(true); setMoreOpen(false); }}>
                      ☕ Appreciate
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ProfileTopBar>

      {viewAsVisitor && (
        <div className="mx-5 mb-2 px-4 py-2.5 rounded-2xl flex items-center gap-2" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.22)" }}>
          <Eye size={13} style={{ color: PROFILE_GOLD }} className="shrink-0" />
          <span className="text-[12px] font-['Inter']" style={{ color: PROFILE_GOLD }}>Viewing as a visitor</span>
        </div>
      )}

      {/* Identity — left avatar column + right text */}
      <div className="px-5 pt-1 pb-3">
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center shrink-0 w-[116px]">
            <ProfileAvatar avatarUrl={user.avatarUrl} displayName={user.displayName} verified={user.verified} size="lg" />
            <div className="mt-3">
              <ProfileRolePill label={role} />
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-['Playfair_Display'] font-bold text-[22px] leading-[1.15] tracking-[-0.01em]">
                {user.displayName}
              </h1>
              {user.verified && <ProfileVerifiedCheck size={17} />}
            </div>
            <div className="text-[13px] font-['Inter'] mt-1" style={{ color: PROFILE_MUTED }}>
              @{user.handle}
            </div>
            {bioText && (
              <p
                className="text-[13px] font-['Inter'] leading-[1.5] mt-2.5 line-clamp-3"
                style={{ color: "rgba(245,243,239,0.68)" }}
              >
                {bioText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <ProfileStatsRow>
        <ProfileStat value={mehfils.length} label="Mehfils" />
        <ProfileStatDivider />
        <ProfileStat value={user.followers} label="Followers" onClick={() => setLocation(`/u/${user.handle}/followers`)} />
        <ProfileStatDivider />
        <ProfileStat value={user.following} label="Following" onClick={() => setLocation(`/u/${user.handle}/following`)} />
      </ProfileStatsRow>

      {/* Actions */}
      <div className="px-5 flex gap-2 mb-2">
        {showVisitorActions ? (
          <>
            <GoldGradientButton
              onClick={() => {
                if (!me) { setLocation("/auth/login"); return; }
                follow.mutate({ userId: user.id, on: !following });
              }}
            >
              {following ? "Following" : "Follow"}
            </GoldGradientButton>
            <GoldGradientButton variant="outline" onClick={handleMessage} disabled={msgLoading}>
              {msgLoading ? "…" : "Message"}
            </GoldGradientButton>
            <GoldGradientButton
              variant="outline"
              className="!flex-none !w-[44px] !min-w-[44px] !px-0 flex items-center justify-center"
              onClick={() => toast.message("Notify — coming soon")}
            >
              <Bell size={16} />
            </GoldGradientButton>
            <GoldGradientButton
              variant="outline"
              className="!flex-none !w-[44px] !min-w-[44px] !px-0 flex items-center justify-center"
              onClick={() => setMoreOpen(true)}
            >
              <MoreHorizontal size={16} />
            </GoldGradientButton>
          </>
        ) : (
          <>
            <GoldGradientButton onClick={() => setLocation("/settings/account")}>
              Edit Profile
            </GoldGradientButton>
            <GoldGradientButton variant="outline" onClick={() => setLocation("/mehfil/host/new")} className="flex items-center justify-center gap-1.5">
              <Radio size={14} /> Host Mehfil
            </GoldGradientButton>
            <GoldGradientButton variant="outline" className="!flex-none !w-[44px] !min-w-[44px] !px-0 flex items-center justify-center" onClick={() => setShareOpen(true)}>
              <Share2 size={16} />
            </GoldGradientButton>
          </>
        )}
      </div>

      {/* Appreciation row for visitors */}
      {showVisitorActions && me && (
        <div className="px-5 flex gap-2 mb-3">
          <GoldGradientButton variant="outline" onClick={() => setSupportOpen(true)} className="flex items-center justify-center gap-1.5">
            ☕ Appreciate
          </GoldGradientButton>
          <GoldGradientButton variant="outline" onClick={() => setAudioLetterOpen(true)} className="flex items-center justify-center gap-1.5">
            <Mail size={13} /> Voice letter
          </GoldGradientButton>
        </div>
      )}

      {/* Subscription plan */}
      {showVisitorActions && plan?.enabled && (
        <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.25)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} style={{ color: PROFILE_GOLD }} />
            <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: PROFILE_GOLD }}>Subscriber plan</div>
          </div>
          <div className="space-y-1 mb-3">
            {plan.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <Check size={11} className="text-emerald-400 shrink-0" />{b}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="font-['Playfair_Display'] text-[20px]">
              ₹{plan.priceMonthly}<span className="text-[12px] font-['Inter'] ml-1" style={{ color: PROFILE_MUTED }}>/month</span>
            </div>
            {subscribed ? (
              <button onClick={() => unsubscribe.mutate(user.id)} className="px-4 py-2 rounded-xl text-[12px]" style={{ border: `1px solid ${PROFILE_BORDER}`, color: PROFILE_MUTED }}>
                Subscribed ✓
              </button>
            ) : (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setSubSheet(true)}
                className="px-4 py-2 rounded-xl text-[12px] text-[#0A0806]"
                style={{ background: "linear-gradient(90deg, #C9A84C, #E8B14A)" }}>
                Subscribe
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <ProfileTabs active={tab} onChange={setTab} />

      {/* Tab content */}
      <div className="px-5 mt-5 pb-6">
        {tab === "mehfils" && (
          <>
            {featuredMehfil ? (
              <>
                <ProfileSectionLabel>Recent Mehfils</ProfileSectionLabel>
                <FeaturedMehfilCard m={featuredMehfil} showHostMenu={showOwnerTools} />
              </>
            ) : null}
            {restMehfils.length > 0 && (
              <ProfileCard className={`mt-4 px-4 ${featuredMehfil ? "" : "mt-0"}`}>
                {!featuredMehfil && <ProfileSectionLabel>Mehfils</ProfileSectionLabel>}
                {restMehfils.map((m) => (
                  <MehfilListRow key={m.id} m={m} showHostMenu={showOwnerTools} />
                ))}
              </ProfileCard>
            )}
            {mehfils.length === 0 && (
              <EmptyTabState title="No mehfils yet." hint={showOwnerTools ? "Host your first live voice room when you're ready." : "This storyteller hasn't hosted a mehfil yet."} />
            )}
          </>
        )}

        {tab === "about" && (
          <>
            <ProfileSectionLabel>About Me</ProfileSectionLabel>
            <ProfileCard>
              <AboutRow icon={Mic} label="Voice Type" value={voiceType} />
              <AboutRow icon={MapPin} label="From" value={user.location ?? "Not set"} />
              <AboutRow icon={Calendar} label="Joined" value={formatJoined(user.createdAt)} />
            </ProfileCard>
            {showOwnerTools && (
              <>
                <ProfileSectionLabel>Creator</ProfileSectionLabel>
                <ProfileCard>
                  <Link href="/wallet" className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: PROFILE_BORDER }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.10)" }}>
                      <Wallet size={16} style={{ color: PROFILE_GOLD }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px]" style={{ color: PROFILE_MUTED }}>Wallet balance</div>
                      <div className="text-[14px] text-emerald-400">₹{walletBalance.toLocaleString()}</div>
                    </div>
                  </Link>
                  <Link href="/rewards" className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: PROFILE_BORDER }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.10)" }}>
                      <Zap size={16} style={{ color: PROFILE_GOLD }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px]" style={{ color: PROFILE_MUTED }}>Ink points</div>
                      <div className="text-[14px]">{ink?.points ?? 0}</div>
                    </div>
                  </Link>
                  <Link href="/creator-plan" className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: PROFILE_BORDER }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.10)" }}>
                      <Star size={16} style={{ color: PROFILE_GOLD }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px]" style={{ color: PROFILE_MUTED }}>Subscriber plan</div>
                      <div className="text-[14px]">{plan?.enabled ? `₹${plan.priceMonthly}/mo · ${subscribers.length} subs` : "Not enabled"}</div>
                    </div>
                  </Link>
                  <Link href="/settings/account" className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.10)" }}>
                      <BadgeCheck size={16} style={{ color: PROFILE_GOLD }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px]" style={{ color: PROFILE_MUTED }}>Profile</div>
                      <div className="text-[14px]">Edit account & photo</div>
                    </div>
                  </Link>
                </ProfileCard>
              </>
            )}
            {posts.length > 0 && (
              <div className="mt-5">
                <ProfileSectionLabel>Works ({posts.length})</ProfileSectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  {posts.slice(0, 4).map((p) => <PhotoGridItem key={p.id} post={p} />)}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "highlights" && (
          <>
            {highlights.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                {highlights.map((p) => <HighlightCard key={p.id} post={p} />)}
              </div>
            ) : (
              <EmptyTabState title="No highlights yet." hint="Top-loved works will appear here." />
            )}
          </>
        )}

        {tab === "photos" && (
          <>
            {(photoPosts.length > 0 || (showOwnerTools && saved.length > 0)) ? (
              <>
                {photoPosts.length > 0 && (
                  <>
                    <ProfileSectionLabel>Posts</ProfileSectionLabel>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {photoPosts.map((p) => <PhotoGridItem key={p.id} post={p} />)}
                    </div>
                  </>
                )}
                {showOwnerTools && saved.length > 0 && (
                  <>
                    <ProfileSectionLabel>Saved</ProfileSectionLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {saved.map((p) => <PhotoGridItem key={p.id} post={p} />)}
                    </div>
                  </>
                )}
              </>
            ) : (
              <EmptyTabState title="No photos yet." hint="Cover images and reels will show here." />
            )}
          </>
        )}

        {tab === "badges" && (
          <>
            {(ink?.badges?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ink!.badges.map((b) => (
                  <span key={b} className="text-[12px] px-3 py-2 rounded-full" style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.28)", color: PROFILE_GOLD }}>
                    {BADGE_LABELS[b] ?? b}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyTabState
                title="No badges yet."
                hint={showOwnerTools ? "Earn Ink badges by listening, tipping, and showing up." : "This storyteller hasn't earned badges yet."}
              />
            )}
          </>
        )}
      </div>

      {/* Subscribe sheet */}
      <AnimatePresence>
        {subSheet && plan && (
          <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSubSheet(false)}>
            <motion.div initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-3xl p-6 pb-10"
              style={{ background: "#0A0806", color: "#F5F3EF" }}>
              <div className="w-8 h-1 rounded-full mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }} />
              <div className="flex items-center gap-3 mb-4">
                <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-['Playfair_Display'] text-[18px]">Subscribe to {user.displayName}</div>
                  <div className="text-[12px]" style={{ color: PROFILE_MUTED }}>₹{plan.priceMonthly}/month · cancel anytime</div>
                </div>
              </div>
              <div className="rounded-xl p-3 mb-4 space-y-1.5" style={{ border: `1px solid ${PROFILE_BORDER}`, background: PROFILE_CARD }}>
                {plan.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]"><Check size={12} className="text-emerald-400" />{b}</div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px] mb-4 px-1" style={{ color: PROFILE_MUTED }}>
                <span>Your wallet: ₹{walletBalance.toLocaleString()}</span>
                <span>After: ₹{(walletBalance - plan.priceMonthly).toLocaleString()}</span>
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { subscribe.mutate(user.id); setSubSheet(false); }}
                disabled={subscribe.isPending}
                className="w-full py-3.5 rounded-xl text-[#0A0806] text-[14px] disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #C9A84C, #E8B14A)" }}>
                Subscribe · ₹{plan.priceMonthly}
              </motion.button>
              <button onClick={() => setSubSheet(false)} className="w-full mt-2 py-2.5 rounded-xl text-[13px]" style={{ border: `1px solid ${PROFILE_BORDER}`, color: PROFILE_MUTED }}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {supportOpen && (
          <SupportSheet toUserId={user.id} toUserName={user.displayName} onClose={() => setSupportOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {audioLetterOpen && (
          <AudioLetterRecorder toUserId={user.id} toUserName={user.displayName} onClose={() => setAudioLetterOpen(false)} />
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
    </ProfileShell>
  );
}
