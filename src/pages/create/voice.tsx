import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mic, Square, Pause, Play, Trash2, Loader2, ImagePlus, X } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadAudio, uploadPostCoverImage } from "@/lib/store";
import { toast } from "sonner";

type Take = { id: string; durationSec: number; selected: boolean; audioUrl: string };

function getSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function VoiceTakePreview({ audioUrl, durationSec }: { audioUrl: string; durationSec: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(Math.max(0.1, durationSec || 0.1));

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDur(a.duration);
    };
    const onTime = () => setCurrent(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [audioUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
    setCurrent(0);
  }, [audioUrl]);

  const pct = dur > 0 ? (current / dur) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  };

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    a.currentTime = Math.max(0, Math.min(dur - 0.05, p * dur));
  };

  return (
    <div className="rounded-2xl border border-border/55 bg-card/85 backdrop-blur-[2px] p-4 mt-5 mx-6">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3 font-['Inter']">Listen before publish</div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="h-8 flex items-end gap-[2px] mb-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 max-w-[3px] rounded-full bg-foreground/22"
                style={{ height: `${24 + ((i * 13) % 62)}%`, opacity: playing ? 1 : 0.5 }}
              />
            ))}
          </div>
          <div className="h-[3px] rounded-full bg-border overflow-hidden cursor-pointer active:opacity-90" onClick={seek} role="slider" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-foreground/50 transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-['Inter'] tabular-nums">
            <span>{fmt(current)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateVoice() {
  useTitle("Record voice");
  const [, setLocation] = useLocation();
  const [recording, setRecording]   = useState(false);
  const [paused, setPaused]         = useState(false);
  const [seconds, setSeconds]       = useState(0);
  const [takes, setTakes]           = useState<Take[]>([]);
  const [title, setTitle]           = useState("");
  const [caption, setCaption]       = useState("");
  const [coverUrl, setCoverUrl]     = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [language, setLanguage]     = useState<"or" | "hi">("or");
  const [tipLock, setTipLock]       = useState(false);
  const [minTip, setMinTip]         = useState(10);
  const [uploading, setUploading]   = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const add = useAddPost();

  const selectedTake = takes.find((t) => t.selected) ?? takes[0];

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationRef = useRef(0);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { durationRef.current = seconds; }, [seconds]);

  useEffect(() => {
    if (!recording || paused) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [recording, paused]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const localChunks: Blob[] = [];
      chunksRef.current = localChunks;

      mr.ondataavailable = (e) => { if (e.data.size > 0) localChunks.push(e.data); };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const duration = durationRef.current;
        if (duration < 1) { setRecording(false); setPaused(false); setSeconds(0); return; }
        const finalMime = mr.mimeType || "audio/webm";
        const blob = new Blob(localChunks, { type: finalMime });
        const ext = finalMime.includes("ogg") ? "ogg" : finalMime.includes("mp4") ? "m4a" : "webm";
        const me = getCurrentUserId();
        if (!me) { toast.error("Sign in first"); setRecording(false); return; }
        setUploading(true);
        try {
          const url = await uploadAudio(me, blob, ext);
          setTakes((arr) => [...arr, { id: `tk${Date.now()}`, durationSec: duration, selected: arr.length === 0, audioUrl: url }]);
          toast.success("Take saved");
        } catch (err: any) {
          toast.error(`Upload failed: ${err.message}`);
        } finally {
          setUploading(false); setRecording(false); setPaused(false); setSeconds(0);
        }
      };
      mediaRef.current = mr;
      mr.start(250);
      setRecording(true);
      setSeconds(0);
    } catch (err: any) {
      toast.error(err.name === "NotAllowedError" ? "Microphone access denied" : `Mic error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (!mediaRef.current || mediaRef.current.state === "inactive") return;
    mediaRef.current.stop();
  };

  const togglePause = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    if (mr.state === "recording") { mr.pause(); setPaused(true); }
    else if (mr.state === "paused") { mr.resume(); setPaused(false); }
  };

  const selectTake = (id: string) => setTakes((arr) => arr.map((t) => ({ ...t, selected: t.id === id })));
  const deleteTake = (id: string) => setTakes((arr) => arr.filter((t) => t.id !== id));

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

  const removeCover = () => { setCoverUrl(null); setCoverPreview(null); };

  const publish = () => {
    const sel = takes.find((t) => t.selected) ?? takes[0];
    if (!sel || !title.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    add.mutate({
      kind: "voice", authorId: me, title: title.trim(), body: caption,
      audioUrl: sel.audioUrl, durationSec: sel.durationSec,
      coverUrl: coverUrl ?? "", language, tags: ["voice"],
      accessType: tipLock ? "tip" : "free",
      minTip: tipLock ? minTip : undefined,
    }, { onSuccess: () => { toast.success("Voice poem published!"); setLocation("/"); } });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <style>{`@keyframes vbar { 0%,100% { height: 14%; } 50% { height: 100%; } }`}</style>

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Voice poem</div>
        <div className="w-9" />
      </div>

      <div className="px-6 pb-3">
        <p className="text-center text-[13px] font-['Playfair_Display'] italic text-muted-foreground/90 leading-snug">
          Take a breath — then let the room hear you.
        </p>
      </div>
      {/* Mic visualizer */}
      <div className="px-6 mt-4">
        <div className="rounded-3xl p-8 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--wine)) 0%, #2A1018 100%)", color: "#F5F3EF" }}>
          <div className="font-['Playfair_Display'] text-[14px] italic opacity-80 mb-1">
            {uploading ? "uploading take…" : recording ? (paused ? "paused" : "listening") : "ready when you are"}
          </div>
          <div className="font-['Playfair_Display'] text-[44px] tracking-tight">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </div>
          <div className="flex items-end justify-center gap-[3px] h-16 mt-4">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="w-[4px] rounded"
                style={{ background: "linear-gradient(180deg,hsl(var(--ochre)),hsl(var(--terracotta)))", height: `${20 + ((i * 13) % 80)}%`, animation: recording && !paused ? `vbar 0.${(i % 7) + 4}s ease-in-out infinite` : "none" }} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            {!recording && !uploading && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={startRecording}
                className="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center text-white shadow-lg">
                <Mic size={22} />
              </motion.button>
            )}
            {uploading && (
              <div className="w-16 h-16 rounded-full border border-white/30 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-white/60" />
              </div>
            )}
            {recording && !uploading && (
              <>
                <button onClick={togglePause} className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center text-white">
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-white text-foreground flex items-center justify-center">
                  <Square size={20} fill="currentColor" />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Takes */}
      {takes.length > 0 && (
        <div className="px-6 mt-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Takes</div>
          <div className="space-y-2">
            {takes.map((t, i) => (
              <div key={t.id} onClick={() => selectTake(t.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${t.selected ? "border-terracotta bg-terracotta/5" : "border-border hover:border-border/80"}`}>
                <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-[12px] font-semibold">{i + 1}</div>
                <div className="flex-1 text-[13px] font-['Inter']">Take {i + 1} · {Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, "0")}</div>
                <button onClick={(e) => { e.stopPropagation(); deleteTake(t.id); }} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTake && (
        <VoiceTakePreview audioUrl={selectedTake.audioUrl} durationSec={selectedTake.durationSec} />
      )}

      {/* Meta */}
      <div className="px-6 mt-6 space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title" maxLength={120}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground font-['Playfair_Display'] outline-none focus:border-terracotta transition-colors" />
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption or opening lines…" rows={3} maxLength={500}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta resize-none transition-colors" />

        {/* Cover — custom upload only, no presets */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Cover (optional)</div>
          {coverPreview || coverUrl ? (
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
              <img src={coverPreview || coverUrl!} alt="" className="w-full h-full object-cover" />
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
              <button onClick={removeCover}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => coverInputRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-2 py-8 hover:border-terracotta hover:bg-terracotta/5 transition-all"
            >
              <ImagePlus size={22} className="text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground font-['Inter']">Add your own cover image</span>
              <span className="text-[10px] text-muted-foreground/60 font-['Inter']">or leave blank for a cinematic gradient</span>
            </motion.button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
        </div>

        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)}
              className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${language === l ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-[13px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={tipLock} onChange={(e) => setTipLock(e.target.checked)} className="rounded border-border" />
          Tip-to-listen (premium lock)
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
              className="w-24 bg-card border border-border rounded-xl px-3 py-2 outline-none focus:border-terracotta"
            />
          </div>
        ) : null}
      </div>

      <div className="px-6 mt-8 mb-10">
        <motion.button whileTap={{ scale: 0.98 }}
          disabled={!title.trim() || takes.length === 0 || add.isPending || uploading || uploadingCover}
          onClick={publish}
          className="w-full py-3.5 rounded-2xl bg-foreground text-background text-[14px] font-['Inter'] font-medium disabled:opacity-50 transition-opacity"
        >
          {add.isPending ? "Publishing…" : uploading ? "Uploading take…" : "Publish voice poem"}
        </motion.button>
      </div>
    </div>
  );
}
