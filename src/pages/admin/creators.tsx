import { useMemo } from "react";
import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useTopCreators, useVerifyUser, useAllWalletBalances, usePostCountsByAuthor } from "@/lib/store";

export default function AdminCreators() {
  useTitle("Admin · Creators");
  const { data: top = [] } = useTopCreators(50);
  const { data: wallets = {} } = useAllWalletBalances();
  const { data: postCounts = {} } = usePostCountsByAuthor();
  const verify = useVerifyUser();

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Creators</div>
          <div className="text-[12px] text-[#A0A0A0]">Ranked by followers</div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] rounded-full bg-sage text-[#0F0A14]">All time</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7">
        {top.slice(0, 3).map((u, i) => (
          <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-2xl text-[11px] font-['Playfair_Display'] italic" style={{ background: "linear-gradient(90deg,hsl(var(--terracotta)),hsl(var(--ochre)))", color: "#0F0A14" }}>#{i + 1}</div>
            <div className="flex items-center gap-3">
              <img src={u.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <div className="text-[14px] flex items-center gap-1">{u.displayName}{u.verified && <BadgeCheck size={12} className="text-sage" />}</div>
                <div className="text-[10px] text-[#A0A0A0]">@{u.handle}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Cell v={`₹${(wallets[u.id] ?? 0).toLocaleString()}`} l="wallet" />
              <Cell v={postCounts[u.id] ?? 0} l="posts" />
              <Cell v={u.followers.toLocaleString()} l="followers" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-[#2A2A2A] text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0]">
          <div className="col-span-1">#</div><div className="col-span-4">Creator</div><div className="col-span-2 text-right">Wallet</div><div className="col-span-2 text-right">Posts</div><div className="col-span-2 text-right">Followers</div><div className="col-span-1 text-right">Verify</div>
        </div>
        <div className="divide-y divide-[#2A2A2A]">
          {top.map((u, i) => (
            <div key={u.id} className="grid grid-cols-12 px-5 py-3 items-center text-[13px]">
              <div className="col-span-1 text-[#A0A0A0]">{i + 1}</div>
              <div className="col-span-4 flex items-center gap-3">
                <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <div className="flex items-center gap-1">{u.displayName}{u.verified && <BadgeCheck size={11} className="text-sage" />}</div>
                  <div className="text-[10px] text-[#A0A0A0]">@{u.handle}</div>
                </div>
              </div>
              <div className="col-span-2 text-right font-['Playfair_Display']">₹{(wallets[u.id] ?? 0).toLocaleString()}</div>
              <div className="col-span-2 text-right text-[#A0A0A0]">{postCounts[u.id] ?? 0}</div>
              <div className="col-span-2 text-right text-[#A0A0A0]">{u.followers.toLocaleString()}</div>
              <div className="col-span-1 text-right">
                <button onClick={() => verify.mutate({ id: u.id, on: !u.verified })} className={`w-7 h-7 rounded-full inline-flex items-center justify-center ${u.verified ? "bg-sage/15 text-sage" : "bg-[#1A1A1A] text-[#A0A0A0]"}`}><BadgeCheck size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

function Cell({ v, l }: { v: any; l: string }) {
  return <div><div className="text-[14px] font-['Playfair_Display']">{v}</div><div className="text-[9px] uppercase tracking-[0.18em] text-[#A0A0A0]">{l}</div></div>;
}
