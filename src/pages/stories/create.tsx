import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import { getCurrentUserId, uploadStoryMedia, useCreateStory } from "@/lib/store";
import { toast } from "sonner";
import { FEED_BG, FEED_BORDER, FEED_GOLD, FEED_MUTED, FEED_TEXT } from "@/components/feed/home-feed-ui";

export default function CreateStoryRing() {
  useTitle("Your Story");
  const [, setLocation] = useLocation();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateStory();

  const handleFile = async (file: File) => {
    const me = getCurrentUserId();
    if (!me) {
      toast.error("Sign in to share a story");
      setLocation("/auth/login");
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setUploading(true);
    try {
      const url = await uploadStoryMedia(me, file);
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      create.mutate({ mediaUrl: url, mediaType }, {
        onSuccess: () => setLocation("/"),
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(local);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <div className="px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={() => setLocation("/")} className="w-9 h-9 rounded-full flex items-center justify-center border" style={{ borderColor: FEED_BORDER }}>
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: FEED_MUTED }}>Your Story</div>
        <div className="w-9" />
      </div>

      <div className="px-5 flex-1 flex flex-col">
        <div className="font-['Playfair_Display'] text-[24px] mb-1">Share a moment</div>
        <p className="text-[12px] font-['Inter'] mb-6" style={{ color: FEED_MUTED }}>
          Photo or short clip — visible to followers for 24 hours, then it fades away.
        </p>

        {preview ? (
          <div className="relative rounded-2xl overflow-hidden aspect-[9/16] max-h-[420px] mx-auto w-full max-w-[280px]">
            <img src={preview} alt="" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                <Loader2 size={28} className="animate-spin text-white" />
              </div>
            )}
            {!uploading && (
              <button type="button" onClick={() => setPreview(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                <X size={16} className="text-white" />
              </button>
            )}
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 max-h-[320px] rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3 mx-auto w-full max-w-[280px]"
            style={{ borderColor: FEED_BORDER }}
          >
            <ImagePlus size={32} style={{ color: FEED_GOLD }} />
            <span className="text-[13px] font-['Inter']" style={{ color: FEED_MUTED }}>Tap to add photo or video</span>
          </motion.button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
    </div>
  );
}
