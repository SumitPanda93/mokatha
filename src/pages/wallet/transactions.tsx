import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Minus, BookOpen } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useTransactions, Transaction } from "@/lib/store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function groupByDate(txs: Transaction[]): { label: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = formatDate(tx.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

const isCredit = (tx: Transaction) =>
  tx.kind === "tip-received" || tx.kind === "earning";

function txLabel(tx: Transaction) {
  if (tx.note) return tx.note;
  if (tx.kind === "tip-received") return "Appreciation received";
  if (tx.kind === "tip-sent") return "Appreciation sent";
  if (tx.kind === "withdraw") return "Withdrawal";
  if (tx.kind === "earning") return "Creator earning";
  return tx.kind;
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function TxIcon({ kind }: { kind: string }) {
  const credit = kind === "tip-received" || kind === "earning";
  if (credit) return (
    <div className="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center shrink-0">
      <ArrowDownLeft size={14} className="text-sage" />
    </div>
  );
  if (kind === "withdraw") return (
    <div className="w-9 h-9 rounded-full bg-plum/15 flex items-center justify-center shrink-0">
      <ArrowUpRight size={14} className="text-plum" />
    </div>
  );
  return (
    <div className="w-9 h-9 rounded-full bg-ochre/15 flex items-center justify-center shrink-0">
      <Minus size={14} className="text-ochre" />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 px-5 pb-10 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted rounded-full w-2/3" />
            <div className="h-2.5 bg-muted rounded-full w-1/3" />
          </div>
          <div className="h-4 bg-muted rounded-full w-14" />
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  credit: "Received",
  debit: "Sent",
  withdraw: "Withdrawals",
};

export default function WalletTransactions() {
  useTitle("Statement");
  const [, setLocation] = useLocation();
  const { data: txs, isLoading } = useTransactions();

  const allTxs = (txs ?? []).slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const [filter, setFilter] = useState<keyof typeof FILTER_LABELS>("all");

  const visible = filter === "all" ? allTxs
    : filter === "credit" ? allTxs.filter(isCredit)
    : filter === "debit" ? allTxs.filter((t) => !isCredit(t) && t.kind !== "withdraw")
    : allTxs.filter((t) => t.kind === "withdraw");

  const groups = groupByDate(visible);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/90 backdrop-blur-md z-20 border-b border-border/30">
        <button onClick={() => setLocation("/wallet")}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 font-['Playfair_Display'] text-[20px]">Statement</div>
        <div className="text-[11px] text-muted-foreground font-['Inter']">
          {allTxs.length} entries
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-5 pt-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {(Object.keys(FILTER_LABELS) as Array<keyof typeof FILTER_LABELS>).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-[12px] font-['Inter'] rounded-full whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-foreground text-background font-medium"
                : "bg-card border border-border text-muted-foreground"
            }`}>
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? <Skeleton /> : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-muted-foreground" />
          </div>
          <div className="font-['Playfair_Display'] text-[18px] mb-2">Nothing here yet</div>
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            {filter === "all"
              ? "Your story earnings and tips will appear here."
              : `No ${FILTER_LABELS[filter].toLowerCase()} transactions yet.`}
          </div>
        </div>
      ) : (
        <div className="pb-12">
          {groups.map(({ label, items }) => (
            <div key={label} className="px-5 mt-3">
              {/* Date label */}
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-['Inter'] mb-2 pt-1">
                {label}
              </div>
              {/* Transactions for this date */}
              <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {items.map((tx, i) => {
                  const credit = isCredit(tx);
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <TxIcon kind={tx.kind} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-['Playfair_Display'] line-clamp-1 leading-snug">
                          {txLabel(tx)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-['Inter']">
                            {formatTime(tx.createdAt)}
                          </span>
                          {tx.status === "pending" && (
                            <span className="text-[9px] uppercase tracking-[0.12em] text-ochre border border-ochre/40 rounded-full px-1.5 py-0.5 font-['Inter']">
                              pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`text-[15px] font-['Inter'] font-semibold tabular-nums ${credit ? "text-sage" : "text-muted-foreground"}`}>
                        {credit ? "+" : "−"}₹{tx.amount.toLocaleString()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
