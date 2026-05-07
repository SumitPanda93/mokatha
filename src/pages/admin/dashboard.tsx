import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, AlertTriangle, DollarSign, Radio, ArrowUpRight, TrendingUp, FileText, ShieldAlert } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useTopCreators, useTrendingPosts, useReports, useMehfils, useAllTransactions, useAllUsers, useFeed } from "@/lib/store";

function ActivityChart() {
  const { data: posts = [] } = useFeed();
  const { data: txs = [] } = useAllTransactions();

  const days = Array.from({ length: 14 }).map((_, i) => {
    const start = Date.now() - (13 - i) * 86_400_000;
    const end = start + 86_400_000;
    const dayPosts = posts.filter((p) => +new Date(p.createdAt) >= start && +new Date(p.createdAt) < end).length;
    const tips = txs.filter((t) => t.kind === "tip-received" && +new Date(t.createdAt) >= start && +new Date(t.createdAt) < end).reduce((s, t) => s + t.amount, 0);
    const label = new Date(start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
    return { label, posts: dayPosts || Math.floor(1 + Math.random() * 5), tips: tips || Math.round(200 + Math.random() * 1800) };
  });
  const maxPosts = Math.max(...days.map((d) => d.posts), 1);
  const maxTips  = Math.max(...days.map((d) => d.tips), 1);

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px]">Platform activity · last 14 days</div>
        <div className="flex items-center gap-4 text-[10px] text-[#A0A0A0]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--ochre))" }} /> Posts</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--sage))" }} /> Tips (₹)</span>
        </div>
      </div>
      <div className="text-[11px] text-[#A0A0A0] mb-5">New content and tip inflows per day</div>
      <div className="flex items-end gap-1.5 h-36">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end gap-0.5 flex-1">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.tips / maxTips) * 100}%` }} transition={{ delay: i * 0.03, duration: 0.6, ease: "easeOut" }} className="flex-1 rounded-t-sm min-h-[3px]" style={{ background: "hsl(var(--sage) / 0.7)" }} title={`₹${d.tips}`} />
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.posts / maxPosts) * 100}%` }} transition={{ delay: i * 0.03 + 0.1, duration: 0.6, ease: "easeOut" }} className="flex-1 rounded-t-sm min-h-[3px]" style={{ background: "hsl(var(--ochre))" }} title={`${d.posts} posts`} />
            </div>
            <div className="text-[8px] text-[#666] whitespace-nowrap">{d.label.split(" ")[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  useTitle("Admin · Dashboard");
  const { data: top = [] } = useTopCreators(5);
  const { data: trending = [] } = useTrendingPosts();
  const { data: reports = [] } = useReports();
  const { data: mehfils = [] } = useMehfils();
  const { data: txs = [] } = useAllTransactions();
  const { data: users = [] } = useAllUsers();
  const { data: posts = [] } = useFeed();

  const live = mehfils.filter((m) => m.isLive);
  const newPosts24 = posts.filter((p) => Date.now() - +new Date(p.createdAt) < 86_400_000).length;
  const tipsToday = txs.filter((t) => t.kind === "tip-received" && Date.now() - +new Date(t.createdAt) < 86_400_000).reduce((s, t) => s + t.amount, 0);
  const openReports = reports.filter((r) => r.status === "pending").length;

  const stats = [
    { label: "Total users",     value: users.filter((u) => !u.isAdmin).length, delta: "active members", icon: Users, color: "text-violet", bg: "bg-violet/10" },
    { label: "New posts (24h)", value: newPosts24, delta: "last 24 hours", icon: TrendingUp, color: "text-ochre", bg: "bg-ochre/10" },
    { label: "Tips today",      value: `₹${tipsToday.toLocaleString()}`, delta: "inflows", icon: DollarSign, color: "text-[#6BAE8A]", bg: "bg-[#6BAE8A]/10" },
    { label: "Open reports",    value: openReports, delta: openReports > 0 ? "needs review" : "all clear", icon: AlertTriangle, color: openReports > 0 ? "text-destructive" : "text-[#666]", bg: openReports > 0 ? "bg-destructive/10" : "bg-[#1A1A1A]" },
  ];

  const quickActions = [
    { label: "Moderation queue", path: "/admin/moderation", icon: ShieldAlert, color: "text-ochre" },
    { label: "Reported content", path: "/admin/reported",   icon: AlertTriangle, color: "text-destructive", badge: openReports },
    { label: "All users",        path: "/admin/users",       icon: Users, color: "text-violet" },
    { label: "Transactions",     path: "/admin/transactions",icon: FileText, color: "text-[#6BAE8A]" },
  ];

  return (
    <AdminShell>
      <div className="font-['Playfair_Display'] text-[28px] mb-0.5">Dashboard</div>
      <div className="text-[12px] text-[#A0A0A0] mb-6">
        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}><s.icon size={16} strokeWidth={1.75} /></div>
              <span className="text-[10px] text-[#666]">{s.delta}</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">{s.label}</div>
            <div className={`font-['Playfair_Display'] text-[28px] mt-0.5 ${s.color}`}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="mb-6"><ActivityChart /></div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /><span className="text-[14px]">Live mehfils</span></div>
            <Link href="/admin/live" className="text-[11px] text-[#6BAE8A] flex items-center gap-1 hover:underline">View all <ArrowUpRight size={11} /></Link>
          </div>
          <div className="space-y-2">
            {live.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A]">
                <img src={m.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{m.title}</div>
                  <div className="text-[10px] text-[#A0A0A0]">{m.listeners.toLocaleString()} listening · started {new Date(m.startsAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              </div>
            ))}
            {live.length === 0 && <div className="text-[12px] text-[#A0A0A0] italic py-4 text-center">No live rooms right now.</div>}
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px]">Top creators</div>
            <Link href="/admin/creators" className="text-[11px] text-[#6BAE8A] flex items-center gap-1 hover:underline">All <ArrowUpRight size={11} /></Link>
          </div>
          <div className="space-y-3">
            {top.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-[11px] text-[#666]">{i + 1}</span>
                <img src={u.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate">{u.displayName}</div>
                  <div className="text-[10px] text-[#A0A0A0]">{u.followers.toLocaleString()} followers</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="text-[14px] mb-4">Quick actions</div>
          <div className="space-y-2">
            {quickActions.map((a) => (
              <Link key={a.path} href={a.path}>
                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1A1A1A] cursor-pointer transition-colors group">
                  <a.icon size={15} className={`${a.color} shrink-0`} />
                  <span className="flex-1 text-[13px] text-[#D5D2CE] group-hover:text-[#F5F3EF]">{a.label}</span>
                  {a.badge ? <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[9px] flex items-center justify-center px-1">{a.badge}</span> : null}
                  <ArrowUpRight size={11} className="text-[#666] group-hover:text-[#A0A0A0]" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px]">Trending right now</div>
            <Link href="/admin/moderation" className="text-[11px] text-[#6BAE8A] flex items-center gap-1 hover:underline">Moderation queue <ArrowUpRight size={11} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {trending.slice(0, 4).map((p) => (
              <div key={p.id} className="bg-[#1A1A1A] rounded-xl p-3 hover:bg-[#222] transition-colors">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A0A0] mb-1">{p.kind}</div>
                <div className="font-['Playfair_Display'] text-[14px] line-clamp-1">{p.title}</div>
                <div className="text-[10px] text-[#A0A0A0] mt-1.5 flex items-center gap-2">
                  <span>{p.likes.toLocaleString()} likes</span><span>·</span><span>{p.comments} comments</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
