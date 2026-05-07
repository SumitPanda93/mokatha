import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useReports, useResolveReport, useUser, usePost } from "@/lib/store";

const REASON_LABEL: Record<string, string> = {
  spam: "Spam", abuse: "Abuse / harassment", copyright: "Copyright", harm: "Self-harm risk", other: "Other",
};

export default function Reported() {
  useTitle("Admin · Reported content");
  const { data: reports = [] } = useReports();
  const resolve = useResolveReport();
  const [tab, setTab] = useState<"pending" | "resolved" | "dismissed">("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const visible = reports.filter((r) => r.status === tab);

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Reported content</div>
          <div className="text-[12px] text-[#A0A0A0]">{reports.filter((r) => r.status === "pending").length} open · {reports.length} total</div>
        </div>
        <div className="flex gap-2">
          {(["pending", "resolved", "dismissed"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] rounded-full ${tab === t ? "bg-sage text-[#0F0A14]" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0]"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
          {visible.map((r) => <ReportRow key={r.id} r={r} onClick={() => setSelected(r)} />)}
          {visible.length === 0 && <div className="p-12 text-center text-[#A0A0A0]">Nothing here.</div>}
        </div>
        <div className="col-span-5">
          {selected ? (
            <ReportDetail r={selected} onClose={() => setSelected(null)} onResolve={(action: "resolved" | "dismissed") => { resolve.mutate({ id: selected.id, action }); setSelected(null); }} />
          ) : (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-10 text-center text-[#A0A0A0]">Select a report to investigate.</div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function ReportRow({ r, onClick }: any) {
  const { data: post } = usePost(r.kind === "post" ? r.targetId : "");
  const { data: reporter } = useUser(r.reporterId);
  const label = REASON_LABEL[r.reason] ?? r.reason;
  return (
    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClick} className="w-full flex items-center gap-3 p-4 hover:bg-[#1A1A1A] text-left">
      <div className="w-9 h-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center"><AlertTriangle size={14} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] flex items-center gap-2"><span className="text-[#A0A0A0]">{label}</span> · <span className="truncate">{post?.title ?? r.kind}</span></div>
        <div className="text-[10px] text-[#A0A0A0] mt-0.5">by {reporter?.displayName} · {new Date(r.createdAt).toLocaleString()}</div>
      </div>
      <ChevronRight size={14} className="text-[#A0A0A0]" />
    </motion.button>
  );
}

function ReportDetail({ r, onClose, onResolve }: any) {
  const { data: post } = usePost(r.kind === "post" ? r.targetId : "");
  const { data: reporter } = useUser(r.reporterId);
  const label = REASON_LABEL[r.reason] ?? r.reason;
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#A0A0A0]">{label}</div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#1A1A1A] flex items-center justify-center"><X size={12} /></button>
      </div>
      <div className="text-[12px] text-[#A0A0A0] mb-3">Reported by <span className="text-[#F5F3EF]">{reporter?.displayName}</span></div>
      <div className="text-[13px] italic mb-4 text-[#D5D2CE]">"{r.note ?? r.reason}"</div>

      {post && (
        <div className="bg-[#1A1A1A] rounded-xl p-3 mb-4">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A0A0]">{post.kind}</div>
          <div className="font-['Playfair_Display'] text-[16px] mt-0.5">{post.title}</div>
          <div className="text-[12px] text-[#A0A0A0] line-clamp-4 mt-1">{post.body}</div>
        </div>
      )}

      {r.status === "pending" ? (
        <div className="space-y-2">
          <button onClick={() => onResolve("dismissed")} className="w-full py-2.5 rounded-xl border border-[#333] text-[12px]">Dismiss · no action</button>
          <button onClick={() => onResolve("resolved")} className="w-full py-2.5 rounded-xl bg-destructive text-white text-[12px]">Resolve · take action</button>
        </div>
      ) : (
        <div className="text-[11px] text-[#A0A0A0] text-center">Closed · {r.status}</div>
      )}
    </div>
  );
}
