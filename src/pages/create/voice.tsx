import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mic, Square, Pause, Play, Trash2, Loader2 } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadAudio } from "@/lib/store";
import { toast } from "sonner";

const COVERS = [
  "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
  "https://images.unsplash.com/photo-1473445361085-b9a07f55608b?w=800",
];

type Take = { id: string; durationSec: number; selected: boolean; audioUrl: string };

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function CreateVoice() {
  useTitle("Record voice");
  const [, setLocation] = useLocation();
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [cover, setCover] = useState(COVERS[0]);
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [uploading, setUploading] = useState(false);
  const add = useAddPost();

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationRef = useRef(0);

  // Keep durationRef in sync so onstop can read the accurate value
  useEffect(() => { durationRef.current = seconds; }, [seconds]);

  useEffect(() => {
    if (!recording || paused) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [recording, paused]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const localChunks: Blob[] = [];
      chunksRef.current = localChunks;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) localChunks.push(e.data);
      };

      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const duration = durationRef.current;
        if (duration < 1) {
          setRecording(false); setPaused(false); setSeconds(0);
          return;
        }
        const finalMime = mr.mimeType || "audio/webm";
        const blob = new Blob(localChunks, { type: finalMime });
        const ext = finalMime.includes("ogg") ? "ogg" : finalMime.includes("mp4") ? "m4a" : "webm";

        const me = getCurrentUserId();
        if (!me) { toast.error("Sign in first"); setRecording(false); return; }

        setUploading(true);
        try {
          const url = await uploadAudio(me, blob, ext);
          const takeId = `tk${Date.now()}`;
          setTakes((arr) => [
            ...arr,
            { id: takeId, durationSec: duration, selected: arr.length === 0, audioUrl: url },
          ]);
          toast.success("Take saved");
        } catch (err: any) {
          console.error("[voice] upload failed", err);
          toast.error(`Upload failed: ${err.message}`);
        } finally {
          setUploading(false);
          setRecording(false); setPaused(false); setSeconds(0);
        }
      };

      mediaRef.current = mr;
      mr.start(250);
      setRecording(true);
      setSeconds(0);
    } catch (err: any) {
      const msg = err.name === "NotAllowedError" ? "Microphone access denied" : `Mic error: ${err.message}`;
      toast.error(msg);
    }
  };

  const stopRecording = () => {
    if (!mediaRef.current || mediaRef.current.state === "inactive") return;
    mediaRef.current.stop();
  };

  const togglePause = () => {
    const mr = mediaRef.current;
    if (!mr) return;
    if (mr.state === "recording") {
      mr.pause();
      setPaused(true);
    } else if (mr.state === "paused") {
      mr.resume();
      setPaused(false);
    }
  };

  const selectTake = (id: string) => setTakes((arr) => arr.map((t) => ({ ...t, selected: t.id === id })));
  const deleteTake = (id: string) => setTakes((arr) => arr.filter((t) => t.id !== id));

  const publish = () => {
    const sel = takes.find((t) => t.selected) ?? takes[0];
    if (!sel || !title.trim()) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to publish"); setLocation("/auth/login"); return; }
    add.mutate({
      kind: "voice", authorId: me, title: title.trim(), body: caption,
      audioUrl: sel.audioUrl, durationSec: sel.durationSec,
      coverUrl: cover, language, tags: ["voice"],
    }, { onSuccess: () => { toast.success("Voice poem published!"); setLocation("/"); } });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <style>{`@keyframes vbar { 0%,100% { height: 14%; } 50% { height: 100%; } }`}</style>
      <div className="px-5 py-3 flex items-center justify-between">
        <Link href="/create" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Voice poem</div>
        <div className="w-9" />
      </div>

      {/* Mic visualizer */}
      <div className="px-6 mt-4">
        <div className="rounded-3xl p-8 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--wine)) 0%, #2A1018 100%)", color: "hsl(var(--background))" }}>
          <div className="font-['Playfair_Display'] text-[14px] italic opacity-80 mb-1">
            {uploading ? "uploading take…" : recording ? (paused ? "paused" : "listening") : "ready when you are"}
          </div>
          <div className="font-['Playfair_Display'] text-[44px] tracking-tight">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
          <div className="flex items-end justify-center gap-[3px] h-16 mt-4">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="w-[4px] rounded" style={{ background: "linear-gradient(180deg, hsl(var(--ochre)), hsl(var(--terracotta)))", height: `${20 + ((i * 13) % 80)}%`, animation: recording && !paused ? `vbar 0.${(i % 7) + 4}s ease-in-out infinite` : "none" }} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            {!recording && !uploading && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={startRecording} className="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center text-white shadow-lg">
                <Mic size={22} />
              </motion.button>
            )}
            {uploading && (
              <div className="w-16 h-16 rounded-full border border-white/30 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}
            {recording && !uploading && (
              <>
                <button onClick={togglePause} className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={stopRecording} className="w-16 h-16 rounded-full bg-white text-foreground flex items-center justify-center">
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
              <div key={t.id} onClick={() => selectTake(t.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${t.selected ? "border-terracotta bg-terracotta/5" : "border-border"}`}>
                <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-[12px]">{i + 1}</div>
                <div className="flex-1 text-[13px]">Take {i + 1} · {Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, "0")}</div>
                <audio src={t.audioUrl} className="hidden" preload="none" />
                <button onClick={(e) => { e.stopPropagation(); deleteTake(t.id); }} className="text-muted-foreground"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="px-6 mt-6 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground font-['Playfair_Display'] outline-none focus:border-terracotta" />
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption / first lines" rows={3} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-terracotta resize-none" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Cover</div>
          <div className="grid grid-cols-4 gap-2">
            {COVERS.map((c) => (
              <button key={c} onClick={() => setCover(c)} className={`aspect-square rounded-xl overflow-hidden border-2 ${cover === c ? "border-terracotta" : "border-transparent"}`}>
                <img src={c} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {(["or", "hi"] as const).map((l) => (
            <button key={l} onClick={() => setLanguage(l)} className={`px-3 py-1.5 text-[12px] rounded-full border ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
              {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-7 mb-10">
        <button
          disabled={!title.trim() || takes.length === 0 || add.isPending || uploading}
          onClick={publish}
          className="w-full py-3.5 rounded-xl bg-foreground text-background text-[14px] disabled:opacity-50"
        >
          {add.isPending ? "Publishing…" : uploading ? "Uploading take…" : "Publish voice poem"}
        </button>
      </div>
    </div>
  );
}
