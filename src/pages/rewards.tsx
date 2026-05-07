import { useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flame, Star, Zap, Award, Users, BookOpen, Heart, Share2, Radio, LogIn } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useCurrentUser, useInkReward, useTopReaders, useClaimDailyStreak, useAllUsers,
} from "@/lib/store";

const BADGE_META: Record<string, { label: string; icon: string; color: string; req: string }> = {
  "supporter":     { label: "Supporter",     icon: "💛", color: "bg-ochre/10 border-ochre/30 text-ochre",   req: "Earn 100 Ink Points" },
  "top-reader":    { label: "Top Reader",    icon: "📖", color: "bg-sage/10 border-sage/30 text-sage",     req: "Earn 200 Ink Points" },
  "soul-listener": { label: "Soul Listener", icon: "🎧", color: "bg-violet/10 border-violet/30 text-violet", req: "Earn 500 Ink Points" },
};

const ALL_BADGES = ["supporter", "top-reader", "soul-listener"];

const HOW_TO = [
  { action: "Read a story",     pts: 5,  icon: BookOpen, color: "text-ochre" },
  { action: "Tip an author",    pts: 10, icon: Heart,    color: "text-terracotta" },
  { action: "Join a Mehfil",    pts: 15, icon: Radio,    color: "text-plum" },
  { action: "Daily login",      pts: 3,  icon: LogIn,    color: "text-sage" },
  { action: "Share content",    pts: 5,  icon: Share2,   color: "text-violet" },
  { action: "Subscribe to creator", pts: 20, icon: Star,  color: "text-ochre" },
];

export default function Rewards() {
  useTitle("Ink Points");
  const { data: user } = useCurrentUser();
  const { data: reward } = useInkReward(user?.id);
  const { data: topReaders = [] } = useTopReaders();
  const { data: allUsers = [] } = useAllUsers();
  const claimStreak = useClaimDailyStreak();

  const points = reward?.points ?? 0;
  const streak = reward?.streakDays ?? 0;
  const badges = reward?.badges ?? [];
  const today = new Date().toISOString().split("T")[0];
  const alreadyClaimed = reward?.lastClaimDate === today;

  const nextBadge = points < 100 ? { name: "Supporter", req: 100 } : points < 200 ? { name: "Top Reader", req: 200 } : points < 500 ? { name: "Soul Listener", req: 500 } : null;
  const progress = nextBadge ? Math.min(100, (points / nextBadge.req) * 100) : 100;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <Link href="/me" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="font-['Playfair_Display'] text-[18px] leading-none">Ink Points</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">your reading rewards</div>
        </div>
      </div>

      {/* Points hero */}
      <div className="px-5 pt-6 pb-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, hsl(var(--ochre)/0.25), hsl(var(--plum)/0.25), hsl(var(--terracotta)/0.15))" }}
        >
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, hsl(var(--ochre)) 0%, transparent 60%)", filter: "blur(40px)" }} />
          <div className="relative p-6 text-center">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Total Ink Points</div>
            <motion.div
              key={points}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-['Playfair_Display'] text-[64px] leading-none text-foreground"
            >
              {points.toLocaleString()}
            </motion.div>
            <div className="text-[12px] text-muted-foreground mt-1">pts</div>

            {nextBadge && (
              <div className="mt-5">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Progress to {nextBadge.name}</span>
                  <span>{points}/{nextBadge.req}</span>
                </div>
                <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, hsl(var(--ochre)), hsl(var(--terracotta)))" }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Streak + daily claim */}
      <div className="px-5 mb-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0"
            style={{ background: streak > 0 ? "linear-gradient(135deg, hsl(var(--terracotta)), hsl(var(--ochre)))" : "hsl(var(--muted))" }}>
            <Flame size={20} className={streak > 0 ? "text-white" : "text-muted-foreground"} />
            <div className="text-[10px] font-bold text-white mt-0.5">{streak}</div>
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-['Playfair_Display']">{streak > 0 ? `${streak}-day streak` : "Start your streak"}</div>
            <div className="text-[11px] text-muted-foreground">Daily login earns +3 Ink Points</div>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => user && claimStreak.mutate(user.id)}
            disabled={alreadyClaimed || claimStreak.isPending}
            className={`px-4 py-2 rounded-xl text-[12px] font-medium transition-colors ${alreadyClaimed ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-90"}`}
          >
            {alreadyClaimed ? "Claimed ✓" : "+3 pts"}
          </motion.button>
        </motion.div>
      </div>

      {/* Badges */}
      <div className="px-5 mb-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Badges</div>
        <div className="grid grid-cols-3 gap-3">
          {ALL_BADGES.map((key) => {
            const meta = BADGE_META[key];
            const earned = badges.includes(key);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-4 text-center ${earned ? meta.color : "border-border bg-card opacity-40"}`}
              >
                <div className="text-[28px] mb-1">{earned ? meta.icon : "🔒"}</div>
                <div className="text-[12px] font-medium">{meta.label}</div>
                <div className="text-[10px] mt-0.5 opacity-70">{meta.req}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* How to earn */}
      <div className="px-5 mb-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">How to earn Ink Points</div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {HOW_TO.map((item, i) => (
            <div key={item.action} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}>
              <item.icon size={16} className={item.color} />
              <div className="flex-1 text-[13px]">{item.action}</div>
              <div className="font-['Playfair_Display'] text-[16px] text-foreground">+{item.pts}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Use points section */}
      <div className="px-5 mb-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Spend Ink Points</div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Zap size={16} className="text-ochre" />
            <div className="flex-1">
              <div className="text-[13px]">Unlock tip-based content</div>
              <div className="text-[11px] text-muted-foreground">Spend 50 pts instead of paying</div>
            </div>
            <div className="font-['Playfair_Display'] text-[14px] text-ochre">50 pts</div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5 border-t border-border">
            <Award size={16} className="text-plum" />
            <div className="flex-1">
              <div className="text-[13px]">Profile rank badge</div>
              <div className="text-[11px] text-muted-foreground">Shown on your public profile</div>
            </div>
            <div className="font-['Playfair_Display'] text-[14px] text-plum">Auto</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
          <Users size={11} />Top readers this month
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <AnimatePresence>
            {topReaders.map((r, i) => {
              const u = allUsers.find((x) => x.id === r.userId);
              if (!u) return null;
              const isMe = u.id === user?.id;
              return (
                <motion.div
                  key={r.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""} ${isMe ? "bg-ochre/5" : ""}`}
                >
                  <div className="w-6 text-center text-[12px] font-['Playfair_Display'] text-muted-foreground">{i + 1}</div>
                  <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] flex items-center gap-1">
                      {u.displayName}{isMe && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-ochre/20 text-ochre uppercase tracking-wider">you</span>}
                    </div>
                    <div className="flex gap-1 mt-0.5">
                      {r.badges.map((b) => <span key={b} className="text-[10px]">{BADGE_META[b]?.icon}</span>)}
                    </div>
                  </div>
                  <div className="font-['Playfair_Display'] text-[16px]">{r.points.toLocaleString()}</div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {topReaders.length === 0 && <div className="p-8 text-center text-muted-foreground text-[12px]">No readers yet.</div>}
        </div>
      </div>
    </div>
  );
}
