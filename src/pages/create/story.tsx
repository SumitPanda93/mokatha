import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, ImagePlus, X, Loader2 } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadPostCoverImage } from "@/lib/store";
import { toast } from "sonner";

type Chapter = { id: string; title: string; body: string };

export default function CreateStory() {
  useTitle("Write story");
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [tipLock, setTipLock] = useState(false);
  const [minTip, setMinTip] = useState(10);
  const [chapters, setChapters] = useState<Chapter[]>([{ id: "ch1", title: "ପ୍ରଥମ ଅଧ୍ୟାୟ", body: "" }]);
  const coverInputRef = useRef<HTMLInputElement>(null);
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
      kind: "story",
      authorId: me,
      title: title.trim(),
      body,
      coverUrl: coverUrl ?? "",
      language,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      accessType: tipLock ? "tip" : "free",
      minTip: tipLock ? minTip : undefined,
    }, { onSuccess: () => { toast.success("Story published!"); setLocation("/"); } });
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in first"); return; }
    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setUploadingCover(true);
    try {
      const url = await uploadPostCoverImage(me, file);
      setCoverUrl(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
      setCoverPreview(null);
    } finally {
      setUploadingCover(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Story</div>
        <div className="w-9" />
      </div>

      <div className="px-5 mt-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title"
          className="w-full bg-transparent outline-none font-['Playfair_Display'] text-[28px] text-foreground placeholder:text-muted-foreground/50 mb-3 border-b border-border pb-2" />

        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Cover (optional)</div>
          {coverPreview || coverUrl ? (
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
              <img src={coverPreview || coverUrl!} alt="" className="w-full h-full object-cover" />
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
              <button onClick={() => { setCoverUrl(null); setCoverPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => coverInputRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-2 py-7 hover:border-terracotta hover:bg-terracotta/5 transition-all"
            >
              <ImagePlus size={20} className="text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground font-['Inter']">Add your own cover</span>
              <span className="text-[10px] text-muted-foreground/60 font-['Inter']">Leave blank for a cinematic gradient</span>
            </motion.button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
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
        <label className="flex items-center gap-3 text-[13px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={tipLock} onChange={(e) => setTipLock(e.target.checked)} className="rounded border-border" />
          Tip to read (optional story lock)
        </label>
        {tipLock && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Min tip ₹</span>
            <input type="number" min={10} max={5000} value={minTip} onChange={(e) => setMinTip(Number(e.target.value) || 10)}
              className="w-24 bg-card border border-border rounded-xl px-3 py-2 outline-none focus:border-terracotta" />
          </div>
        )}
      </div>

      <div className="px-5 mt-7 mb-10">
        <motion.button whileTap={{ scale: 0.98 }}
          disabled={!title.trim() || add.isPending || uploadingCover} onClick={publish}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-['Inter'] font-medium disabled:opacity-50">
          {add.isPending ? "Publishing…" : "Publish story"}
        </motion.button>
      </div>
    </div>
  );
}
