import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useTransactions } from "@/lib/store";

const FILTERS = ["all", "tip-received", "tip-sent", "withdraw"] as const;
type F = typeof FILTERS[number];

export default function WalletTransactions() {
  useTitle("Transactions");
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<F>("all");
  const { data: txs = [] } = useTransactions();
  const visible = filter === "all" ? txs : txs.filter((t) => t.kind === filter);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/wallet")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[20px]">Transactions</div>
      </div>

      <div className="px-5 pt-2 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[12px] rounded-full whitespace-nowrap ${filter === f ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}>
            {f === "all" ? "All" : f === "tip-received" ? "Received" : f === "tip-sent" ? "Sent" : "Withdrawals"}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-2 pb-10">
        {visible.map((t) => {
          const inflow = t.kind === "tip-received";
          return (
            <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inflow ? "bg-sage/15 text-sage" : "bg-terracotta/15 text-terracotta"}`}>
                {inflow ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{t.note}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className={`text-[14px] font-['Playfair_Display'] ${inflow ? "text-sage" : "text-terracotta"}`}>{inflow ? "+" : "−"}₹{t.amount.toLocaleString()}</div>
            </div>
          );
        })}
        {visible.length === 0 && <div className="text-center text-muted-foreground text-[13px] py-10">No transactions in this view.</div>}
      </div>
    </div>
  );
}
