import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Minus, TrendingUp } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useTransactions, useWalletBalance, useUser, getCurrentUserId, Transaction,
} from "@/lib/store";

const FMT = (n: number) => `₹${n.toLocaleString()}`;

function TxIcon({ kind }: { kind: string }) {
  if (kind === "tip-received" || kind === "earning") return (
    <div className="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center shrink-0">
      <ArrowDownLeft size={15} className="text-sage" />
    </div>
  );
  if (kind === "withdraw") return (
    <div className="w-9 h-9 rounded-full bg-plum/15 flex items-center justify-center shrink-0">
      <ArrowUpRight size={15} className="text-plum" />
    </div>
  );
  return (
    <div className="w-9 h-9 rounded-full bg-ochre/15 flex items-center justify-center shrink-0">
      <Minus size={15} className="text-ochre" />
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const { data: peer } = useUser(tx.counterpartyId ?? "");
  const isCredit = tx.kind === "tip-received" || tx.kind === "earning";
  const label = tx.note || (peer ? (isCredit ? `From ${peer.displayName}` : `To ${peer.displayName}`) : tx.kind);
  const date = new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <TxIcon kind={tx.kind} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-['Playfair_Display'] line-clamp-1">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
          {date}
          {tx.status === "pending" && <span className="text-ochre text-[9px] uppercase tracking-[0.15em] border border-ochre rounded-full px-1.5 py-0.5">pending</span>}
        </div>
      </div>
      <div className={`text-[15px] font-['Inter'] font-medium ${isCredit ? "text-sage" : "text-plum"}`}>
        {isCredit ? "+" : "−"}{FMT(tx.amount)}
      </div>
    </div>
  );
}

export default function Wallet() {
  useTitle("Wallet");
  const [, setLocation] = useLocation();
  const meId = getCurrentUserId() ?? "";
  const { data: balance = 0 } = useWalletBalance(meId);
  const { data: txs = [], isLoading: txLoading } = useTransactions(meId);

  // Ensure latest first
  const sorted = [...txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const weekStart = Date.now() - 7 * 86_400_000;
  const weeklyEarnings = sorted.filter((t) => t.kind === "tip-received" && +new Date(t.createdAt) >= weekStart).reduce((s, t) => s + t.amount, 0);
  const [showing, setShowing] = useState(8);

  const tips = sorted.filter((t) => t.kind === "tip-received").reduce((s, t) => s + t.amount, 0);
  const earnings = sorted.filter((t) => t.kind === "earning").reduce((s, t) => s + t.amount, 0);
  const mehfilTips = sorted.filter((t) => t.kind === "tip-received" && t.note?.includes("Tip in")).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-5 py-3 flex justify-between items-center sticky top-0 bg-background/90 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="font-['Playfair_Display'] text-[18px]">Wallet</div>
        <Link href="/wallet/transactions" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">Statement</Link>
      </div>

      {/* Balance card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mt-2 p-6 rounded-2xl relative overflow-hidden shadow-lg" style={{ background: "linear-gradient(135deg, hsl(var(--sage)) 0%, #2E4A2C 100%)" }}>
        <div className="absolute -top-10 -right-10 w-[150px] h-[150px] rounded-full bg-ochre/30 blur-2xl" />
        <div className="relative z-10">
          <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-white/70 mb-2">Available Balance</div>
          <div className="text-[48px] font-['Playfair_Display'] font-light leading-none text-white mb-1">{FMT(balance)}</div>
          <div className="text-[12px] font-['Inter'] text-white/80 flex items-center gap-1">
            <TrendingUp size={12} className="text-ochre" /> {FMT(weeklyEarnings)} received this week
          </div>
          <div className="flex gap-2 mt-6 flex-wrap">
            <Link href="/wallet/withdraw">
              <button className="text-[13px] font-['Inter'] bg-white text-sage rounded-full px-6 py-2.5 font-medium hover:scale-[1.02] transition-transform shadow-sm">Withdraw</button>
            </Link>
            <Link href="/wallet/earnings">
              <button className="text-[13px] font-['Inter'] border border-white/40 text-white rounded-full px-5 py-2.5 hover:bg-white/10 transition-colors">Earnings</button>
            </Link>
            <Link href="/wallet/transactions">
              <button className="text-[13px] font-['Inter'] border border-white/40 text-white rounded-full px-5 py-2.5 hover:bg-white/10 transition-colors">Statement</button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats mini cards */}
      <div className="px-5 py-4 flex gap-3">
        <div className="flex-1 border border-border rounded-xl p-3 bg-card">
          <div className="text-[9px] font-['Inter'] tracking-[0.15em] uppercase text-terracotta mb-1">Tips</div>
          <div className="text-[17px] font-['Playfair_Display']">{FMT(tips)}</div>
        </div>
        <div className="flex-1 border border-border rounded-xl p-3 bg-card">
          <div className="text-[9px] font-['Inter'] tracking-[0.15em] uppercase text-violet mb-1">Earnings</div>
          <div className="text-[17px] font-['Playfair_Display']">{FMT(earnings)}</div>
        </div>
        <div className="flex-1 border border-border rounded-xl p-3 bg-card">
          <div className="text-[9px] font-['Inter'] tracking-[0.15em] uppercase text-ochre mb-1">Mehfil</div>
          <div className="text-[17px] font-['Playfair_Display']">{FMT(mehfilTips)}</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="border-t border-border" />
      <div className="px-6 pt-5 pb-2">
        <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-muted-foreground font-medium">Recent Activity</div>
      </div>

      <div className="px-5 pb-10">
        {txLoading && (
          <div className="space-y-1 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded-full w-3/5" />
                  <div className="h-2.5 bg-muted rounded-full w-2/5" />
                </div>
                <div className="h-4 bg-muted rounded-full w-14" />
              </div>
            ))}
          </div>
        )}
        {!txLoading && sorted.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-[13px] font-['Playfair_Display'] italic">
            Your first appreciation will appear here.
          </div>
        )}
        {!txLoading && sorted.slice(0, showing).map((tx) => <TxRow key={tx.id} tx={tx} />)}
        {sorted.length > showing && (
          <button onClick={() => setShowing((s) => s + 8)} className="w-full py-3 mt-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            View more
          </button>
        )}
      </div>
    </div>
  );
}
