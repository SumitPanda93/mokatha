import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Plus, X, Users, DollarSign, TrendingUp } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useCurrentUser, useAuthorPlan, useSubscribersOf, useUpdateAuthorPlan, useWalletBalance,
} from "@/lib/store";

const PRICES = [49, 99, 149, 199];

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className={`w-12 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-foreground" : "bg-muted"}`}>
      <div className={`w-5 h-5 rounded-full bg-background transition-transform ${on ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  );
}

export default function CreatorPlan() {
  useTitle("Creator subscription");
  const { data: user } = useCurrentUser();
  const { data: plan } = useAuthorPlan(user?.id ?? "");
  const { data: subscribers = [] } = useSubscribersOf(user?.id ?? "");
  const { data: balance = 0 } = useWalletBalance(user?.id);
  const updatePlan = useUpdateAuthorPlan();

  const [enabled, setEnabled] = useState(plan?.enabled ?? false);
  const [price, setPrice] = useState(plan?.priceMonthly ?? 99);
  const [benefits, setBenefits] = useState<string[]>(plan?.benefits ?? []);
  const [newBenefit, setNewBenefit] = useState("");

  useEffect(() => {
    if (plan) { setEnabled(plan.enabled); setPrice(plan.priceMonthly); setBenefits(plan.benefits); }
  }, [plan]);

  const subCount = subscribers.length;
  const monthlyEarnings = subCount * price;

  const save = () => {
    updatePlan.mutate({ authorId: user?.id, enabled, priceMonthly: price, benefits });
  };

  const addBenefit = () => {
    if (!newBenefit.trim()) return;
    setBenefits((b) => [...b, newBenefit.trim()]);
    setNewBenefit("");
  };

  const removeBenefit = (i: number) => setBenefits((b) => b.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pb-24">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <Link href="/me" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="font-['Playfair_Display'] text-[20px] leading-none">Creator Plan</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">manage your subscription</div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Subscribers", value: subCount },
            { icon: DollarSign, label: "Monthly", value: `₹${monthlyEarnings.toLocaleString()}` },
            { icon: TrendingUp, label: "Wallet", value: `₹${balance.toLocaleString()}` },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <s.icon size={16} className="mx-auto mb-1 text-muted-foreground" />
              <div className="font-['Playfair_Display'] text-[20px]">{s.value}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Enable toggle */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[14px]">Enable subscription plan</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Allow readers to subscribe monthly</div>
          </div>
          <Toggle on={enabled} set={setEnabled} />
        </div>

        {/* Price picker */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Monthly price</div>
          <div className="grid grid-cols-4 gap-2">
            {PRICES.map((p) => (
              <button key={p} onClick={() => setPrice(p)} className={`py-3 rounded-xl text-[14px] font-['Playfair_Display'] border transition-colors ${price === p ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground/40"}`}>₹{p}</button>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Subscriber benefits</div>
          <div className="space-y-2 mb-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <Check size={12} className="text-sage shrink-0" />
                <span className="flex-1 text-[13px]">{b}</span>
                <button onClick={() => removeBenefit(i)} className="text-muted-foreground hover:text-destructive transition-colors"><X size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newBenefit} onChange={(e) => setNewBenefit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBenefit()} placeholder="Add a benefit…" className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-[12px] outline-none focus:border-foreground/40" />
            <button onClick={addBenefit} className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center"><Plus size={14} /></button>
          </div>
        </div>

        {/* Save */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={save} disabled={updatePlan.isPending} className="w-full py-4 rounded-2xl bg-foreground text-background text-[13px] font-medium disabled:opacity-60">
          {updatePlan.isPending ? "Saving…" : "Save plan"}
        </motion.button>

        {/* Subscribers list */}
        {subscribers.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground mb-3">{subCount} active subscriber{subCount !== 1 ? "s" : ""}</div>
            <div className="space-y-2">
              {subscribers.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[12px] py-1.5">
                  <span className="text-muted-foreground">{s.userId}</span>
                  <span className="text-[10px] text-muted-foreground">Expires {new Date(s.expiryDate).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
