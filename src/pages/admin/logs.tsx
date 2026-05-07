import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Download, Shield, AlertTriangle, BadgeCheck, Trash2, UserX, Settings, FileText } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useAdminLogs, useAllUsers, User } from "@/lib/store";

const ICONS: Record<string, any> = {
  "suspended user": UserX, "reinstated user": Shield, "verified user": BadgeCheck,
  "removed verification": BadgeCheck, delete_post: Trash2, "approved post": FileText,
  "resolved report": Shield, "dismissed report": Shield, "updated commission": Settings,
  "enabled auto-moderation": Settings, "ended mehfil": AlertTriangle, "approved payout": Activity,
};

export default function AdminLogs() {
  useTitle("Admin · Audit logs");
  const { data: logs = [] } = useAdminLogs();
  const { data: allUsers = [] } = useAllUsers();
  const [q, setQ] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");

  const userMap = useMemo(() => Object.fromEntries(allUsers.map((u: User) => [u.id, u])), [allUsers]);
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId)));

  const visible = logs
    .filter((l) => actorFilter === "all" || l.actorId === actorFilter)
    .filter((l) => (l.action + " " + l.target).toLowerCase().includes(q.toLowerCase()));

  const handleExport = () => {
    const rows = [
      ["Timestamp", "Actor", "Action", "Target"],
      ...visible.map((l) => [new Date(l.createdAt).toISOString(), userMap[l.actorId]?.displayName ?? l.actorId, l.action, l.target]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `mokatha-audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Audit logs</div>
          <div className="text-[12px] text-[#A0A0A0]">{logs.length} entries · every editor action recorded</div>
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions…" className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-4 py-1.5 text-[12px] outline-none w-56 focus:border-[#6BAE8A]" />
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-3 py-1.5 text-[12px] outline-none text-[#F5F3EF]">
            <option value="all">All actors</option>
            {actorIds.map((id) => (<option key={id} value={id}>{userMap[id]?.displayName ?? id}</option>))}
          </select>
          <button onClick={handleExport} className="px-3 py-1.5 text-[11px] rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] flex items-center gap-1 hover:border-[#6BAE8A] hover:text-[#6BAE8A] transition-colors">
            <Download size={11} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total actions", value: logs.length },
          { label: "Verified users", value: logs.filter((l) => l.action.includes("verified")).length },
          { label: "Reports resolved", value: logs.filter((l) => l.action.includes("report")).length },
          { label: "Users suspended", value: logs.filter((l) => l.action.includes("suspended")).length },
        ].map((s) => (
          <div key={s.label} className="bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">{s.label}</div>
            <div className="font-['Playfair_Display'] text-[22px] mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2A2A2A] text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">
          <div className="col-span-1" /><div className="col-span-3">Actor</div><div className="col-span-4">Action</div><div className="col-span-2">Target</div><div className="col-span-2 text-right">When</div>
        </div>
        <div className="divide-y divide-[#2A2A2A]">
          {visible.map((l, i) => {
            const Icon = ICONS[l.action] ?? Activity;
            const actorUser = userMap[l.actorId];
            return (
              <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="grid grid-cols-12 px-5 py-3.5 items-center text-[13px] hover:bg-[#1A1A1A] transition-colors">
                <div className="col-span-1"><div className="w-8 h-8 rounded-full bg-[#1A1A1A] text-[#6BAE8A] flex items-center justify-center"><Icon size={13} /></div></div>
                <div className="col-span-3 flex items-center gap-2">
                  {actorUser && <img src={actorUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                  <span className="text-[12px]">{actorUser?.displayName ?? l.actorId}</span>
                </div>
                <div className="col-span-4 text-[#D5D2CE]">{l.action}</div>
                <div className="col-span-2 text-[11px] text-[#A0A0A0] font-mono truncate">{l.target}</div>
                <div className="col-span-2 text-right text-[10px] text-[#666]">{new Date(l.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              </motion.div>
            );
          })}
          {visible.length === 0 && <div className="px-5 py-12 text-center text-[#A0A0A0]">No audit entries match.</div>}
        </div>
      </div>
    </AdminShell>
  );
}
