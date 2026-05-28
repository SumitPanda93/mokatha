import { SETTINGS_BG, SETTINGS_BORDER, SETTINGS_GOLD, SETTINGS_MUTED, SETTINGS_TEXT } from "@/pages/settings/settings-ui";
import type { Mehfil, Post } from "@/lib/store";

export const FEED_BG = SETTINGS_BG;
export const FEED_GOLD = SETTINGS_GOLD;
export const FEED_TEXT = SETTINGS_TEXT;
export const FEED_MUTED = SETTINGS_MUTED;
export const FEED_BORDER = SETTINGS_BORDER;
export const FEED_CARD = "rgba(255,255,255,0.05)";
export const FEED_PURPLE = "#9B59B6";
export const FEED_PURPLE_SOFT = "rgba(155,89,182,0.35)";

export const FEED_FILTERS = ["All", "Voice", "Text", "Mehfil"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export function formatFeedStat(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

export function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function isNewPost(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 86_400_000;
}

export function isMehfilPost(p: Post): boolean {
  return !!p.sourceMehfilId || (p.tags?.includes("mehfil-replay") ?? false);
}

export function filterPosts(posts: Post[], filter: FeedFilter): Post[] {
  if (filter === "All") return posts;
  if (filter === "Voice") return posts.filter((p) => p.kind === "voice");
  if (filter === "Text") return posts.filter((p) => p.kind === "text" || p.kind === "story");
  return posts.filter(isMehfilPost);
}

export type FeedTile =
  | { kind: "post"; post: Post; size: "hero" | "tall" | "compact" }
  | { kind: "mehfil"; mehfil: Mehfil; size: "tall" };

export function buildFeedTiles(
  posts: Post[],
  _mehfils: Mehfil[],
  filter: FeedFilter,
  liveMehfil?: Mehfil,
): FeedTile[] {
  const filtered = filterPosts(posts, filter);
  const tiles: FeedTile[] = [];
  const showLive = (filter === "All" || filter === "Mehfil") && liveMehfil;

  if (filter === "Mehfil") {
    if (liveMehfil) tiles.push({ kind: "mehfil", mehfil: liveMehfil, size: "tall" });
    for (const p of filtered.slice(0, 10)) {
      tiles.push({ kind: "post", post: p, size: tiles.length % 3 === 1 ? "hero" : "compact" });
    }
    return tiles;
  }

  let voiceIdx = 0;
  let textIdx = 0;
  let reelIdx = 0;
  let insertedLive = false;

  for (const post of filtered) {
    if (!insertedLive && showLive && tiles.length >= 1) {
      tiles.push({ kind: "mehfil", mehfil: liveMehfil!, size: "tall" });
      insertedLive = true;
    }

    if (post.kind === "voice") {
      tiles.push({ kind: "post", post, size: voiceIdx === 0 ? "hero" : "compact" });
      voiceIdx++;
    } else if (post.kind === "text" || post.kind === "story") {
      tiles.push({ kind: "post", post, size: textIdx === 0 ? "tall" : "compact" });
      textIdx++;
    } else {
      tiles.push({ kind: "post", post, size: reelIdx === 0 ? "tall" : "compact" });
      reelIdx++;
    }
  }

  if (showLive && !insertedLive) {
    tiles.unshift({ kind: "mehfil", mehfil: liveMehfil!, size: "tall" });
  }

  return tiles;
}

export function MoKathaWordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <MoKathaSoundwaveIcon size={compact ? 32 : 36} />
      <div className="font-['Playfair_Display'] leading-none" style={{ color: FEED_TEXT }}>
        <span className={compact ? "text-[17px]" : "text-[19px]"}>Mo </span>
        <span
          className={`italic ${compact ? "text-[17px]" : "text-[19px]"}`}
          style={{
            background: `linear-gradient(90deg, ${FEED_GOLD}, #E8B14A, ${FEED_PURPLE})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Katha
        </span>
      </div>
    </div>
  );
}

export function MoKathaSoundwaveIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="mk-wave-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C9A84C" />
          <stop offset="50%" stopColor="#E8B14A" />
          <stop offset="100%" stopColor="#B14A8B" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.22)" />
      {[6, 11, 16, 21, 26, 31].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={12 - (i % 3) * 2}
          width="2.5"
          rx="1.25"
          height={[14, 20, 10, 18, 12, 16][i]}
          fill="url(#mk-wave-gold)"
          opacity={0.85 + (i % 2) * 0.1}
        />
      ))}
    </svg>
  );
}

export const feedKeyframes = `
  @keyframes feed-bar { 0%,100% { height: 20%; } 50% { height: 100%; } }
  @keyframes feed-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes feed-pulse-ring { 0% { transform: scale(0.95); opacity: 0.6; } 70% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1.6); opacity: 0; } }
`;
