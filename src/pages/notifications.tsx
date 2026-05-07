import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Heart, MessageCircle, UserPlus, Coins, Radio, AtSign, CheckCheck } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useNotifications, useMarkAllRead, useUser } from "@/lib/store";

const ICONS: Record<string, any> = {
  reaction: Heart, comment: MessageCircle, follow: UserPlus, tip: Coins, "mehfil-start": Radio, mention: AtSign,
  like: Heart, mehfil_live: Radio,
};
const COLORS: Record<string, string> = {
  reaction: "text-terracotta bg-terracotta/10",
  like: "text-terracotta bg-terracotta/10",
  comment: "text-violet bg-violet/10",
  follow: "text-sage bg-sage/10",
  tip: "text-ochre bg-ochre/10",
  "mehfil-start": "text-plum bg-plum/10",
  mehfil_live: "text-plum bg-plum/10",
  mention: "text-foreground bg-foreground/10",
};

export default function Notifications() {
  useTitle("Notifications");
  const [, setLocation] = useLocation();
  const { data: list = [] } = useNotifications();
  const markAll = useMarkAllRead();
  const [tab, setTab] = useState<"all" | "mentions">("all");
  const visible = tab === "mentions" ? list.filter((n) => n.kind === "mention") : list;

  const groups = groupByTime(visible);

  return (
    <div className="min-h-screen w-full bg-background pb-10">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="flex-1 font-['Playfair_Display'] text-[20px]">Notifications</div>
        <button onClick={() => markAll.mutate()} className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground"><CheckCheck size={12} /> Mark all</button>
      </div>

      <div className="px-5 flex gap-2 pt-2 pb-3 border-b border-border">
        {(["all", "mentions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-[12px] uppercase tracking-[0.15em] rounded-full ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <div className="px-5 mt-3 space-y-5">
        {Object.entries(groups).map(([label, items]) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{label}</div>
            <div className="space-y-1.5">
              {items.map((n) => <NotifRow key={n.id} n={n} />)}
            </div>
          </div>
        ))}
        {visible.length === 0 && <div className="text-center text-muted-foreground text-[13px] py-12">A quiet inbox.</div>}
      </div>
    </div>
  );
}

function NotifRow({ n }: { n: any }) {
  const Icon = ICONS[n.kind] ?? Heart;
  const cls = COLORS[n.kind] ?? "text-foreground bg-foreground/10";
  const { data: actor } = useUser(n.actorId ?? "");
  const target = n.targetId?.startsWith("p") ? `/post/${n.targetId}`
    : n.targetId?.startsWith("m") ? `/mehfil/${n.targetId}`
    : actor ? `/u/${actor.handle}` : "/";
  return (
    <Link href={target}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${n.read ? "bg-transparent" : "bg-card border border-border"}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cls}`}><Icon size={14} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug">
          {actor && <span className="font-medium">{actor.displayName} </span>}
          <span className="text-muted-foreground">{n.body}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{relTime(n.createdAt)}</div>
      </div>
      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-terracotta shrink-0" />}
    </Link>
  );
}

function groupByTime(list: any[]) {
  const out: Record<string, any[]> = {};
  const now = Date.now();
  for (const n of list) {
    const age = now - +new Date(n.createdAt);
    const label = age < 86_400_000 ? "Today" : age < 7 * 86_400_000 ? "This week" : "Earlier";
    (out[label] ??= []).push(n);
  }
  return out;
}
function relTime(iso: string) {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
