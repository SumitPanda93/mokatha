import { Link } from "wouter";
import { Sparkles, TrendingUp, Radio, Users } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useTrendingPosts, useTopCreators, useMehfils, useUser,
} from "@/lib/store";
import {
  FEED_BG, FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_TEXT, formatFeedStat,
} from "@/components/feed/home-feed-ui";

function CreatorChip({ userId }: { userId: string }) {
  const { data: user } = useUser(userId);
  if (!user) return null;
  return (
    <Link href={`/u/${user.handle}`} className="shrink-0 flex flex-col items-center gap-1.5 w-[72px]">
      <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: FEED_BORDER }} />
      <span className="text-[9px] font-['Inter'] text-center line-clamp-2 w-full" style={{ color: FEED_TEXT }}>{user.displayName}</span>
    </Link>
  );
}

export default function DiscoverPage() {
  useTitle("Discover");
  const { data: trending = [] } = useTrendingPosts();
  const { data: creators = [] } = useTopCreators(12);
  const { data: mehfils = [] } = useMehfils();
  const live = mehfils.filter((m) => m.isLive);
  const replays = mehfils.filter((m) => !m.isLive).slice(0, 6);

  return (
    <div className="min-h-screen w-full flex flex-col pb-8" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <header className="px-4 py-4 flex items-center gap-3 border-b" style={{ borderColor: FEED_BORDER }}>
        <Link href="/" className="text-[12px] font-['Inter']" style={{ color: FEED_MUTED }}>← Home</Link>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: FEED_GOLD }} />
          <div className="font-['Playfair_Display'] text-[20px]">Discover More</div>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-8">
        {live.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Radio size={14} className="text-red-500" />
              <h2 className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>Live now</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {live.map((m) => (
                <Link
                  key={m.id}
                  href={`/mehfil/${m.id}`}
                  className="shrink-0 w-[200px] rounded-2xl overflow-hidden border"
                  style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
                >
                  <div className="relative h-[100px]">
                    <img src={m.coverUrl} alt="" className="w-full h-full object-cover opacity-80" />
                    <span className="absolute top-2 left-2 text-[8px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">Live</span>
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] font-['Playfair_Display'] line-clamp-2">{m.title}</div>
                    <div className="text-[10px] font-['Inter'] mt-1" style={{ color: FEED_MUTED }}>{formatFeedStat(m.listeners)} listening</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} style={{ color: FEED_GOLD }} />
            <h2 className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>Creators to follow</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {creators.map((c) => (
              <CreatorChip key={c.id} userId={c.id} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: FEED_GOLD }} />
              <h2 className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>Trending stories</h2>
            </div>
            <Link href="/trending" className="text-[11px] font-['Inter']" style={{ color: FEED_GOLD }}>See all</Link>
          </div>
          <div className="space-y-2">
            {trending.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={p.kind === "reel" ? `/reels?focus=${p.id}` : `/post/${p.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border transition-opacity hover:opacity-90"
                style={{ background: FEED_CARD, borderColor: FEED_BORDER }}
              >
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center text-[18px]" style={{ background: "rgba(255,255,255,0.06)" }}>✦</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-['Playfair_Display'] line-clamp-1">{p.title}</div>
                  <div className="text-[10px] font-['Inter'] capitalize mt-0.5" style={{ color: FEED_MUTED }}>{p.kind} · {p.likes} likes</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {replays.length > 0 && (
          <section>
            <h2 className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-3" style={{ color: FEED_MUTED }}>Recent Mehfils</h2>
            <div className="grid grid-cols-2 gap-2">
              {replays.map((m) => (
                <Link key={m.id} href={`/mehfil/${m.id}`} className="rounded-xl border p-3" style={{ background: FEED_CARD, borderColor: FEED_BORDER }}>
                  <div className="text-[12px] font-['Playfair_Display'] line-clamp-2">{m.title}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
