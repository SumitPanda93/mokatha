import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useUserByHandle, useFollowers, useFollowing, useFollow, getCurrentUserId } from "@/lib/store";

export default function Followers() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle ?? "";
  const [, setLocation] = useLocation();
  const { data: user } = useUserByHandle(handle);
  const me = getCurrentUserId();
  const { data: followers = [] } = useFollowers(user?.id ?? "");
  const { data: myFollowing = [] } = useFollowing(me);
  const follow = useFollow();
  useTitle(user ? `${user.displayName} · Followers` : "Followers");

  const followingSet = new Set(myFollowing.map((u) => u.id));

  if (!user) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation(`/u/${handle}`)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div>
          <div className="font-['Playfair_Display'] text-[18px] leading-tight">Followers</div>
          <div className="text-[11px] text-muted-foreground">{user.displayName}</div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        {followers.map((u) => {
          const fol = followingSet.has(u.id);
          return (
            <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-card">
              <Link href={`/u/${u.handle}`}><img src={u.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" /></Link>
              <Link href={`/u/${u.handle}`} className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate flex items-center gap-1">{u.displayName}{u.verified && <span className="w-3.5 h-3.5 rounded-full bg-sage text-white text-[8px] flex items-center justify-center">✓</span>}</div>
                <div className="text-[11px] text-muted-foreground truncate">{u.bio}</div>
              </Link>
              {me !== u.id && (
                <button onClick={() => follow.mutate({ userId: u.id, on: !fol })} className={`px-3 py-1.5 rounded-full text-[11px] ${fol ? "border border-border" : "bg-foreground text-background"}`}>{fol ? "Following" : "Follow"}</button>
              )}
            </div>
          );
        })}
        {followers.length === 0 && <div className="text-center text-muted-foreground text-[13px] py-10">No followers yet.</div>}
      </div>
    </div>
  );
}
