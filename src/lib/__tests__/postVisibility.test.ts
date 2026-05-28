import { describe, expect, it } from "vitest";
import { filterVisiblePosts, isPostVisibleToViewer } from "@/lib/postVisibility";
import type { Post } from "@/lib/store";

const base = (overrides: Partial<Post> & { id: string }): Post => ({
  kind: "text",
  authorId: "author",
  title: "T",
  body: "",
  language: "or",
  createdAt: new Date().toISOString(),
  likes: 0,
  comments: 0,
  tipsTotal: 0,
  tags: [],
  ...overrides,
});

describe("isPostVisibleToViewer", () => {
  const now = Date.parse("2026-05-28T12:00:00Z");

  it("hides scheduled posts from others until time", () => {
    const post = base({ id: "1", scheduledAt: "2026-05-28T14:00:00Z" });
    expect(isPostVisibleToViewer(post, "viewer", new Set(), now)).toBe(false);
    expect(isPostVisibleToViewer(post, "author", new Set(), now)).toBe(true);
  });

  it("shows followers-only to followers", () => {
    const post = base({ id: "2", visibility: "followers", authorId: "author" });
    expect(isPostVisibleToViewer(post, "fan", new Set(["author"]), now)).toBe(true);
    expect(isPostVisibleToViewer(post, "stranger", new Set(), now)).toBe(false);
  });

  it("private only for author", () => {
    const post = base({ id: "3", visibility: "private", authorId: "author" });
    expect(isPostVisibleToViewer(post, "author", new Set(), now)).toBe(true);
    expect(isPostVisibleToViewer(post, "other", new Set(), now)).toBe(false);
  });
});

describe("filterVisiblePosts", () => {
  it("filters mixed visibility set", () => {
    const posts = [
      base({ id: "a", visibility: "public" }),
      base({ id: "b", visibility: "private", authorId: "me" }),
      base({ id: "c", visibility: "followers", authorId: "creator" }),
    ];
    const out = filterVisiblePosts(posts, "me", new Set(["creator"]));
    expect(out.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });
});
