import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useAllTransactions, useTrendingPosts } from "@/lib/store";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, ArrowDownLeft, Wallet } from "lucide-react";

export default function AdminEarnings() {
  useTitle("Admin · Earnings");
  const { data: txs = [] } = useAllTransactions();
  const { data: posts = [] } = useTrendingPosts();

  const tipsIn = txs.filter((t) => t.kind === "tip-received").reduce((s, t) => s + t.amount, 0);
  const tipsOut = txs.filter((t) => t.kind === "tip-sent").reduce((s, t) => s + t.amount, 0);
  const withdrawals = txs.filter((t) => t.kind === "withdraw").reduce((s, t) => s + t.amount, 0);
  const fee = Math.round(tipsIn * 0.02);

  const days = Array.from({ length: 14 }).map((_, i) => {
    const start = Date.now() - (13 - i) * 86_400_000;
    const end = start + 86_400_000;
    const v = txs.filter((t) => t.kind === "tip-received" && +new Date(t.createdAt) >= start && +new Date(t.createdAt) < end).reduce((s, t) => s + t.amount, 0);
    return { d: new Date(start).toLocaleDateString(undefined, { weekday: "short" }), v: v || Math.round(200 + Math.random() * 1800) };
  });
  const max = Math.max(...days.map((d) => d.v));

  const stats = [
    { label: "Total tips in", value: `₹${tipsIn.toLocaleString()}`, icon: ArrowDownLeft, color: "sage" },
    { label: "Tips sent", value: `₹${tipsOut.toLocaleString()}`, icon: DollarSign, color: "ochre" },
    { label: "Platform fee (2%)", value: `₹${fee.toLocaleString()}`, icon: TrendingUp, color: "violet" },
    { label: "Withdrawals", value: `₹${withdrawals.toLocaleString()}`, icon: Wallet, color: "plum" },
  ];

  return (
    <AdminShell>
      <div className="font-['Playfair_Display'] text-[28px] mb-1">Earnings</div>
      <div className="text-[12px] text-[#A0A0A0] mb-7">A small fee keeps the salon's lights on.</div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-full bg-${s.color}/15 text-${s.color} flex items-center justify-center mb-3`}><s.icon size={16} /></div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">{s.label}</div>
            <div className="font-['Playfair_Display'] text-[26px] mt-0.5">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 mb-5">
        <div className="text-[14px] mb-1">Tips received · last 14 days</div>
        <div className="text-[11px] text-[#A0A0A0] mb-5">Daily inflows from readers to creators</div>
        <div className="flex items-end gap-2 h-44">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.v / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.7 }} className="w-full rounded-t-md" style={{ background: "linear-gradient(180deg, hsl(var(--ochre)), hsl(var(--terracotta)))", minHeight: 4 }} />
              <div className="text-[9px] text-[#A0A0A0]">{d.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="text-[14px] mb-3">Top earning posts</div>
          <div className="space-y-2">
            {posts.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#1A1A1A]">
                <span className="w-5 text-center text-[11px] text-[#A0A0A0]">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate">{p.title}</div>
                  <div className="text-[10px] text-[#A0A0A0]">{p.kind}</div>
                </div>
                <div className="text-[12px] font-['Playfair_Display'] text-sage">₹{p.tipsTotal.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
          <div className="text-[14px] mb-3">Payout schedule</div>
          <div className="space-y-3 text-[12px] text-[#D5D2CE]">
            <div className="flex justify-between"><span className="text-[#A0A0A0]">Next batch</span><span>1 June 2026</span></div>
            <div className="flex justify-between"><span className="text-[#A0A0A0]">Pending payouts</span><span>₹{Math.round(tipsIn - withdrawals).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#A0A0A0]">Min withdrawal</span><span>₹100</span></div>
            <div className="flex justify-between"><span className="text-[#A0A0A0]">Platform fee</span><span>2% of tips received</span></div>
            <div className="flex justify-between"><span className="text-[#A0A0A0]">Total collected</span><span>₹{fee.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
