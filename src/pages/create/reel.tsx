import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Video, Loader2, X } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadReelVideoFile } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

async function uploadCoverImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `covers/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

export default function CreateReel() {
  useTitle("Create reel");
  const [, setLocation] = useLocation();
  const [caption, setCaption] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const add = useAddPost();

  const pickGallery = () => videoInputRef.current?.click();
  const pickCamera = () => cameraInputRef.current?.click();

  const onVideoSelected = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("video/")) {
      toast.error("Choose a short vertical video (MP4 or WebM).");
      return;
    }
    const me = getCurrentUserId();
    if (!me) {
      toast.error("Sign in first");
      return;
    }
    const local = URL.createObjectURL(file);
    setVideoPreview(local);
    setVideoUploading(true);
    setVideoUrl(undefined);
    try {
      const url = await uploadReelVideoFile(me, file);
      setVideoUrl(url);
      toast.success("Video uploaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setVideoPreview(null);
    } finally {
      setVideoUploading(false);
    }
  };

  const onCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) return toast.error("Sign in first");
    setCoverUploading(true);
    try {
      const url = await uploadCoverImage(me, file);
      setCoverUrl(url);
    } catch {
      toast.error("Cover upload failed");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  };

  const publish = () => {
    if (!caption.trim()) return;
    const me = getCurrentUserId();
    if (!me) {
      setLocation("/auth/login");
      return;
    }
    if (!videoUrl) {
      toast.error("Add a video first");
      return;
    }
    add.mutate(
      {
        kind: "reel",
        authorId: me,
        title: caption.split(/[.!\n]/)[0]?.slice(0, 72) ?? "Reel",
        body: caption,
        videoUrl,
        coverUrl: coverUrl ?? "",
        language,
        tags: ["reel"],
      },
      {
        onSuccess: () => {
          toast.success("Published");
          setLocation("/");
        },
      },
    );
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col font-['Inter']">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <button type="button" onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Reel · video</span>
        <div className="w-9" />
      </div>

      <div className="px-5 pt-6 flex flex-col items-center gap-4">
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void onVideoSelected(e.target.files?.[0])} />
        <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void onVideoSelected(e.target.files?.[0])} />
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverSelected} />

        <div className="w-full max-w-[320px] aspect-[9/16] rounded-3xl overflow-hidden bg-black relative border border-border/60 shadow-xl">
          {videoPreview ? (
            <>
              <video src={videoPreview} className="w-full h-full object-cover" muted playsInline loop autoPlay />
              {videoUploading && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" size={28} />
                </div>
              )}
              <button
                type="button"
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                onClick={() => {
                  if (videoPreview.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
                  setVideoPreview(null);
                  setVideoUrl(undefined);
                }}
              >
                <X size={14} className="text-white" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Video size={36} className="text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground leading-relaxed">Vertical video — a calm moment, full-screen for readers.</p>
              <div className="flex flex-col gap-2 w-full">
                <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={pickGallery} className="w-full py-3 rounded-2xl bg-foreground text-background text-[14px] font-medium">
                  Choose video
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={pickCamera} className="w-full py-3 rounded-2xl border border-border text-[14px]">
                  Record
                </motion.button>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => coverInputRef.current?.click()} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          {coverUploading ? "Uploading cover…" : coverUrl ? "Replace thumbnail (optional)" : "Add custom thumbnail (optional)"}
        </button>
      </div>

      <div className="px-5 mt-6 space-y-4 flex-1">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Title or caption…"
          rows={4}
          className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-foreground/25 resize-none"
        />
        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLanguage(l)} className={`px-3 py-1.5 text-[12px] rounded-full border ${language === l ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-8">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={!caption.trim() || !videoUrl || add.isPending || videoUploading}
          onClick={publish}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-medium disabled:opacity-45"
        >
          {add.isPending ? "Publishing…" : "Publish reel"}
        </motion.button>
      </div>
    </div>
  );
}
