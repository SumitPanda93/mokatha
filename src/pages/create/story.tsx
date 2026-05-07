import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId } from "@/lib/store";
import { toast } from "sonner";

const COVERS = [
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
  "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
];

type Chapter = { id: string; title: string; body: string };

export default function CreateStory() {
  useTitle("Write story");
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState(COVERS[0]);
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [chapters, setChapters] = useState<Chapter[]>([{ id: "ch1", title: "ପ୍ରଥମ ଅଧ୍ୟାୟ", body: "" }]);
  const add = useAddPost();

  const addChapter = () => setChapters((c) => [...c, { id: `ch${Date.now()}`, title: `अध्याय ${c.length + 1}`, body: "" }]);
  const removeChapter = (id: string) => setChapters((c) => c.filter((x) => x.id !== id));
  const update = (id: string, patch: Partial<Chapter>) => setChapters((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const publish = () => {
    if (!title.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    const body = chapters.map((c) => `${c.title}\n\n${c.body}`).join("\n\n");
    add.mutate({
      kind: "story", authorId: me, title: title.trim(), body,
      coverUrl: cover, language,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
    }, { onSuccess: () => { toast.success("Story published!"); setLocation("/"); } });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <Link href="/create" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Story</div>
        <div className="w-9" />
      </div>

      <div className="px-5 mt-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title" className="w-full bg-transparent outline-none font-['Playfair_Display'] text-[28px] text-foreground placeholder:text-muted-foreground/50 mb-3 border-b border-border pb-2" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Cover</div>
          <div className="grid grid-cols-4 gap-2">
            {COVERS.map((c) => (
              <button key={c} onClick={() => setCover(c)} className={`aspect-[4/3] rounded-xl overflow-hidden border-2 ${cover === c ? "border-terracotta" : "border-transparent"}`}>
                <img src={c} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center justify-between">
          <span>Chapters</span>
          <button onClick={addChapter} className="flex items-center gap-1 text-terracotta normal-case tracking-normal text-[12px]"><Plus size={12} /> Add</button>
        </div>
        <div className="space-y-3">
          {chapters.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[10px] text-muted-foreground">{i + 1}</div>
              <input value={c.title} onChange={(e) => update(c.id, { title: e.target.value })} className="flex-1 bg-transparent font-['Playfair_Display'] text-[16px] text-foreground outline-none" />
              {chapters.length > 1 && <button onClick={() => removeChapter(c.id)} className="text-muted-foreground"><Trash2 size={14} /></button>}
            </div>
            <textarea value={c.body} onChange={(e) => update(c.id, { body: e.target.value })} placeholder="Chapter body…" rows={5} className="w-full bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-muted-foreground leading-[1.7] resize-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta" />
        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)} className={`px-3 py-1.5 text-[12px] rounded-full border ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-7 mb-10">
        <button disabled={!title.trim() || add.isPending} onClick={publish} className="w-full py-3.5 rounded-xl bg-foreground text-background text-[14px] disabled:opacity-50">
          {add.isPending ? "Publishing…" : "Publish story"}
        </button>
      </div>
    </div>
  );
}
