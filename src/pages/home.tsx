import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Bell, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useFeed, useCurrentUser, useMehfils, useTip, useUser,
  Post, usePostsRealtime, useMehfilRealtime, useUnreadNotificationCount, useAccountSyncRealtime,
  useStories, useStoriesRealtime, useAdminConfig,
} from "@/lib/store";
import { applyFeedContentPrefs, useFeedPreferences } from "@/lib/feedPreferences";
import { SHEET_SPRING } from "@/lib/motionTokens";
import { StoriesRow } from "@/components/feed/StoriesRow";
import { FeedTileView } from "@/components/feed/FeedCards";
import { MasonryFeed } from "@/components/feed/MasonryFeed";
import { StoryViewer, useStoryViewerState } from "@/components/feed/StoryViewer";
import {
  FEED_BG, FEED_BORDER, FEED_FILTERS, FEED_GOLD, FEED_MUTED, FEED_TEXT,
  MoKathaWordmark, buildFeedTiles, feedEditorialFromAdmin, feedKeyframes, type FeedFilter,
} from "@/components/feed/home-feed-ui";

// ─── Tip sheet ────────────────────────────────────────────────────────────────

function TipSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const tip = useTip("post");
  const { data: post } = useFeed();
  const p = (post ?? []).find((x: Post) => x.id === postId);
  const { data: author } = useUser(p?.authorId ?? "");
  const sendTip = (amt: number) => { tip.mutate({ id: postId, amount: amt }); onClose(); };
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={SHEET_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-3xl px-6 pt-4 pb-10"
        style={{ background: FEED_BG, color: FEED_TEXT, borderTop: `1px solid ${FEED_BORDER}` }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: FEED_BORDER }} />
        <div className="font-['Playfair_Display'] text-[22px] mb-1">Send a tip</div>
        <div className="text-[12px] mb-6" style={{ color: FEED_MUTED }}>A quiet thank-you to {author?.displayName}.</div>
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {[20, 50, 100, 250].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => sendTip(v)}
              className="py-3.5 rounded-xl border text-[14px] font-['Playfair_Display'] active:scale-95 transition-transform"
              style={{ borderColor: FEED_BORDER, color: FEED_GOLD }}
            >
              ₹{v}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="w-full py-3 rounded-xl text-[13px]" style={{ color: FEED_MUTED }}>
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  useTitle("Home");
  const { prefs } = useFeedPreferences();
  const [filter, setFilter] = useState<FeedFilter>(prefs.defaultFilter);
  const [tipPostId, setTipPostId] = useState<string | null>(null);
  const { data: posts = [], isLoading: feedLoading } = useFeed();
  const { data: user } = useCurrentUser();
  const { data: mehfils = [] } = useMehfils();
  const { data: storyRings = [] } = useStories();
  const { data: adminConfig } = useAdminConfig();
  const liveMehfil = mehfils.find((m) => m.isLive) ?? mehfils[0];
  const featuredMehfil = mehfils.find((m) => m.isLive) ?? mehfils.sort((a, b) => b.listeners - a.listeners)[0];

  usePostsRealtime();
  useAccountSyncRealtime();
  useMehfilRealtime();
  useStoriesRealtime();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { viewUserId, open: openStory, close: closeStory, activeRings } = useStoryViewerState(storyRings);

  useEffect(() => {
    setFilter(prefs.defaultFilter);
  }, [prefs.defaultFilter]);

  const editorial = feedEditorialFromAdmin(adminConfig);
  const filteredPosts = useMemo(() => {
    const base = filter === "All" ? applyFeedContentPrefs(posts, prefs) : posts;
    if (filter === "All" && !prefs.showMehfil) {
      return base;
    }
    return base;
  }, [posts, prefs, filter]);

  const tiles = buildFeedTiles(
    filteredPosts,
    mehfils,
    filter,
    prefs.showMehfil ? liveMehfil : undefined,
    editorial,
  );

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <style>{feedKeyframes}</style>

      {/* Header */}
      <header
        className="px-4 py-3 flex justify-between items-center sticky top-0 z-20"
        style={{ background: "rgba(10,8,6,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${FEED_BORDER}` }}
      >
        <Link href="/" className="active:opacity-80 transition-opacity">
          <MoKathaWordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link
            href="/search"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: FEED_MUTED }}
            aria-label="Search"
          >
            <Search strokeWidth={1.75} size={18} />
          </Link>
          <Link
            href="/notifications"
            className="w-9 h-9 rounded-full flex items-center justify-center relative transition-colors"
            aria-label="Notifications"
          >
            <Bell strokeWidth={1.75} size={18} style={{ color: unreadCount > 0 ? FEED_GOLD : FEED_MUTED }} />
            {unreadCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full text-[8px] font-bold font-['Inter'] flex items-center justify-center leading-none"
                style={{ background: FEED_GOLD, color: FEED_BG }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/me" className="ml-1" aria-label="Profile">
            <div
              className="p-[2px] rounded-full"
              style={{ background: `linear-gradient(135deg, ${FEED_GOLD}, #E8B14A, #9B59B6)` }}
            >
              <img
                src={user?.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=faces"}
                alt=""
                className="w-8 h-8 rounded-full object-cover border-2"
                style={{ borderColor: FEED_BG }}
              />
            </div>
          </Link>
        </div>
      </header>

      <StoriesRow
        storyRings={storyRings}
        featuredMehfil={featuredMehfil}
        onOpenStory={openStory}
        showLiveInStories={prefs.showLiveInStories}
      />

      {/* Filter pills */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {FEED_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="shrink-0 px-4 py-2 rounded-full text-[11px] font-['Inter'] font-medium tracking-[0.04em] transition-colors"
              style={
                active
                  ? { background: `linear-gradient(90deg, ${FEED_GOLD}, #E8B14A)`, color: FEED_BG }
                  : { background: "rgba(255,255,255,0.05)", color: FEED_MUTED, border: `1px solid ${FEED_BORDER}` }
              }
            >
              {f}
            </button>
          );
        })}
        <Link
          href="/settings/feed-preferences"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border"
          style={{ borderColor: FEED_BORDER, color: FEED_MUTED }}
          aria-label="Feed preferences"
          title="Feed preferences"
        >
          <SlidersHorizontal size={15} />
        </Link>
      </div>

      {/* Masonry feed */}
      <div className="flex-1 px-4 pb-6">
        {feedLoading && (
          <div className="columns-2 gap-3 animate-pulse">
            <div className="break-inside-avoid mb-3 h-[220px] rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", columnSpan: "all" }} />
            <div className="break-inside-avoid mb-3 h-[180px] rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
            <div className="break-inside-avoid mb-3 h-[180px] rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
        )}

        {!feedLoading && tiles.length > 0 && (
          <MasonryFeed
            tiles={tiles}
            gapPx={editorial.gapPx}
            renderTile={(tile) => <FeedTileView tile={tile} onTip={setTipPostId} />}
          />
        )}

        {!feedLoading && tiles.length === 0 && (
          <div className="text-center py-16">
            <div className="font-['Playfair_Display'] text-[16px] italic" style={{ color: FEED_MUTED }}>
              A quiet moment. Nothing here yet.
            </div>
            <Link href="/discover" className="inline-block mt-3 text-[12px] font-['Inter']" style={{ color: FEED_GOLD }}>
              Discover voices →
            </Link>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tipPostId && <TipSheet postId={tipPostId} onClose={() => setTipPostId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewUserId && activeRings.length > 0 && (
          <StoryViewer rings={activeRings} startUserId={viewUserId} onClose={closeStory} />
        )}
      </AnimatePresence>
    </div>
  );
}
