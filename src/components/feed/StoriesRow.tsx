import { Link, useLocation } from "wouter";
import { Plus, Sparkles } from "lucide-react";
import type { Mehfil } from "@/lib/store";
import { useCurrentUser, useUser } from "@/lib/store";
import type { StoryRing as StoryRingData } from "@/lib/store";
import { FEED_BORDER, FEED_GOLD, FEED_MUTED, FEED_TEXT, formatFeedStat } from "./home-feed-ui";

type StoryRingProps = { live?: boolean; children: React.ReactNode };

function StoryRing({ live, children }: StoryRingProps) {
  if (live) {
    return (
      <div className="relative p-[2.5px] rounded-full" style={{ background: "conic-gradient(from 0deg, #C9A84C, #E8B14A, #9B59B6, #C9A84C)", animation: "feed-spin 4s linear infinite" }}>
        <div className="rounded-full p-[2px]" style={{ background: "#0A0806" }}>{children}</div>
      </div>
    );
  }
  return (
    <div className="relative p-[2px] rounded-full" style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.5), rgba(155,89,182,0.45))" }}>
      {children}
    </div>
  );
}

function StoryAvatarButton({
  ring,
  onOpen,
}: {
  ring: StoryRingData;
  onOpen: (userId: string) => void;
}) {
  const { data: user } = useUser(ring.userId);
  const label = user?.displayName?.split(" ")[0] ?? "Story";

  return (
    <button
      type="button"
      onClick={() => onOpen(ring.userId)}
      className="flex flex-col items-center gap-1 shrink-0 w-[58px]"
    >
      <div className="relative">
        <StoryRing live={ring.isLive}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
          ) : (
            <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[18px]" style={{ background: "rgba(255,255,255,0.06)" }}>
              ✦
            </div>
          )}
        </StoryRing>
        {ring.isLive && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-bold uppercase text-white bg-red-600 rounded px-1 py-px leading-none whitespace-nowrap">
            LIVE
          </span>
        )}
      </div>
      <span className={`text-[9px] font-['Inter'] text-center line-clamp-1 w-full ${ring.isLive ? "mt-2" : ""}`} style={{ color: FEED_TEXT }}>
        {label}
      </span>
    </button>
  );
}

export function StoriesRow({
  storyRings,
  featuredMehfil,
  onOpenStory,
  showLiveInStories = true,
}: {
  storyRings: StoryRingData[];
  featuredMehfil?: Mehfil;
  onOpenStory: (userId: string) => void;
  showLiveInStories?: boolean;
}) {
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();
  const me = user?.id;
  const ownRing = storyRings.find((r) => r.userId === me);
  const otherRings = storyRings.filter((r) => r.userId !== me).slice(0, 10);
  const displayRings = showLiveInStories ? otherRings : otherRings.filter((r) => !r.isLive);

  return (
    <div className="px-4 pb-2 flex gap-3 overflow-x-auto no-scrollbar items-stretch">
      <div className="flex flex-col items-center gap-1 shrink-0 w-[58px]">
        <button
          type="button"
          onClick={() => (ownRing && me ? onOpenStory(me) : navigate("/stories/create"))}
          className="relative"
          aria-label={ownRing ? "View your story" : "Add story"}
        >
          {ownRing ? (
            <StoryRing live={ownRing.isLive}>
              <img src={user?.avatarUrl} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
            </StoryRing>
          ) : (
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center border-2 border-dashed"
              style={{ borderColor: FEED_BORDER, color: FEED_GOLD }}
            >
              <Plus size={22} strokeWidth={1.75} />
            </div>
          )}
        </button>
        <Link href="/stories/create" className="text-[9px] font-['Inter'] text-center leading-tight" style={{ color: FEED_MUTED }}>
          Your Story
        </Link>
        {ownRing && (
          <Link href="/stories/create" className="text-[8px] font-['Inter']" style={{ color: FEED_GOLD }}>
            + Add
          </Link>
        )}
      </div>

      {displayRings.map((ring) => (
        <StoryAvatarButton key={ring.userId} ring={ring} onOpen={onOpenStory} />
      ))}

      {featuredMehfil && (
        <Link
          href={`/mehfil/${featuredMehfil.id}`}
          className="shrink-0 w-[140px] rounded-2xl p-3 flex flex-col justify-between border"
          style={{ background: "rgba(201,168,76,0.08)", borderColor: "rgba(201,168,76,0.22)" }}
        >
          <div className="text-[10px] font-['Inter'] font-semibold line-clamp-2 leading-tight" style={{ color: FEED_TEXT }}>
            {featuredMehfil.title}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex -space-x-1.5">
              <img src={featuredMehfil.coverUrl} alt="" className="w-5 h-5 rounded-full object-cover border" style={{ borderColor: "#0A0806" }} />
            </div>
            <span className="text-[9px] font-['Inter']" style={{ color: FEED_GOLD }}>
              {formatFeedStat(featuredMehfil.listeners)} ♪
            </span>
          </div>
        </Link>
      )}

      <Link
        href="/discover"
        className="shrink-0 flex flex-col items-center justify-center gap-1 w-[72px] rounded-2xl border border-dashed px-2 transition-opacity hover:opacity-90"
        style={{ borderColor: FEED_BORDER, color: FEED_GOLD }}
      >
        <Sparkles size={18} />
        <span className="text-[8px] font-['Inter'] tracking-[0.06em] uppercase text-center leading-tight">Discover More</span>
      </Link>
    </div>
  );
}
