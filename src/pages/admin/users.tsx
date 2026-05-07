import { useState } from "react";
import { motion } from "framer-motion";
import { Search, BadgeCheck, Ban, MoreHorizontal, Shield } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useAllUsers, useSuspendUser, useVerifyUser, useAllWalletBalances, usePostCountsByAuthor } from "@/lib/store";

export default function AdminUsers() {
  useTitle("Admin · Users");
  const { data: users = [] } = useAllUsers();
  const { data: wallets = {} } = useAllWalletBalances();
  const { data: postCounts = {} } = usePostCountsByAuthor();
  const suspend = useSuspendUser();
  const verify = useVerifyUser();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "suspended">("all");

  const filtered = users
    .filter((u) => filter === "verified" ? u.verified : filter === "suspended" ? u.suspended : true)
    .filter((u) => (u.displayName + u.handle + (u.location ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Users</div>
          <div className="text-[12px] text-[#A0A0A0]">{users.length} total · {users.filter((u) => u.verified).length} verified · {users.filter((u) => u.suspended).length} suspended</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-full px-3 py-1.5 w-72">
            <Search size={13} className="text-[#A0A0A0] mr-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, handle…" className="flex-1 bg-transparent outline-none text-[12px]" />
          </div>
          <div className="flex gap-1">
            {(["all", "verified", "suspended"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] rounded-full ${filter === f ? "bg-sage text-[#0F0A14]" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0]"}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2A2A2A] text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">
          <div className="col-span-4">User</div><div className="col-span-2">Posts</div><div className="col-span-2">Wallet</div><div className="col-span-2">Status</div><div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-[#2A2A2A]">
          {filtered.map((u) => (
            <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`grid grid-cols-12 px-5 py-3 items-center text-[13px] ${u.suspended ? "opacity-60" : ""}`}>
              <div className="col-span-4 flex items-center gap-3">
                <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <div className="flex items-center gap-1">{u.displayName}{u.verified && <BadgeCheck size={12} className="text-sage" />}</div>
                  <div className="text-[10px] text-[#A0A0A0]">@{u.handle} · {u.location ?? "—"}</div>
                </div>
              </div>
              <div className="col-span-2 text-[#A0A0A0]">{postCounts[u.id] ?? 0}</div>
              <div className="col-span-2 font-['Playfair_Display']">₹{(wallets[u.id] ?? 0).toLocaleString()}</div>
              <div className="col-span-2 text-[#A0A0A0] text-[11px]">{u.suspended ? "Suspended" : u.verified ? "Verified" : "Member"}</div>
              <div className="col-span-2 flex justify-end gap-1">
                <button onClick={() => verify.mutate({ id: u.id, on: !u.verified })} title="Toggle verify" className={`w-8 h-8 rounded-full flex items-center justify-center ${u.verified ? "bg-sage/15 text-sage" : "bg-[#1A1A1A] text-[#A0A0A0] hover:text-sage"}`}><BadgeCheck size={13} /></button>
                <button onClick={() => suspend.mutate({ id: u.id, on: !u.suspended })} title="Toggle suspend" className={`w-8 h-8 rounded-full flex items-center justify-center ${u.suspended ? "bg-destructive/20 text-destructive" : "bg-[#1A1A1A] text-[#A0A0A0] hover:text-destructive"}`}>{u.suspended ? <Shield size={13} /> : <Ban size={13} />}</button>
                <button className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1A1A1A] text-[#A0A0A0]"><MoreHorizontal size={13} /></button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="px-5 py-12 text-center text-[#A0A0A0]">No users match.</div>}
        </div>
      </div>
    </AdminShell>
  );
}
