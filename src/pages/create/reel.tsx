import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Video, Loader2, X } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadReelVideoFile, getAdminConfig, uploadReelPosterJpeg, useAdminConfig } from "@/lib/store";
import { consumeCreateDraft, type CreateDraft, type CreateVisibility } from "@/lib/createDraft";
import { toast } from "sonner";

const MIN_REEL_SEG = 0.35;

/** Keep trim segment within [MIN_REEL_SEG, maxSeg] and inside [0, dur]. */
function clampReelTrim(start: number, end: number, dur: number, maxSeg: number): { ts: number; te: number } {
  const maxSegSafe = Math.max(MIN_REEL_SEG, maxSeg);
  let te = Math.min(dur, end);
  let ts = Math.max(0, start);
  if (te - ts < MIN_REEL_SEG) te = Math.min(dur, ts + MIN_REEL_SEG);
  if (te - ts > maxSegSafe) {
    te = Math.min(dur, ts + maxSegSafe);
    if (te - ts < MIN_REEL_SEG) {
      ts = Math.max(0, dur - MIN_REEL_SEG);
      te = Math.min(dur, ts + maxSegSafe);
    }
  }
  if (ts > te - MIN_REEL_SEG) ts = Math.max(0, te - MIN_REEL_SEG);
  return { ts, te };
}

async function capturePosterFromVideoUrl(videoUrl: string, atSec: number, posterWidthPx: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.src = videoUrl;
    const done = (blob: Blob | null) => {
      try {
        v.removeAttribute("src");
        v.load();
      } catch {
        /* ignore */
      }
      resolve(blob);
    };
    const fail = () => done(null);
    v.onerror = fail;
    v.onloadeddata = () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
      const t = Math.min(Math.max(0, atSec), Math.max(0.05, dur - 0.04));
      v.currentTime = t;
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) return done(null);
        const canvas = document.createElement("canvas");
        const tw = Math.max(320, Math.min(4096, Math.round(posterWidthPx)));
        const th = Math.round((h / w) * tw);
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(v, 0, 0, tw, th);
        canvas.toBlob((b) => done(b), "image/jpeg", 0.82);
      } catch {
        done(null);
      }
    };
  });
}

export default function CreateReel() {
  useTitle("Create reel");
  const [, setLocation] = useLocation();
  const [caption, setCaption] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();

  const [mediaDuration, setMediaDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [tipLock, setTipLock] = useState(false);
  const [minTip, setMinTip] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [visibility, setVisibility] = useState<CreateVisibility>("public");
  const [hubDraft, setHubDraft] = useState<CreateDraft | null>(null);

  const add = useAddPost();
  const { data: adminCfg } = useAdminConfig();
  const reelMaxSec = adminCfg?.reel_max_duration_sec ?? 120;

  useEffect(() => {
    const draft = consumeCreateDraft("video");
    if (!draft) return;
    const parts = [draft.title, draft.body].filter(Boolean);
    if (parts.length) setCaption(parts.join("\n\n"));
    if (draft.accessType === "tip") {
      setTipLock(true);
      if (draft.minTip) setMinTip(draft.minTip);
    }
    if (draft.isPrivate) setIsPrivate(true);
    if (draft.visibility) setVisibility(draft.visibility);
    setHubDraft(draft);
  }, []);

  const trimRef = useRef({ start: 0, end: 0 });
  useEffect(() => {
    trimRef.current = { start: trimStart, end: trimEnd };
  }, [trimStart, trimEnd]);

  useEffect(() => {
    if (mediaDuration <= 0) return;
    const { start: s, end: e } = trimRef.current;
    const { ts, te } = clampReelTrim(s, e, mediaDuration, reelMaxSec);
    if (Math.abs(ts - s) > 0.02 || Math.abs(te - e) > 0.02) {
      setTrimStart(ts);
      setTrimEnd(te);
    }
  }, [mediaDuration, reelMaxSec]);

  const pickGallery = () => videoInputRef.current?.click();
  const pickCamera = () => cameraInputRef.current?.click();

  useEffect(() => {
    const pv = previewVideoRef.current;
    if (!pv || !videoPreview || mediaDuration <= 0) return;
    const start = Math.min(trimStart, trimEnd - MIN_REEL_SEG);
    const end = Math.max(trimEnd, start + MIN_REEL_SEG);
    const onTime = () => {
      if (pv.currentTime >= end - 0.06) pv.currentTime = start;
    };
    pv.addEventListener("timeupdate", onTime);
    return () => pv.removeEventListener("timeupdate", onTime);
  }, [videoPreview, mediaDuration, trimStart, trimEnd]);

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
    setMediaDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
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

  const publish = async () => {
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
    const cfg = await getAdminConfig();
    const maxSec = cfg.reel_max_duration_sec;
    const clipLen = trimEnd - trimStart;
    if (clipLen > maxSec + 0.05) {
      toast.error(`Reel clip must be ${maxSec}s or shorter. Tighten the trim handles.`);
      return;
    }
    let coverUrl = "";
    try {
      const blob = await capturePosterFromVideoUrl(videoUrl, trimStart, cfg.reel_poster_width_px);
      if (blob) coverUrl = await uploadReelPosterJpeg(me, blob);
    } catch {
      /* poster optional */
    }
    const tags = ["reel"] as string[];
    if (mediaDuration > 0.5 && trimEnd - trimStart >= MIN_REEL_SEG && trimEnd <= mediaDuration + 0.01) {
      tags.push(`trim:${trimStart.toFixed(2)}:${trimEnd.toFixed(2)}`);
    }
    add.mutate(
      {
        kind: "reel",
        authorId: me,
        title: caption.split(/[.!\n]/)[0]?.slice(0, 72) ?? "Reel",
        body: caption,
        videoUrl,
        coverUrl,
        language,
        tags,
        accessType: tipLock ? "tip" : "free",
        minTip: tipLock ? minTip : undefined,
        visibility: visibility ?? (isPrivate ? "private" : "public"),
        isPrivate: visibility === "private" || isPrivate || undefined,
        scheduledAt: hubDraft?.scheduledAt,
        backgroundTheme: hubDraft?.backgroundTheme,
        location: hubDraft?.location,
        poll: hubDraft?.poll,
        taggedUserIds: hubDraft?.taggedUserIds,
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

        <div className="w-full max-w-[320px] aspect-[9/16] rounded-3xl overflow-hidden bg-black relative border border-border/60 shadow-xl">
          {videoPreview ? (
            <>
              <video
                ref={previewVideoRef}
                src={videoPreview}
                className="w-full h-full object-cover"
                muted
                playsInline
                loop
                autoPlay
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) {
                    setMediaDuration(d);
                    const maxSeg = reelMaxSec;
                    const { ts, te } = clampReelTrim(0, Math.min(d, maxSeg), d, maxSeg);
                    setTrimStart(ts);
                    setTrimEnd(te);
                  }
                }}
              />
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
                  setMediaDuration(0);
                }}
              >
                <X size={14} className="text-white" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Video size={36} className="text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground leading-relaxed">Vertical video — full-screen for readers. Poster is captured from your clip automatically.</p>
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

        {videoPreview && mediaDuration > 0.8 && (
          <div className="w-full max-w-[320px] space-y-2">
            <div className="text-[11px] text-muted-foreground flex justify-between gap-2">
              <span>
                Clip · {(trimEnd - trimStart).toFixed(1)}s · max {reelMaxSec}s
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">Trim · start {trimStart.toFixed(1)}s</div>
            <input
              type="range"
              min={Math.max(0, trimEnd - reelMaxSec)}
              max={Math.max(MIN_REEL_SEG, trimEnd - MIN_REEL_SEG)}
              step={0.05}
              value={Math.min(Math.max(trimStart, Math.max(0, trimEnd - reelMaxSec)), trimEnd - MIN_REEL_SEG)}
              onChange={(e) => {
                const v = Number(e.target.value);
                const { ts, te } = clampReelTrim(v, trimEnd, mediaDuration, reelMaxSec);
                setTrimStart(ts);
                setTrimEnd(te);
              }}
              className="w-full accent-foreground"
            />
            <div className="text-[11px] text-muted-foreground">Trim · end {trimEnd.toFixed(1)}s</div>
            <input
              type="range"
              min={trimStart + MIN_REEL_SEG}
              max={Math.min(mediaDuration, trimStart + reelMaxSec)}
              step={0.05}
              value={Math.min(Math.max(trimEnd, trimStart + MIN_REEL_SEG), Math.min(mediaDuration, trimStart + reelMaxSec))}
              onChange={(e) => {
                const v = Number(e.target.value);
                const { ts, te } = clampReelTrim(trimStart, v, mediaDuration, reelMaxSec);
                setTrimStart(ts);
                setTrimEnd(te);
              }}
              className="w-full accent-foreground"
            />
          </div>
        )}
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
        <label className="flex items-center gap-3 text-[13px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={tipLock} onChange={(e) => setTipLock(e.target.checked)} className="rounded border-border" />
          Tip-to-watch (premium lock)
        </label>
        {tipLock ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Min tip ₹</span>
            <input
              type="number"
              min={10}
              max={5000}
              value={minTip}
              onChange={(e) => setMinTip(Number(e.target.value) || 10)}
              className="w-24 bg-card border border-border rounded-xl px-3 py-2 outline-none"
            />
          </div>
        ) : null}
      </div>

      <div className="px-5 py-8">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={!caption.trim() || !videoUrl || add.isPending || videoUploading}
          onClick={() => void publish()}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-medium disabled:opacity-45"
        >
          {add.isPending ? "Publishing…" : "Publish reel"}
        </motion.button>
      </div>
    </div>
  );
}
