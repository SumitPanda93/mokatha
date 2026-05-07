import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye, Volume2, FileText, Image as ImageIcon } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { useAdminPosts, useModeratePost, useUser, Post } from "@/lib/store";
import { toast } from "sonner";

export default function Moderation() {
  useTitle("Admin · Moderation queue");
  const { data: allPosts = [], isLoading } = useAdminPosts();
  const moderate = useModeratePost();

  // Show recent posts not yet actioned (not hidden, last 14 days)
  const recentPosts = allPosts
    .filter((p) => !p.hidden && Date.now() - +new Date(p.createdAt) < 14 * 86_400_000)
    .slice(0, 20);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "voice" | "text" | "story" | "reel">("all");

  const queue = recentPosts.filter((p) => !dismissed.has(p.id));
  const visible = filter === "all" ? queue : queue.filter((p) => p.kind === filter);

  const decide = (id: string, action: "approve" | "reject" | "hide") => {
    moderate.mutate({ id, action }, {
      onSuccess: () => {
        setDismissed((s) => new Set([...s, id]));
        toast.success(action === "approve" ? "Approved" : action === "reject" ? "Rejected & deleted" : "Hidden from feed");
      },
    });
  };

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Moderation queue</div>
          <div className="text-[12px] text-[#A0A0A0]">{queue.length} items waiting · keep the salon civil</div>
        </div>
        <div className="flex gap-2">
          {(["all", "voice", "text", "story", "reel"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] rounded-full ${filter === f ? "bg-sage text-[#0F0A14]" : "bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0]"}`}>{f}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#A0A0A0]">Loading posts…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence>
            {visible.map((p) => (
              <ModCard
                key={p.id}
                post={p}
                pending={moderate.isPending}
                onDecide={(a: "approve" | "reject" | "hide") => decide(p.id, a)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      {!isLoading && visible.length === 0 && (
        <div className="text-center py-16 text-[#A0A0A0]">Queue is clear. Take a breath.</div>
      )}
    </AdminShell>
  );
}

function ModCard({ post, onDecide, pending }: { post: Post; onDecide: (a: "approve" | "reject" | "hide") => void; pending: boolean }) {
  const { data: author } = useUser(post.authorId);
  const Icon = post.kind === "voice" ? Volume2 : post.kind === "reel" ? ImageIcon : FileText;
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <img src={author?.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        <div className="flex-1">
          <div className="text-[12px]">{author?.displayName}</div>
          <div className="text-[10px] text-[#A0A0A0]">@{author?.handle} · {new Date(String(post.createdAt)).toLocaleString()}</div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[10px] uppercase tracking-[0.15em] text-[#A0A0A0] flex items-center gap-1"><Icon size={10} /> {post.kind}</span>
      </div>
      <div className="font-['Playfair_Display'] text-[16px] mb-1">{post.title}</div>
      <div className="text-[12px] text-[#A0A0A0] line-clamp-3 italic">{post.body}</div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onDecide("approve")} disabled={pending} className="flex-1 py-2 rounded-lg bg-sage text-[#0F0A14] text-[12px] flex items-center justify-center gap-1 disabled:opacity-50"><Check size={12} /> Approve</button>
        <button onClick={() => onDecide("hide")} disabled={pending} className="flex-1 py-2 rounded-lg border border-[#333] text-[12px] flex items-center justify-center gap-1 disabled:opacity-50"><Eye size={12} /> Hide</button>
        <button onClick={() => onDecide("reject")} disabled={pending} className="flex-1 py-2 rounded-lg border border-destructive text-destructive text-[12px] flex items-center justify-center gap-1 disabled:opacity-50"><X size={12} /> Reject</button>
      </div>
    </motion.div>
  );
}
