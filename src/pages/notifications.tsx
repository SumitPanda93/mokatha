import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, MessageCircle, UserPlus, Coins, Radio, AtSign,
  CheckCheck, Bell, Wallet,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useNotifications, useMarkAllRead, useMarkNotificationRead,
  useUser, useNotificationsRealtime, Notification,
} from "@/lib/store";

// ─── Icon + colour maps ────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  reaction:              Heart,
  like:                  Heart,
  comment:               MessageCircle,
  follow:                UserPlus,
  tip:                   Coins,
  "mehfil-start":        Radio,
  mention:               AtSign,
  message:               MessageCircle,
  "withdrawal-approved": Wallet,
};

const COLORS: Record<string, string> = {
  reaction:              "text-terracotta bg-terracotta/10",
  like:                  "text-terracotta bg-terracotta/10",
  comment:               "text-violet bg-violet/10",
  follow:                "text-sage bg-sage/10",
  tip:                   "text-ochre bg-ochre/10",
  "mehfil-start":        "text-plum bg-plum/10",
  mention:               "text-foreground bg-foreground/10",
  message:               "text-blue-400 bg-blue-400/10",
  "withdrawal-approved": "text-sage bg-sage/10",
};

// ─── Routing ──────────────────────────────────────────────────────────────────

function notifTarget(n: Notification, actorHandle?: string): string {
  if (n.kind === "message")               return `/messages?open=${n.targetId}`;
  if (n.kind === "withdrawal-approved")   return "/wallet";
  if (n.targetId?.startsWith("p"))        return `/post/${n.targetId}`;
  if (n.targetId?.startsWith("m") && n.kind === "mehfil-start") return `/mehfil/${n.targetId}`;
  if (actorHandle)                        return `/u/${actorHandle}`;
  return "/";
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function groupByTime(list: Notification[]) {
  const out: Record<string, Notification[]> = {};
  const now = Date.now();
  for (const n of list) {
    const age = now - +new Date(n.createdAt);
    const label = age < 86_400_000 ? "Today" : age < 7 * 86_400_000 ? "This week" : "Earlier";
    (out[label] ??= []).push(n);
  }
  return out;
}

// ─── Single row ───────────────────────────────────────────────────────────────

function NotifRow({ n }: { n: Notification }) {
  const [, setLocation] = useLocation();
  const markRead = useMarkNotificationRead();
  const Icon  = ICONS[n.kind]  ?? Bell;
  const cls   = COLORS[n.kind] ?? "text-foreground bg-foreground/10";
  const { data: actor } = useUser(n.actorId ?? "");

  const handleClick = () => {
    if (!n.read) markRead.mutate(n.id);
    setLocation(notifTarget(n, actor?.handle));
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors active:scale-[0.99] ${
        n.read ? "bg-transparent hover:bg-card/50" : "bg-card border border-border hover:bg-card"
      }`}
    >
      {/* Icon or avatar */}
      <div className="relative shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cls}`}>
          <Icon size={14} />
        </div>
        {actor?.avatarUrl && (
          <img
            src={actor.avatarUrl}
            alt=""
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2 border-background"
          />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug">
          {actor && <span className="font-medium">{actor.displayName} </span>}
          <span className="text-muted-foreground">{n.body}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{relTime(n.createdAt)}</div>
      </div>

      {/* Unread dot */}
      {!n.read && (
        <div className="w-2 h-2 rounded-full bg-terracotta shrink-0" />
      )}
    </motion.button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Notifications() {
  useTitle("Notifications");
  const [, setLocation] = useLocation();
  const { data: list = [], isLoading } = useNotifications();
  const markAll = useMarkAllRead();
  // Keep count live while on this page
  useNotificationsRealtime();

  const groups = groupByTime(list);
  const hasUnread = list.some((n) => !n.read);

  return (
    <div className="min-h-screen w-full bg-background pb-20">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/90 backdrop-blur-md z-20 border-b border-border">
        <button
          onClick={() => setLocation("/")}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 font-['Playfair_Display'] text-[20px]">Notifications</div>
        {hasUnread && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <CheckCheck size={13} />
            <span className="font-['Inter']">Mark all read</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bell size={22} className="text-muted-foreground" />
            </div>
            <div className="font-['Playfair_Display'] text-[18px] mb-1">Quiet for now</div>
            <div className="text-[13px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
              When someone appreciates your words or joins your room, a gentle note will land here.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([label, items]) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-['Inter'] font-medium mb-2 px-1">
                  {label}
                </div>
                <div className="space-y-1">
                  {items.map((n) => (
                    <NotifRow key={n.id} n={n} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
