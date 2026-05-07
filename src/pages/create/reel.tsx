import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Music, Hash, Upload, Loader2, X } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadMediaFile } from "@/lib/store";
import { toast } from "sonner";

const COVERS = [
  "https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800",
  "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
  "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800",
];

export default function CreateReel() {
  useTitle("Create reel");
  const [, setLocation] = useLocation();
  const [cover, setCover] = useState(COVERS[0]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("reel, ");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const add = useAddPost();

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in first"); return; }
    setAudioFile(file);
    setAudioUploading(true);
    try {
      const url = await uploadMediaFile(me, file, "audio");
      setAudioUrl(url);
      toast.success("Audio uploaded");
    } catch (err: any) {
      toast.error(`Audio upload failed: ${err.message}`);
      setAudioFile(null);
    } finally {
      setAudioUploading(false);
      e.target.value = "";
    }
  };

  const removeAudio = () => {
    setAudioFile(null);
    setAudioUrl(undefined);
  };

  const publish = () => {
    if (!caption.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    add.mutate({
      kind: "reel", authorId: me,
      title: caption.split(".")[0]?.slice(0, 60) ?? "Reel",
      body: caption,
      coverUrl: cover,
      ...(audioUrl ? { audioUrl, durationSec: undefined } : {}),
      language,
      tags: hashtags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
    }, { onSuccess: () => { toast.success("Reel published!"); setLocation("/"); } });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <Link href="/create" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Reel</div>
        <div className="w-9" />
      </div>

      {/* Preview */}
      <div className="px-5 mt-3">
        <div className="relative rounded-2xl overflow-hidden aspect-[9/16] max-h-[440px] mx-auto" style={{ width: "min(100%, 270px)" }}>
          <img src={cover} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <div className="text-[11px] opacity-80 mb-0.5">@you</div>
            <div className="font-['Playfair_Display'] text-[16px] leading-tight">{caption || "Your caption will breathe here"}</div>
          </div>
          {audioFile && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/40 text-white text-[10px] flex items-center gap-1">
              <Music size={11} /> {audioFile.name.slice(0, 18)}
            </div>
          )}
        </div>
      </div>

      {/* Cover picker */}
      <div className="px-5 mt-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Cover clip</div>
        <div className="grid grid-cols-4 gap-2">
          {COVERS.map((c) => (
            <button key={c} onClick={() => setCover(c)} className={`aspect-[9/16] rounded-xl overflow-hidden border-2 ${cover === c ? "border-terracotta" : "border-transparent"}`}>
              <img src={c} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" rows={3} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta resize-none" />

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-3">
          <Hash size={14} className="text-muted-foreground" />
          <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="hashtags" className="flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground" />
        </div>

        {/* Audio overlay (optional) */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Audio overlay (optional)</div>
          {audioFile ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-terracotta bg-terracotta/5">
              <Music size={16} className="text-terracotta shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground truncate">{audioFile.name}</div>
                {audioUploading && <div className="text-[11px] text-muted-foreground">Uploading…</div>}
                {!audioUploading && audioUrl && <div className="text-[11px] text-green-600">Uploaded ✓</div>}
              </div>
              <button onClick={removeAudio} className="text-muted-foreground shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => audioInputRef.current?.click()}
              disabled={audioUploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50"
            >
              {audioUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {audioUploading ? "Uploading…" : "Add audio file"}
            </button>
          )}
          <input ref={audioInputRef} type="file" accept="audio/*,video/mp4" className="hidden" onChange={handleAudioChange} />
        </div>

        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)} className={`px-3 py-1.5 text-[12px] rounded-full border ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-7 mb-10">
        <button
          disabled={!caption.trim() || add.isPending || audioUploading}
          onClick={publish}
          className="w-full py-3.5 rounded-xl bg-foreground text-background text-[14px] disabled:opacity-50"
        >
          {add.isPending ? "Publishing…" : audioUploading ? "Uploading audio…" : "Publish reel"}
        </button>
      </div>
    </div>
  );
}
