import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Bell, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useMehfils,
  useMehfilsForHost,
  useMehfilRealtime,
  useCurrentUser,
  useUnreadNotificationCount,
  isMehfilDiscoveryExpired,
  type Mehfil,
} from "@/lib/store";
import {
  FEED_BG, FEED_BORDER, FEED_GOLD, FEED_MUTED, FEED_PURPLE, FEED_TEXT, MoKathaWordmark,
} from "@/components/feed/home-feed-ui";
import {
  MEHFIL_TABS,
  MEHFIL_CATEGORIES,
  type MehfilTab,
  type MehfilCategory,
  matchesMehfilCategory,
  isMehfilUpcoming,
  isMehfilEnded,
  HeroCarousel,
  UpcomingMehfilCard,
  TrendingMehfilCard,
  HostMehfilRow,
  HistoryMehfilRow,
  CreateMehfilBanner,
  SectionHeading,
} from "@/components/mehfil/mehfil-list-ui";

function applyCategory(list: Mehfil[], category: MehfilCategory): Mehfil[] {
  return list.filter((m) => matchesMehfilCategory(m, category));
}

function EmptyState({ tab }: { tab: MehfilTab }) {
  const messages: Record<MehfilTab, { title: string; body: string }> = {
    "For You": {
      title: "No gatherings right now",
      body: "When someone opens a Mehfil, a circle forms. Check back soon or host your own.",
    },
    Explore: {
      title: "Nothing to explore yet",
      body: "Public Mehfils will appear here as creators open rooms.",
    },
    "My Mehfils": {
      title: "You haven't hosted yet",
      body: "Start your first Mehfil and invite listeners into your circle.",
    },
    History: {
      title: "No past Mehfils",
      body: "Ended sessions appear here for replay and rediscovery.",
    },
  };
  const { title, body } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <Radio size={24} style={{ color: FEED_MUTED }} />
      </div>
      <div className="font-['Playfair_Display'] text-[18px] mb-2">{title}</div>
      <p className="text-[13px] font-['Inter'] leading-relaxed mb-6 max-w-[260px]" style={{ color: FEED_MUTED }}>
        {body}
      </p>
      {(tab === "For You" || tab === "My Mehfils") && (
        <Link
          href="/mehfil/host/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-['Inter'] font-medium active:scale-95 transition-transform"
          style={{ background: FEED_GOLD, color: FEED_BG }}
        >
          Start Mehfil
        </Link>
      )}
    </div>
  );
}

function ForYouContent({
  live,
  upcoming,
  trending,
  category,
}: {
  live: Mehfil[];
  upcoming: Mehfil[];
  trending: Mehfil[];
  category: MehfilCategory;
}) {
  const filteredLive = applyCategory(live, category);
  const filteredUpcoming = applyCategory(upcoming, category);
  const filteredTrending = applyCategory(trending, category);
  const hasContent = filteredLive.length > 0 || filteredUpcoming.length > 0 || filteredTrending.length > 0;

  if (!hasContent) return <EmptyState tab="For You" />;

  return (
    <>
      {filteredLive.length > 0 && <HeroCarousel liveMehfils={filteredLive} />}

      {filteredUpcoming.length > 0 && (
        <section className="mb-6">
          <SectionHeading>Upcoming Mehfils</SectionHeading>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {filteredUpcoming.map((m) => (
              <UpcomingMehfilCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {filteredTrending.length > 0 && (
        <section className="mb-6">
          <SectionHeading>Trending Now</SectionHeading>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {filteredTrending.map((m) => (
              <TrendingMehfilCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      <CreateMehfilBanner />
    </>
  );
}

function ExploreContent({ mehfils, category }: { mehfils: Mehfil[]; category: MehfilCategory }) {
  const filtered = applyCategory(
    mehfils.filter((m) => !m.archived),
    category,
  );

  if (filtered.length === 0) return <EmptyState tab="Explore" />;

  const live = filtered.filter((m) => m.isLive);
  const rest = filtered.filter((m) => !m.isLive);

  return (
    <div className="space-y-5">
      {live.length > 0 && (
        <section>
          <SectionHeading>Live now</SectionHeading>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {live.map((m) => (
              <TrendingMehfilCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <SectionHeading>All public Mehfils</SectionHeading>
          <div className="space-y-2">
            {rest.map((m) => (
              <HostMehfilRow key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}
      <CreateMehfilBanner />
    </div>
  );
}

function MyMehfilsContent({ mehfils, category }: { mehfils: Mehfil[]; category: MehfilCategory }) {
  const filtered = applyCategory(mehfils, category);
  if (filtered.length === 0) return <EmptyState tab="My Mehfils" />;

  return (
    <div className="space-y-2">
      {filtered.map((m) => (
        <HostMehfilRow key={m.id} m={m} />
      ))}
      <div className="pt-4">
        <CreateMehfilBanner />
      </div>
    </div>
  );
}

function HistoryContent({ mehfils, category }: { mehfils: Mehfil[]; category: MehfilCategory }) {
  const filtered = applyCategory(mehfils, category);
  if (filtered.length === 0) return <EmptyState tab="History" />;

  return (
    <div className="space-y-2">
      {filtered.map((m) => (
        <HistoryMehfilRow key={m.id} m={m} />
      ))}
    </div>
  );
}

export default function MehfilList() {
  useTitle("Mehfil");
  useMehfilRealtime();

  const { data: mehfils = [] } = useMehfils();
  const { data: user } = useCurrentUser();
  const { data: hostMehfils = [] } = useMehfilsForHost(user?.id ?? "");
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  const [tab, setTab] = useState<MehfilTab>("For You");
  const [category, setCategory] = useState<MehfilCategory>("All Mehfils");

  const { live, upcoming, trending, history } = useMemo(() => {
    const publicList = mehfils.filter((m) => !m.archived);
    const liveList = publicList.filter((m) => m.isLive);
    const upcomingList = publicList.filter(isMehfilUpcoming);
    const trendingList = [...liveList].sort((a, b) => b.listeners - a.listeners);

    const historyMap = new Map<string, Mehfil>();
    for (const m of publicList) {
      if (!m.isLive && (m.endedAt || isMehfilEnded(m))) historyMap.set(m.id, m);
    }
    for (const m of hostMehfils) {
      if (!m.isLive && (m.endedAt || isMehfilEnded(m) || isMehfilDiscoveryExpired(m))) {
        historyMap.set(m.id, m);
      }
    }
    const historyList = [...historyMap.values()].sort(
      (a, b) => new Date(b.endedAt ?? b.startsAt).getTime() - new Date(a.endedAt ?? a.startsAt).getTime(),
    );

    return {
      live: liveList,
      upcoming: upcomingList,
      trending: trendingList.length > 0 ? trendingList : liveList,
      history: historyList,
    };
  }, [mehfils, hostMehfils]);

  const showCategoryChips = tab === "For You" || tab === "Explore";

  return (
    <div className="min-h-[100dvh] w-full flex flex-col relative" style={{ background: FEED_BG, color: FEED_TEXT }}>
      {/* Ambient glow */}
      <div
        className="fixed top-[-40px] right-[-60px] w-[220px] h-[220px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(155,89,182,0.18) 0%, transparent 70%)", filter: "blur(48px)" }}
      />
      <div
        className="fixed top-[200px] left-[-80px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)", filter: "blur(52px)" }}
      />

      {/* Header — matches home pattern */}
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
              style={{ background: `linear-gradient(135deg, ${FEED_GOLD}, #E8B14A, ${FEED_PURPLE})` }}
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

      {/* Tabs */}
      <div className="relative border-b" style={{ borderColor: FEED_BORDER }}>
        <div className="flex px-2 overflow-x-auto no-scrollbar">
          {MEHFIL_TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative shrink-0 px-3.5 py-3 text-[12px] font-['Inter'] transition-colors whitespace-nowrap ${
                tab === id ? "font-medium" : ""
              }`}
              style={{ color: tab === id ? FEED_TEXT : FEED_MUTED }}
            >
              {id}
              {tab === id && (
                <motion.div
                  layoutId="mehfil-tab-line"
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ background: FEED_GOLD }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      {showCategoryChips && (
        <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {MEHFIL_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-['Inter'] font-medium tracking-[0.02em] transition-colors"
                style={
                  active
                    ? { background: FEED_PURPLE, color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: FEED_MUTED, border: `1px solid ${FEED_BORDER}` }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 px-4 pt-3 pb-28 relative z-10">
        {tab === "For You" && (
          <ForYouContent live={live} upcoming={upcoming} trending={trending} category={category} />
        )}
        {tab === "Explore" && <ExploreContent mehfils={mehfils} category={category} />}
        {tab === "My Mehfils" && <MyMehfilsContent mehfils={hostMehfils} category={category} />}
        {tab === "History" && <HistoryContent mehfils={history} category={category} />}
      </div>
    </div>
  );
}
