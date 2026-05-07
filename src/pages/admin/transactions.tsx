import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, ArrowDownLeft, ArrowUpRight, Wallet, Download, Check, X, Clock } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useAllTransactions, useAllUsers, useWithdrawalRequests, useApproveWithdrawal, useRejectWithdrawal, User, WithdrawalRequest } from "@/lib/store";
import { toast } from "sonner";

export default function AdminTransactions() {
  useTitle("Admin · Transactions");
  const { data: all = [] } = useAllTransactions();
  const { data: allUsers = [] } = useAllUsers();
  const { data: wrs = [] } = useWithdrawalRequests();
  const approveMut = useApproveWithdrawal();
  const rejectMut  = useRejectWithdrawal();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "tip-received" | "tip-sent" | "withdraw">("all");
  const [tab, setTab] = useState<"txns" | "withdrawals">("txns");

  const userMap = useMemo(() => Object.fromEntries(allUsers.map((u: User) => [u.id, u])), [allUsers]);

  const visible = all
    .filter((t) => kind === "all" || t.kind === kind)
    .filter((t) => ((t.note ?? "") + " " + t.userId + " " + (userMap[t.userId]?.displayName ?? "")).toLowerCase().includes(q.toLowerCase()));

  const totalIn  = all.filter((t) => t.kind === "tip-received").reduce((s, t) => s + t.amount, 0);
  const totalOut = all.filter((t) => t.kind === "tip-sent").reduce((s, t) => s + t.amount, 0);
  const totalWd  = all.filter((t) => t.kind === "withdraw").reduce((s, t) => s + t.amount, 0);

  const handleExport = () => {
    const rows = [
      ["ID", "User", "Kind", "Amount (₹)", "Note", "Timestamp"],
      ...visible.map((t) => [t.id, userMap[t.userId]?.displayName ?? t.userId, t.kind, t.amount, t.note ?? "", new Date(t.createdAt).toISOString()]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `mokatha-txns-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visible.length} transactions`);
  };

  const pendingWrs = wrs.filter((w) => w.status === "pending");

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Transactions</div>
          <div className="text-[12px] text-[#A0A0A0]">{all.length} entries · live ledger</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-3 py-1.5 w-56 focus-within:border-[#6BAE8A] transition-colors">
            <Search size={13} className="text-[#A0A0A0] mr-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-[12px]" />
          </div>
          <div className="flex gap-1">
            {(["all", "tip-received", "tip-sent", "withdraw"] as const).map((f) => (
              <button key={f} onClick={() => setKind(f)} className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] rounded-full transition-colors ${kind === f ? "bg-[#6BAE8A] text-[#0D0D0D]" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:border-[#6BAE8A]"}`}>
                {f === "all" ? "All" : f === "tip-received" ? "In" : f === "tip-sent" ? "Out" : "Withdrawals"}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="px-3 py-1.5 text-[11px] rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] flex items-center gap-1 hover:border-[#6BAE8A] hover:text-[#6BAE8A] transition-colors">
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">Tips received</div><div className="font-['Playfair_Display'] text-[24px] text-[#6BAE8A] mt-0.5">+₹{totalIn.toLocaleString()}</div></div>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">Tips sent</div><div className="font-['Playfair_Display'] text-[24px] text-terracotta mt-0.5">−₹{totalOut.toLocaleString()}</div></div>
        <button onClick={() => setTab("withdrawals")} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 text-left hover:border-violet transition-colors">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">Withdrawal requests</div>
          <div className="font-['Playfair_Display'] text-[24px] text-violet mt-0.5">{pendingWrs.length} pending</div>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("txns")} className={`px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] rounded-full transition-colors ${tab === "txns" ? "bg-[#6BAE8A] text-[#0D0D0D]" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0]"}`}>Ledger</button>
        <button onClick={() => setTab("withdrawals")} className={`px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] rounded-full transition-colors flex items-center gap-1.5 ${tab === "withdrawals" ? "bg-violet text-white" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0]"}`}>
          <Clock size={10} />Withdrawals{pendingWrs.length > 0 && <span className="bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 leading-none">{pendingWrs.length}</span>}
        </button>
      </div>

      {/* Withdrawal requests panel */}
      {tab === "withdrawals" && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden mb-6">
          <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2A2A2A] text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">
            <div className="col-span-3">Creator</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Method</div>
            <div className="col-span-3">Account</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-[#2A2A2A]">
            {wrs.map((wr: WithdrawalRequest) => {
              const u = userMap[wr.userId];
              return (
                <motion.div key={wr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 px-5 py-3.5 items-center text-[13px]">
                  <div className="col-span-3 flex items-center gap-2">
                    {u && <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                    <div>
                      <div className="text-[12px]">{u?.displayName ?? wr.userId}</div>
                      <div className="text-[10px] text-[#A0A0A0]">{new Date(wr.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  <div className="col-span-2 font-['Playfair_Display'] text-violet">₹{wr.amount.toLocaleString()}</div>
                  <div className="col-span-2 text-[11px] uppercase tracking-[0.1em] text-[#A0A0A0]">{wr.method}</div>
                  <div className="col-span-3 text-[11px] text-[#D5D2CE] truncate">{wr.accountDetails}</div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {wr.status === "pending" ? (
                      <>
                        <button
                          onClick={() => approveMut.mutate(wr.id)}
                          disabled={approveMut.isPending}
                          title="Approve"
                          className="w-7 h-7 rounded-full bg-[#6BAE8A]/15 border border-[#6BAE8A]/30 flex items-center justify-center hover:bg-[#6BAE8A]/30 transition-colors disabled:opacity-40"
                        >
                          <Check size={11} className="text-[#6BAE8A]" />
                        </button>
                        <button
                          onClick={() => rejectMut.mutate({ requestId: wr.id })}
                          disabled={rejectMut.isPending}
                          title="Reject"
                          className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-colors disabled:opacity-40"
                        >
                          <X size={11} className="text-red-400" />
                        </button>
                      </>
                    ) : (
                      <span className={`text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${wr.status === "approved" ? "border-[#6BAE8A]/40 text-[#6BAE8A]" : "border-red-500/40 text-red-400"}`}>{wr.status}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {wrs.length === 0 && <div className="px-5 py-10 text-center text-[#A0A0A0]">No withdrawal requests.</div>}
          </div>
        </div>
      )}

      {tab === "txns" && <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2A2A2A] text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">
          <div className="col-span-1" /><div className="col-span-3">Member</div><div className="col-span-4">Note</div><div className="col-span-2">Kind</div><div className="col-span-2 text-right">Amount</div>
        </div>
        <div className="divide-y divide-[#2A2A2A]">
          {visible.map((t) => {
            const u = userMap[t.userId];
            const Icon = t.kind === "tip-received" ? ArrowDownLeft : t.kind === "tip-sent" ? ArrowUpRight : Wallet;
            const iconCls = t.kind === "tip-received" ? "text-[#6BAE8A] bg-[#6BAE8A]/15" : t.kind === "tip-sent" ? "text-terracotta bg-terracotta/15" : "text-violet bg-violet/15";
            const amtCls = t.kind === "tip-received" ? "text-[#6BAE8A]" : t.kind === "tip-sent" ? "text-terracotta" : "text-violet";
            const sign = t.kind === "tip-received" ? "+" : "−";
            return (
              <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 px-5 py-3 items-center text-[13px] hover:bg-[#1A1A1A] transition-colors">
                <div className="col-span-1"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconCls}`}><Icon size={13} /></div></div>
                <div className="col-span-3 flex items-center gap-2">
                  {u && <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                  <div>
                    <div className="text-[12px]">{u?.displayName ?? t.userId}</div>
                    <div className="text-[10px] text-[#A0A0A0]">{new Date(t.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
                <div className="col-span-4 text-[#D5D2CE] truncate text-[12px]">{t.note ?? "—"}</div>
                <div className="col-span-2 text-[10px] uppercase tracking-[0.12em] text-[#A0A0A0]">{t.kind.replace("-", " ")}</div>
                <div className={`col-span-2 text-right font-['Playfair_Display'] ${amtCls}`}>{sign}₹{t.amount.toLocaleString()}</div>
              </motion.div>
            );
          })}
          {visible.length === 0 && <div className="px-5 py-12 text-center text-[#A0A0A0]">No transactions match.</div>}
        </div>
      </div>}
    </AdminShell>
  );
}
