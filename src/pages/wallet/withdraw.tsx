import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Smartphone, Check } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useWalletBalance, useRequestWithdrawal } from "@/lib/store";
import { toast } from "sonner";

export default function Withdraw() {
  useTitle("Withdraw");
  const [, setLocation] = useLocation();
  const { data: balance = 0 } = useWalletBalance();
  const requestWithdrawal = useRequestWithdrawal();
  const [amount, setAmount] = useState(500);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [account, setAccount] = useState("");
  const [done, setDone] = useState(false);

  const submit = () => {
    if (amount < 100 || amount > balance || !account.trim()) return;
    requestWithdrawal.mutate(
      { amount, method, accountDetails: account.trim() },
      { onSuccess: () => { setDone(true); setTimeout(() => setLocation("/wallet"), 1400); } },
    );
  };

  if (done) return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center px-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full bg-sage flex items-center justify-center text-white"><Check size={36} /></motion.div>
      <div className="font-['Playfair_Display'] text-[24px] mt-5">Request placed</div>
      <div className="text-[13px] text-muted-foreground mt-1 text-center">₹{amount.toLocaleString()} should reach you in 2-3 working days.</div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/wallet")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[20px]">Withdraw</div>
      </div>

      <div className="px-6 mt-2">
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, hsl(var(--ochre)/0.18), hsl(var(--terracotta)/0.18))" }}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Available</div>
          <div className="font-['Playfair_Display'] text-[34px] leading-none mt-1">₹{balance.toLocaleString()}</div>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Amount</div>
        <div className="flex items-center bg-card border border-border rounded-xl px-4 py-3">
          <span className="text-[20px] font-['Playfair_Display'] mr-2">₹</span>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 bg-transparent outline-none text-[20px] font-['Playfair_Display']" />
        </div>
        <div className="flex gap-2 mt-2">
          {[100, 500, 1000, balance].map((v, i) => (
            <button key={i} onClick={() => setAmount(v)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-border hover:border-terracotta">{i === 3 ? "Max" : `₹${v}`}</button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Send to</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => setMethod("upi")} className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${method === "upi" ? "border-terracotta bg-terracotta/5" : "border-border"}`}>
            <Smartphone size={18} /><span className="text-[12px]">UPI</span>
          </button>
          <button onClick={() => setMethod("bank")} className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${method === "bank" ? "border-terracotta bg-terracotta/5" : "border-border"}`}>
            <Building2 size={18} /><span className="text-[12px]">Bank</span>
          </button>
        </div>
        <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={method === "upi" ? "yourname@upi" : "Account number"} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] outline-none focus:border-terracotta" />
      </div>

      <div className="px-6 mt-5 mb-10">
        <button disabled={amount < 100 || amount > balance || !account.trim() || requestWithdrawal.isPending} onClick={submit} className="w-full py-3.5 rounded-xl bg-foreground text-background text-[14px] disabled:opacity-50">
          {requestWithdrawal.isPending ? "Submitting…" : "Confirm withdrawal"}
        </button>
        <div className="text-[10px] text-muted-foreground mt-3 text-center">Minimum ₹100. A 2% platform fee applies on tips received.</div>
      </div>
    </div>
  );
}
