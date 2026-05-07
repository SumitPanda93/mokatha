import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Gift, Mic, Unlock, ArrowUpRight, Clock, CheckCircle } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useWalletBalance, useTransactions, useUserWithdrawalRequests,
  useRequestWithdrawal, getCurrentUserId,
} from "@/lib/store";
import { toast } from "sonner";

const FMT = (n: number) => `₹${(n ?? 0).toLocaleString()}`;

function TxRow({ tx }: { tx: any }) {
  const isCredit = tx.kind === "tip-received" || tx.kind === "earning";
  const label = tx.note ?? tx.kind;
  const date = new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isCredit ? "bg-sage/15" : "bg-plum/15"}`}>
        {isCredit ? <ArrowUpRight size={14} className="text-sage" /> : <ArrowLeft size={14} className="text-plum" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-['Inter'] truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
          {date}
          {tx.status === "pending" && (
            <span className="flex items-center gap-1 text-ochre text-[9px] uppercase tracking-[0.12em]"><Clock size={8} />pending</span>
          )}
          {tx.status === "completed" && (
            <span className="flex items-center gap-1 text-sage text-[9px] uppercase tracking-[0.12em]"><CheckCircle size={8} />done</span>
          )}
        </div>
      </div>
      <div className={`text-[14px] font-['Playfair_Display'] ${isCredit ? "text-sage" : "text-plum"}`}>
        {isCredit ? "+" : "−"}{FMT(tx.amount)}
      </div>
    </div>
  );
}

export default function CreatorEarnings() {
  useTitle("Earnings");
  const [, setLocation] = useLocation();
  const me = getCurrentUserId() ?? "";
  const { data: balance = 0 } = useWalletBalance(me);
  const { data: txs = [] } = useTransactions(me);
  const { data: wrs = [] } = useUserWithdrawalRequests(me);
  const requestWithdrawal = useRequestWithdrawal();

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState(500);
  const [withdrawMethod, setWithdrawMethod] = useState<"upi" | "bank">("upi");
  const [withdrawAccount, setWithdrawAccount] = useState("");

  const tips    = txs.filter((t) => t.kind === "tip-received" && !t.note?.startsWith("Tip in")).reduce((s, t) => s + t.amount, 0);
  const mehfil  = txs.filter((t) => t.kind === "tip-received" && t.note?.startsWith("Tip in")).reduce((s, t) => s + t.amount, 0);
  const unlocks = txs.filter((t) => t.kind === "earning").reduce((s, t) => s + t.amount, 0);
  const pending = wrs.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);
  const withdrawn = txs.filter((t) => t.kind === "withdraw" && t.status === "completed").reduce((s, t) => s + t.amount, 0);

  const recentTxs = txs.filter((t) => t.kind === "tip-received" || t.kind === "earning").slice(0, 8);

  const submitWithdraw = () => {
    if (!withdrawAccount.trim()) { toast.error("Enter your payment details"); return; }
    requestWithdrawal.mutate(
      { amount: withdrawAmt, method: withdrawMethod, accountDetails: withdrawAccount.trim() },
      { onSuccess: () => setShowWithdraw(false) },
    );
  };

  if (!me) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-8 text-center">
      <div>
        <div className="font-['Playfair_Display'] text-[22px] mb-4">Sign in to view earnings</div>
        <button onClick={() => setLocation("/auth/login")} className="px-8 py-3 rounded-full bg-foreground text-background text-[14px]">Sign in</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/wallet")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="font-['Playfair_Display'] text-[20px]">Creator Earnings</div>
      </div>

      {/* Balance cards */}
      <div className="px-5 pt-2 grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 p-5 rounded-2xl text-white relative overflow-hidden shadow-lg"
          style={{ background: "linear-gradient(135deg, hsl(var(--sage)) 0%, #2E4A2C 100%)" }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-ochre/25 blur-2xl" />
          <div className="relative z-10">
            <div className="text-[9px] tracking-[0.25em] uppercase text-white/60 mb-1">Available balance</div>
            <div className="text-[42px] font-['Playfair_Display'] font-light leading-none mb-3">{FMT(balance)}</div>
            <button onClick={() => setShowWithdraw(true)}
              className="text-[13px] font-['Inter'] bg-white text-sage rounded-full px-6 py-2 font-medium shadow-sm hover:scale-[1.02] transition-transform">
              Withdraw
            </button>
          </div>
        </motion.div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[9px] tracking-[0.15em] uppercase text-ochre mb-1">Pending payout</div>
          <div className="text-[22px] font-['Playfair_Display']">{FMT(pending)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Clock size={9} /> awaiting approval</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[9px] tracking-[0.15em] uppercase text-plum mb-1">Withdrawn</div>
          <div className="text-[22px] font-['Playfair_Display']">{FMT(withdrawn)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><CheckCircle size={9} /> all time</div>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="px-5 mt-4">
        <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-muted-foreground mb-3">Revenue breakdown</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <Gift size={14} className="text-terracotta mx-auto mb-1.5" />
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Tips</div>
            <div className="text-[16px] font-['Playfair_Display']">{FMT(tips)}</div>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <Unlock size={14} className="text-violet mx-auto mb-1.5" />
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Unlocks</div>
            <div className="text-[16px] font-['Playfair_Display']">{FMT(unlocks)}</div>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <Mic size={14} className="text-ochre mx-auto mb-1.5" />
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Mehfil</div>
            <div className="text-[16px] font-['Playfair_Display']">{FMT(mehfil)}</div>
          </div>
        </div>
      </div>

      {/* All-time total */}
      <div className="px-5 mt-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <TrendingUp size={18} className="text-sage shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">All-time earnings</div>
            <div className="text-[20px] font-['Playfair_Display']">{FMT(tips + unlocks + mehfil)}</div>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="px-5 mt-5">
        <div className="text-[10px] font-['Inter'] tracking-[0.25em] uppercase text-muted-foreground mb-2">Recent activity</div>
        {recentTxs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-[13px] font-['Playfair_Display'] italic">No transactions yet.</div>
        ) : (
          recentTxs.map((tx) => <TxRow key={tx.id} tx={tx} />)
        )}
      </div>

      <div className="h-16" />

      {/* Withdraw sheet */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={(e) => e.target === e.currentTarget && setShowWithdraw(false)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-5 pb-10">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
            <div className="font-['Playfair_Display'] text-[22px] mb-1">Withdraw</div>
            <div className="text-[12px] text-muted-foreground mb-5">Available: {FMT(balance)} · 2% platform fee</div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Amount</div>
            <div className="flex items-center bg-card border border-border rounded-xl px-4 py-3 mb-2">
              <span className="text-[20px] font-['Playfair_Display'] mr-2">₹</span>
              <input type="number" value={withdrawAmt} onChange={(e) => setWithdrawAmt(Number(e.target.value))}
                className="flex-1 bg-transparent outline-none text-[20px] font-['Playfair_Display'] text-foreground" />
            </div>
            <div className="flex gap-2 mb-4">
              {[100, 500, 1000, balance].map((v, i) => (
                <button key={i} onClick={() => setWithdrawAmt(v)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-border hover:border-terracotta">
                  {i === 3 ? "Max" : `₹${v}`}
                </button>
              ))}
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Method</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setWithdrawMethod("upi")} className={`py-2.5 rounded-xl border text-[13px] ${withdrawMethod === "upi" ? "border-terracotta bg-terracotta/8" : "border-border"}`}>UPI</button>
              <button onClick={() => setWithdrawMethod("bank")} className={`py-2.5 rounded-xl border text-[13px] ${withdrawMethod === "bank" ? "border-terracotta bg-terracotta/8" : "border-border"}`}>Bank</button>
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
              {withdrawMethod === "upi" ? "UPI ID" : "Account number"}
            </div>
            <input
              value={withdrawAccount}
              onChange={(e) => setWithdrawAccount(e.target.value)}
              placeholder={withdrawMethod === "upi" ? "yourname@upi" : "Account number"}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] outline-none focus:border-terracotta mb-5 text-foreground placeholder:text-muted-foreground"
            />

            <button
              disabled={withdrawAmt < 100 || withdrawAmt > balance || !withdrawAccount.trim() || requestWithdrawal.isPending}
              onClick={submitWithdraw}
              className="w-full py-4 rounded-2xl bg-foreground text-background text-[14px] font-['Inter'] font-medium disabled:opacity-50"
            >
              {requestWithdrawal.isPending ? "Submitting…" : `Request ₹${Math.floor(withdrawAmt * 0.98)}`}
            </button>
            <div className="text-[10px] text-muted-foreground text-center mt-2">Admin reviews and approves within 2–3 working days</div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
