/**
 * Wallet — luxury-minimal ledger: grouped inflow/outflow, calm typography, reliable ordering.
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, TrendingUp, ChevronDown } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useTransactions, useWalletBalance, useUser, getCurrentUserId, Transaction,
} from "@/lib/store";
import { PAGE_ENTER, SHEET_SPRING } from "@/lib/motionTokens";

const INR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function isCredit(k: Transaction["kind"]) {
  return k === "tip-received" || k === "earning";
}

function TxDetailRow({ tx }: { tx: Transaction }) {
  const { data: peer } = useUser(tx.counterpartyId ?? "");
  const credit = isCredit(tx.kind);
  const [open, setOpen] = useState(false);

  const label =
    tx.note ||
    (peer
      ? credit
        ? `From ${peer.displayName}`
        : `To ${peer.displayName}`
      : tx.kind.replace(/-/g, " "));

  const when = new Date(tx.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div layout className="rounded-2xl border border-border/35 bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-3.5 px-3 text-left hover:bg-muted/25 transition-colors"
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            credit ? "bg-sage/12 text-sage" : "bg-plum/12 text-plum"
          }`}
        >
          {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-['Playfair_Display'] leading-snug text-foreground/95 line-clamp-2 capitalize">
            {label}
          </div>
          <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-['Inter'] flex flex-wrap gap-x-2 gap-y-0.5">
            <span>{when}</span>
            <span className="uppercase tracking-[0.12em]">{tx.kind.replace(/-/g, " ")}</span>
            {tx.status === "pending" && (
              <span className="text-ochre border border-ochre/35 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                pending
              </span>
            )}
          </div>
        </div>
        <div className={`text-[14px] font-['Inter'] font-semibold tabular-nums shrink-0 ${credit ? "text-sage" : "text-plum"}`}>
          {credit ? "+" : "−"}
          {INR(tx.amount)}
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SHEET_SPRING}
            className="border-t border-border/30 bg-muted/15"
          >
            <div className="px-4 py-3 space-y-1.5 text-[12px] font-['Inter'] text-muted-foreground">
              <div>
                <span className="uppercase tracking-[0.15em] text-[10px]">Status</span>
                <span className="ml-2 capitalize">{tx.status}</span>
              </div>
              {tx.counterpartyId && (
                <div>
                  <span className="uppercase tracking-[0.15em] text-[10px]">Counterparty</span>
                  <span className="ml-2">{peer?.displayName ?? tx.counterpartyId}</span>
                </div>
              )}
              {tx.note && (
                <div>
                  <span className="uppercase tracking-[0.15em] text-[10px]">Note</span>
                  <p className="mt-1 text-foreground/80 leading-relaxed">{tx.note}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 px-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 bg-muted rounded-full w-3/5" />
            <div className="h-2.5 bg-muted rounded-full w-2/5" />
          </div>
          <div className="h-4 bg-muted rounded-full w-14 shrink-0 mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function WalletDashboard() {
  useTitle("Wallet");
  const [, setLocation] = useLocation();
  const meId = getCurrentUserId() ?? "";
  const { data: balance = 0 } = useWalletBalance(meId);
  const { data: txs = [], isLoading, refetch, isFetching } = useTransactions(meId);

  const sorted = useMemo(
    () => [...txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [txs],
  );

  const inflow = sorted.filter((t) => isCredit(t.kind));
  const outflow = sorted.filter((t) => !isCredit(t.kind));

  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekIn = inflow.filter((t) => new Date(t.createdAt).getTime() >= weekAgo).reduce((s, t) => s + t.amount, 0);

  return (
    <motion.div
      className="min-h-screen w-full flex flex-col bg-background text-foreground pb-14"
      initial={PAGE_ENTER.initial}
      animate={PAGE_ENTER.animate}
      transition={PAGE_ENTER.transition}
    >
      <header className="px-5 py-3 flex justify-between items-center sticky top-0 bg-background/92 backdrop-blur-md z-20 border-b border-border/40">
        <button type="button" onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="font-['Playfair_Display'] text-[18px]">Wallet</div>
        <button type="button" onClick={() => void refetch()} className="text-[11px] font-['Inter'] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors">
          {isFetching ? "…" : "Sync"}
        </button>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 34, stiffness: 260, mass: 0.9 }}
        className="mx-5 mt-4 p-6 rounded-[1.35rem] relative overflow-hidden shadow-lg shadow-black/[0.06] border border-white/10"
        style={{ background: "linear-gradient(135deg, hsl(var(--sage)) 0%, #2a4530 100%)" }}
      >
        <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-ochre/25 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[10px] font-['Inter'] tracking-[0.26em] uppercase text-white/70 mb-2">Balance</p>
          <p className="text-[46px] font-['Playfair_Display'] font-light leading-none text-white">{INR(balance)}</p>
          <p className="text-[12px] font-['Inter'] text-white/82 mt-3 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-ochre shrink-0" /> {INR(weekIn)} appreciated this week
          </p>
          <div className="flex flex-wrap gap-2 mt-7">
            <Link href="/wallet/withdraw" className="inline-block text-[13px] font-['Inter'] bg-white text-sage rounded-full px-6 py-2.5 font-medium shadow-sm">
              Withdraw
            </Link>
            <Link href="/creator-earnings" className="inline-block text-[13px] font-['Inter'] border border-white/45 text-white rounded-full px-5 py-2.5 hover:bg-white/10 transition-colors">
              Earnings
            </Link>
            <Link href="/wallet/transactions" className="inline-block text-[13px] font-['Inter'] border border-white/45 text-white rounded-full px-5 py-2.5 hover:bg-white/10 transition-colors">
              Statement
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="px-5 mt-6 space-y-8 flex-1">
        <div>
          <h2 className="text-[10px] font-['Inter'] uppercase tracking-[0.28em] text-muted-foreground mb-3 px-1">Received</h2>
          {isLoading ? (
            <SkeletonRows />
          ) : inflow.length === 0 ? (
            <p className="text-[13px] text-muted-foreground/75 font-['Inter'] px-1 py-6 border border-dashed border-border/50 rounded-2xl text-center">
              Gratitude will appear here — soft credits in the margin of your craft.
            </p>
          ) : (
            <div className="space-y-2">
              {inflow.map((tx) => (
                <TxDetailRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[10px] font-['Inter'] uppercase tracking-[0.28em] text-muted-foreground mb-3 px-1">Sent & withdrawals</h2>
          {isLoading ? (
            <SkeletonRows />
          ) : outflow.length === 0 ? (
            <p className="text-[13px] text-muted-foreground/75 font-['Inter'] px-1 py-6 border border-dashed border-border/50 rounded-2xl text-center">
              Outbound gestures stay quiet — tips, support, and withdrawals list here.
            </p>
          ) : (
            <div className="space-y-2">
              {outflow.map((tx) => (
                <TxDetailRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}
