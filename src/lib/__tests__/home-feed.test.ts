import { describe, expect, it } from "vitest";
import {
  buildFeedTiles,
  filterPosts,
  feedEditorialFromAdmin,
  FEED_EDITORIAL_DEFAULTS,
} from "@/components/feed/home-feed-ui";
import type { Mehfil, Post } from "@/lib/store";

const samplePost = (overrides: Partial<Post> & { id: string; kind: Post["kind"] }): Post => ({
  authorId: "u1",
  title: overrides.title ?? "Title",
  body: "",
  language: "or",
  createdAt: new Date().toISOString(),
  likes: 0,
  comments: 0,
  tipsTotal: 0,
  tags: [],
  ...overrides,
});

const liveMehfil: Mehfil = {
  id: "m1",
  hostId: "h1",
  title: "Live room",
  description: "",
  isLive: true,
  listeners: 12,
  startsAt: new Date().toISOString(),
  coverUrl: "",
  language: "or",
  tags: [],
};

describe("filterPosts", () => {
  const posts = [
    samplePost({ id: "1", kind: "voice" }),
    samplePost({ id: "2", kind: "text" }),
    samplePost({ id: "3", kind: "reel" }),
    samplePost({ id: "4", kind: "voice", sourceMehfilId: "m1" }),
  ];

  it("filters reels tab", () => {
    expect(filterPosts(posts, "Reels")).toHaveLength(1);
    expect(filterPosts(posts, "Reels")[0].kind).toBe("reel");
  });

  it("filters mehfil replays", () => {
    expect(filterPosts(posts, "Mehfil")).toHaveLength(1);
  });
});

describe("buildFeedTiles", () => {
  it("inserts live mehfil after editorial offset", () => {
    const posts = [
      samplePost({ id: "a", kind: "voice" }),
      samplePost({ id: "b", kind: "reel" }),
      samplePost({ id: "c", kind: "text" }),
    ];
    const tiles = buildFeedTiles(posts, [liveMehfil], "All", liveMehfil, {
      ...FEED_EDITORIAL_DEFAULTS,
      mehfilInsertAt: 2,
    });
    expect(tiles.some((t) => t.kind === "mehfil")).toBe(true);
    const mehfilIdx = tiles.findIndex((t) => t.kind === "mehfil");
    expect(mehfilIdx).toBeGreaterThanOrEqual(2);
  });

  it("maps admin editorial config", () => {
    const cfg = feedEditorialFromAdmin({ feed_hero_interval: 6, feed_masonry_gap_px: 10, feed_mehfil_insert_at: 1 });
    expect(cfg.heroInterval).toBe(6);
    expect(cfg.gapPx).toBe(10);
    expect(cfg.mehfilInsertAt).toBe(1);
  });
});
