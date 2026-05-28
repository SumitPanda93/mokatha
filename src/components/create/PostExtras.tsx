import { useMemo, type CSSProperties } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { useVotePoll, useUser, getCurrentUserId, type Post, type PostPoll } from "@/lib/store";
import { themeBackgroundStyle } from "@/lib/postThemes";
import { toast } from "sonner";

function TaggedPeople({ userIds }: { userIds: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {userIds.map((id) => (
        <TaggedChip key={id} userId={id} />
      ))}
    </div>
  );
}

function TaggedChip({ userId }: { userId: string }) {
  const { data: u } = useUser(userId);
  if (!u) return null;
  return (
    <Link href={`/u/${u.handle}`} className="text-[11px] px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground hover:text-terracotta">
      @{u.handle}
    </Link>
  );
}

export function PostPollWidget({ postId, poll }: { postId: string; poll: PostPoll }) {
  const vote = useVotePoll(postId);
  const me = getCurrentUserId();
  const totalVotes = useMemo(() => poll.options.reduce((s, o) => s + o.votes, 0), [poll.options]);

  const cast = (optionId: string) => {
    if (!me) { toast.error("Sign in to vote"); return; }
    vote.mutate(optionId, { onError: (e) => toast.error(e.message) });
  };

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card/80 p-4">
      <div className="text-[14px] font-['Inter'] font-medium mb-3">{poll.question}</div>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const selected = poll.userVotedOptionId === opt.id;
          return (
            <button key={opt.id} type="button" disabled={vote.isPending} onClick={() => cast(opt.id)}
              className={`w-full relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? "border-terracotta bg-terracotta/5" : "border-border hover:border-terracotta/40"}`}>
              {poll.userVotedOptionId && (
                <div className="absolute inset-y-0 left-0 bg-terracotta/10 transition-all" style={{ width: `${pct}%` }} />
              )}
              <div className="relative flex justify-between gap-2 text-[13px] font-['Inter']">
                <span>{opt.label}</span>
                {poll.userVotedOptionId != null && <span className="text-muted-foreground tabular-nums">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">{totalVotes} vote{totalVotes === 1 ? "" : "s"}</div>
    </div>
  );
}

export function PostExtrasBlock({ post }: { post: Post }) {
  const textStyle = post.backgroundTheme && post.backgroundTheme !== "default"
    ? { ...themeBackgroundStyle(post.backgroundTheme), padding: "1rem", borderRadius: "1rem" }
    : undefined;

  return (
    <>
      {post.location && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-4">
          <MapPin size={13} className="text-ochre shrink-0" />
          <span>{post.location.name}</span>
          {post.location.lat != null && post.location.lng != null && (
            <a href={`https://maps.google.com/?q=${post.location.lat},${post.location.lng}`} target="_blank" rel="noreferrer"
              className="text-ochre underline ml-1">Map</a>
          )}
        </div>
      )}
      {post.taggedUserIds && post.taggedUserIds.length > 0 && <TaggedPeople userIds={post.taggedUserIds} />}
      {post.poll && <PostPollWidget postId={post.id} poll={post.poll} />}
      {textStyle && <style>{`.post-themed-body { border: 1px solid rgba(0,0,0,0.06); }`}</style>}
    </>
  );
}


export function themedBodyClass(post: Post): string {
  return post.backgroundTheme && post.backgroundTheme !== "default" ? "post-themed-body" : "";
}

export function themedBodyStyle(post: Post): CSSProperties | undefined {
  if (!post.backgroundTheme || post.backgroundTheme === "default") return undefined;
  return themeBackgroundStyle(post.backgroundTheme);
}
