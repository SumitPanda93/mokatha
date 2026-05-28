import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Zap } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId } from "@/lib/store";
import { consumeCreateDraft, type CreateDraft, type CreateVisibility } from "@/lib/createDraft";
import { toast } from "sonner";

const PAPERS = [
  { id: "cream", label: "Cream", style: { background: "#F5F3EF" }, ink: "#121212" },
  { id: "sand", label: "Sand", style: { background: "linear-gradient(135deg,#EFE6D6,#E8DDC9)" }, ink: "#3A2A1A" },
  { id: "lavender", label: "Lavender", style: { background: "linear-gradient(135deg,#EDE7F6,#D6CDE8)" }, ink: "#3B2860" },
  { id: "wine", label: "Wine", style: { background: "linear-gradient(135deg,#1A0F14,#3B1A1F)" }, ink: "#F5E2C2" },
];

const ACCESS_TYPES = [
  { id: "free",    label: "Free",     icon: null,  hint: "Everyone can read" },
  { id: "tip",     label: "Tip-based", icon: Zap,   hint: "Readers tip to unlock" },
  { id: "premium", label: "Premium",  icon: Lock,  hint: "Subscribers only" },
] as const;
type AccessType = "free" | "tip" | "premium";

const MIN_TIPS = [5, 10, 20, 50];

export default function CreateText() {
  useTitle("Write poem");
  const [, setLocation] = useLocation();
  const [paper, setPaper] = useState(PAPERS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [accessType, setAccessType] = useState<AccessType>("free");
  const [minTip, setMinTip] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [visibility, setVisibility] = useState<CreateVisibility>("public");
  const [hubDraft, setHubDraft] = useState<CreateDraft | null>(null);
  const add = useAddPost();

  useEffect(() => {
    const draft = consumeCreateDraft("text");
    if (!draft) return;
    if (draft.title) setTitle(draft.title);
    if (draft.body) setBody(draft.body);
    if (draft.accessType) setAccessType(draft.accessType === "tip" ? "tip" : "free");
    if (draft.minTip) setMinTip(draft.minTip);
    if (draft.isPrivate) setIsPrivate(true);
    if (draft.visibility) setVisibility(draft.visibility);
    setHubDraft(draft);
  }, []);

  const lines = body.split("\n").filter(Boolean).length;
  const chars = body.length;

  const publish = () => {
    if (!title.trim() || !body.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    add.mutate({
      kind: "text", authorId: me, title: title.trim(), body,
      coverUrl: hubDraft?.coverUrl, language,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      accessType,
      minTip: accessType === "tip" ? minTip : undefined,
      visibility: visibility ?? (isPrivate ? "private" : "public"),
      isPrivate: visibility === "private" || isPrivate || undefined,
      scheduledAt: hubDraft?.scheduledAt,
      backgroundTheme: hubDraft?.backgroundTheme,
      location: hubDraft?.location,
      poll: hubDraft?.poll,
      taggedUserIds: hubDraft?.taggedUserIds,
    }, { onSuccess: () => { toast.success("Poem published!"); setLocation("/"); } });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Text poem</div>
        <div className="w-9" />
      </div>

      <div className="px-5 mt-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Paper</div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {PAPERS.map((p) => (
            <button key={p.id} onClick={() => setPaper(p)} className={`shrink-0 w-16 h-16 rounded-xl border-2 ${paper.id === p.id ? "border-terracotta" : "border-transparent"}`} style={p.style} />
          ))}
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="rounded-2xl p-6" style={paper.style as any}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full bg-transparent outline-none font-['Playfair_Display'] text-[26px] mb-3 placeholder:opacity-40" style={{ color: paper.ink }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Begin in your own language…" rows={10} className="w-full bg-transparent outline-none font-['Playfair_Display'] text-[16px] leading-[1.7] resize-none placeholder:opacity-40" style={{ color: paper.ink }} />
          <div className="text-[10px] mt-3 opacity-70" style={{ color: paper.ink }}>{lines} lines · {chars} chars</div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta" />

        {/* Language */}
        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)} className={`px-3 py-1.5 text-[12px] rounded-full border ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>

        {/* Access type */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Access type</div>
          <div className="grid grid-cols-3 gap-2">
            {ACCESS_TYPES.map((a) => (
              <button key={a.id} onClick={() => setAccessType(a.id)}
                className={`py-2.5 px-2 rounded-xl border text-[12px] flex flex-col items-center gap-1 transition-colors ${accessType === a.id ? "bg-foreground text-background border-foreground" : "border-border bg-card hover:border-terracotta"}`}>
                {a.icon && <a.icon size={13} />}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 px-1">{ACCESS_TYPES.find((a) => a.id === accessType)?.hint}</div>
        </div>

        {/* Min tip selector */}
        {accessType === "tip" && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Minimum tip to unlock</div>
            <div className="flex gap-2">
              {MIN_TIPS.map((v) => (
                <button key={v} onClick={() => setMinTip(v)}
                  className={`flex-1 py-2 rounded-xl border text-[13px] transition-colors ${minTip === v ? "bg-ochre text-white border-ochre" : "border-border bg-card"}`}>
                  ₹{v}
                </button>
              ))}
            </div>
          </div>
        )}

        {accessType === "premium" && (
          <div className="px-4 py-3 rounded-xl border border-plum/30 bg-plum/5 text-[12px] text-foreground/80">
            Only your subscribers can read this. Set up your plan in <Link href="/creator-plan" className="text-plum underline">Subscription settings</Link>.
          </div>
        )}
      </div>

      <div className="px-5 mt-7 mb-10">
        <motion.button whileTap={{ scale: 0.98 }}
          disabled={!title.trim() || !body.trim() || add.isPending} onClick={publish}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-['Inter'] font-medium disabled:opacity-50">
          {add.isPending ? "Publishing…" : "Publish poem"}
        </motion.button>
      </div>
    </div>
  );
}
