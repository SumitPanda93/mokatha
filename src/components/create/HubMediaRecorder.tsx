import { useEffect, useRef, useState } from "react";
import { Mic, Video, Square, Pause, Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getCurrentUserId, uploadAudio, uploadReelVideoFile } from "@/lib/store";
import { FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_TEXT } from "@/components/feed/home-feed-ui";
import { toast } from "sonner";

type Props = {
  mode: "voice" | "video";
  onVoiceReady: (url: string, durationSec: number) => void;
  onVideoReady: (url: string) => void;
};

function getAudioMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function getVideoMime(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function HubMediaRecorder({ mode, onVoiceReady, onVideoReady }: Props) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { durationRef.current = seconds; }, [seconds]);

  useEffect(() => {
    if (!recording || paused) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [recording, paused]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    try {
      const constraints = mode === "video" ? { audio: true, video: { facingMode: "user" } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (mode === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        void videoPreviewRef.current.play().catch(() => {});
      }
      const mime = mode === "video" ? getVideoMime() : getAudioMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        const duration = durationRef.current;
        const finalMime = mr.mimeType || (mode === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunks, { type: finalMime });
        const me = getCurrentUserId();
        if (!me) { toast.error("Sign in first"); return; }
        setUploading(true);
        try {
          if (mode === "voice") {
            if (duration < 1) { toast.error("Record at least 1 second"); return; }
            const ext = finalMime.includes("ogg") ? "ogg" : finalMime.includes("mp4") ? "m4a" : "webm";
            const url = await uploadAudio(me, blob, ext);
            onVoiceReady(url, duration);
            toast.success("Voice clip saved");
          } else {
            const file = new File([blob], `hub-reel.${finalMime.includes("mp4") ? "mp4" : "webm"}`, { type: finalMime });
            const url = await uploadReelVideoFile(me, file);
            setPreviewUrl(url);
            onVideoReady(url);
            toast.success("Video saved");
          }
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading(false);
          setRecording(false);
          setPaused(false);
          setSeconds(0);
        }
      };
      mediaRef.current = mr;
      mr.start(250);
      setRecording(true);
      setSeconds(0);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      toast.error(e.name === "NotAllowedError" ? "Camera/mic access denied" : e.message ?? "Media error");
    }
  };

  const stop = () => {
    if (mediaRef.current?.state !== "inactive") mediaRef.current?.stop();
  };

  const togglePause = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    if (mr.state === "recording") { mr.pause(); setPaused(true); }
    else if (mr.state === "paused") { mr.resume(); setPaused(false); }
  };

  const fmt = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl p-4" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
      <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-3" style={{ color: FEED_MUTED }}>
        Record {mode === "voice" ? "voice" : "video"} here
      </div>
      {mode === "video" && (
        <div className="aspect-[9/16] max-h-[220px] mx-auto rounded-xl overflow-hidden bg-black mb-3 relative">
          <video ref={videoPreviewRef} className="w-full h-full object-cover" muted playsInline />
          {previewUrl && !recording && (
            <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay loop />
          )}
        </div>
      )}
      <div className="text-center font-['Playfair_Display'] text-[28px] tabular-nums mb-3" style={{ color: FEED_TEXT }}>
        {uploading ? "…" : fmt}
      </div>
      <div className="flex items-center justify-center gap-3">
        {!recording && !uploading && (
          <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => void start()}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white"
            style={{ background: FEED_GOLD }}>
            {mode === "voice" ? <Mic size={20} /> : <Video size={20} />}
          </motion.button>
        )}
        {uploading && <Loader2 size={24} className="animate-spin" style={{ color: FEED_GOLD }} />}
        {recording && !uploading && (
          <>
            <button type="button" onClick={togglePause} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ border: `1px solid ${FEED_BORDER}` }}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={stop}
              className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
              <Square size={18} fill="currentColor" />
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}
