import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Hash, Upload, Loader2, X, ImagePlus } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadMediaFile } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

async function uploadCoverImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `covers/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

export default function CreateReel() {
  useTitle("Create reel");
  const [, setLocation] = useLocation();
  const [coverUrl, setCoverUrl]         = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [caption, setCaption]           = useState("");
  const [hashtags, setHashtags]         = useState("reel, ");
  const [language, setLanguage]         = useState<"or" | "hi">("or");
  const [audioFile, setAudioFile]       = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUrl, setAudioUrl]         = useState<string | undefined>(undefined);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const add = useAddPost();

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in first"); return; }
    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setUploadingCover(true);
    try {
      const url = await uploadCoverImage(me, file);
      setCoverUrl(url);
    } catch {
      toast.error("Cover upload failed");
      setCoverPreview(null);
    } finally {
      setUploadingCover(false);
      URL.revokeObjectURL(localUrl);
    }
  };

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

  const publish = () => {
    if (!caption.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    add.mutate({
      kind: "reel", authorId: me,
      title: caption.split(".")[0]?.slice(0, 60) ?? "Reel",
      body: caption,
      coverUrl: coverUrl ?? "",
      ...(audioUrl ? { audioUrl, durationSec: undefined } : {}),
      language,
      tags: hashtags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
    }, { onSuccess: () => { toast.success("Reel published!"); setLocation("/"); } });
  };

  const hasCover = coverPreview || coverUrl;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Reel</div>
        <div className="w-9" />
      </div>

      {/* Preview / Cover upload */}
      <div className="px-5 mt-3">
        {hasCover ? (
          <div className="relative rounded-3xl overflow-hidden mx-auto" style={{ aspectRatio: "4/5", width: "min(100%, 300px)" }}>
            <img src={coverPreview || coverUrl!} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.72) 80%, rgba(0,0,0,0.92) 100%)" }} />
            {uploadingCover && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="font-['Playfair_Display'] text-[18px] leading-tight italic line-clamp-3">
                {caption || "Your story here…"}
              </div>
            </div>
            {audioFile && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-white text-[10px] flex items-center gap-1 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.50)" }}>
                <Music size={10} /> {audioFile.name.slice(0, 16)}
              </div>
            )}
            <button onClick={() => { setCoverUrl(null); setCoverPreview(null); }}
              className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/55 flex items-center justify-center">
              <X size={13} className="text-white" />
            </button>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => coverInputRef.current?.click()}
            className="w-full rounded-3xl border border-dashed border-border flex flex-col items-center justify-center gap-3 py-16 hover:border-terracotta hover:bg-terracotta/5 transition-all mx-auto"
            style={{ maxWidth: 300 }}
          >
            <ImagePlus size={28} className="text-muted-foreground" />
            <div className="text-center">
              <div className="text-[13px] text-muted-foreground font-['Inter']">Add cover image</div>
              <div className="text-[11px] text-muted-foreground/60 font-['Inter'] mt-0.5">or leave blank for a gradient</div>
            </div>
          </motion.button>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
      </div>

      <div className="px-5 mt-5 space-y-3">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption or opening lines…" rows={3}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta resize-none transition-colors" />

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-3">
          <Hash size={14} className="text-muted-foreground" />
          <input value={hashtags} onChange={(e) => setHashtags(e.target.value)}
            placeholder="hashtags, comma separated"
            className="flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground" />
        </div>

        {/* Audio overlay */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Audio overlay (optional)</div>
          {audioFile ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-terracotta bg-terracotta/5">
              <Music size={15} className="text-terracotta shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground truncate">{audioFile.name}</div>
                {audioUploading && <div className="text-[11px] text-muted-foreground">Uploading…</div>}
                {!audioUploading && audioUrl && <div className="text-[11px] text-sage">Uploaded ✓</div>}
              </div>
              <button onClick={() => { setAudioFile(null); setAudioUrl(undefined); }} className="text-muted-foreground shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => audioInputRef.current?.click()} disabled={audioUploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50">
              {audioUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {audioUploading ? "Uploading…" : "Add audio file"}
            </button>
          )}
          <input ref={audioInputRef} type="file" accept="audio/*,video/mp4" className="hidden" onChange={handleAudioChange} />
        </div>

        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)}
              className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${language === l ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-7 mb-10">
        <motion.button whileTap={{ scale: 0.98 }}
          disabled={!caption.trim() || add.isPending || audioUploading || uploadingCover}
          onClick={publish}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-['Inter'] font-medium disabled:opacity-50">
          {add.isPending ? "Publishing…" : audioUploading ? "Uploading audio…" : "Publish reel"}
        </motion.button>
      </div>
    </div>
  );
}
