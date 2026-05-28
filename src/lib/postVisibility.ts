import type { Post } from "@/lib/store";

export type PostVisibility = "public" | "followers" | "private";

export function resolvePostVisibility(post: Pick<Post, "visibility" | "isPrivate">): PostVisibility {
  if (post.visibility) return post.visibility;
  return post.isPrivate ? "private" : "public";
}

/** Whether a post should appear in feeds/lists for the viewer. */
export function isPostVisibleToViewer(
  post: Pick<Post, "authorId" | "visibility" | "isPrivate" | "scheduledAt">,
  viewerId: string | null,
  followingAuthorIds: ReadonlySet<string>,
  nowMs = Date.now(),
): boolean {
  const vis = resolvePostVisibility(post);
  const isAuthor = !!viewerId && post.authorId === viewerId;

  if (post.scheduledAt) {
    const at = new Date(post.scheduledAt).getTime();
    if (Number.isFinite(at) && at > nowMs && !isAuthor) return false;
  }

  if (vis === "private") return isAuthor;
  if (vis === "followers") return isAuthor || (!!viewerId && followingAuthorIds.has(post.authorId));
  return true;
}

export function filterVisiblePosts(
  posts: Post[],
  viewerId: string | null,
  followingAuthorIds: ReadonlySet<string>,
  nowMs = Date.now(),
): Post[] {
  return posts.filter((p) => isPostVisibleToViewer(p, viewerId, followingAuthorIds, nowMs));
}
