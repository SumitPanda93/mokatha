/**
 * AudioLetterRecorder — lightweight private voice appreciation letter.
 * Max 30 seconds. Records, previews, sends.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Send, X, Play, Pause, RotateCcw } from "lucide-react";
import { useSendAudioLetter, uploadAudioLetter, getCurrentUserId } from "@/lib/store";

const MAX_SEC = 30;

const FMT = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface Props {
  toUserId: string;
  toUserName: string;
  onClose: () => void;
}

type Phase = "idle" | "recording" | "preview" | "sending" | "done";

export default function AudioLetterRecorder({ toUserId, toUserName, onClose }: Props) {
  const me = getCurrentUserId();
  const sendLetter = useSendAudioLetter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    timerRef.current && clearInterval(timerRef.current);
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    audioRef.current?.pause();
    previewUrl && URL.revokeObjectURL(previewUrl);
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setPreviewUrl(url);
        setPhase("preview");
      };
      mr.start();
      recorderRef.current = mr;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_SEC) {
            stopRecording();
            return MAX_SEC;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone and try again.");
    }
  };

  const stopRecording = () => {
    timerRef.current && clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const togglePreviewPlay = () => {
    if (!previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const reset = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    previewUrl && URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setPlaying(false);
    setElapsed(0);
    setPhase("idle");
  };

  const handleSend = async () => {
    if (!blob || !me) return;
    setPhase("sending");
    try {
      const url = await uploadAudioLetter(me, blob);
      await sendLetter.mutateAsync({
        toUserId, audioUrl: url, durationSec: elapsed, body: note.trim() || undefined,
      });
      setPhase("done");
      setTimeout(onClose, 1800);
    } catch (e: any) {
      setError(e.message ?? "Could not send");
      setPhase("preview");
    }
  };

  const progressPct = elapsed / MAX_SEC;

  return (
    <AnimatePresence>
      <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <motion.div key="sheet"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] overflow-hidden"
        style={{ background: "#0F0A06", maxWidth: 480, margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button onClick={onClose} className="absolute top-4 right-5 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)" }}>
          <X size={14} style={{ color: "rgba(245,243,239,0.55)" }} />
        </button>

        <div className="px-6 pt-2 pb-10">
          {/* Header */}
          <div className="mb-6">
            <div className="text-[10px] tracking-[0.28em] uppercase mb-1.5"
              style={{ color: "rgba(201,168,76,0.55)" }}>Voice letter</div>
            <div className="font-['Playfair_Display'] text-[22px]" style={{ color: "#F5F3EF" }}>
              A letter for{" "}
              <span className="italic"
                style={{ background: "linear-gradient(90deg,#C9A84C,#F76A4A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {toUserName}
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: "rgba(245,243,239,0.30)" }}>
              Max 30 seconds · Only they will hear it
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-xl text-[12px]"
              style={{ background: "rgba(247,106,74,0.12)", color: "#F76A4A", border: "1px solid rgba(247,106,74,0.25)" }}>
              {error}
            </div>
          )}

          {/* Done state */}
          {phase === "done" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#C9A84C,#F76A4A)" }}>
                <Send size={24} color="#0F0A06" />
              </motion.div>
              <div className="font-['Playfair_Display'] text-[18px] italic" style={{ color: "#F5F3EF" }}>
                Voice letter delivered
              </div>
            </div>
          )}

          {/* Idle — start recording */}
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="text-[12px] text-center" style={{ color: "rgba(245,243,239,0.35)" }}>
                Hold to record your voice — they'll cherish every word.
              </div>
              <motion.button whileTap={{ scale: 0.94 }} onClick={startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.20),rgba(247,106,74,0.18))", border: "1.5px solid rgba(201,168,76,0.40)" }}>
                <Mic size={30} style={{ color: "#C9A84C" }} />
              </motion.button>
              <div className="text-[10px] tracking-[0.18em] uppercase" style={{ color: "rgba(201,168,76,0.40)" }}>
                Tap to start
              </div>
            </div>
          )}

          {/* Recording */}
          {phase === "recording" && (
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Waveform bars */}
              <div className="flex items-end gap-[3px] h-10">
                {Array.from({ length: 18 }).map((_, i) => (
                  <motion.div key={i} className="w-[3px] rounded-full"
                    style={{ background: "#F76A4A" }}
                    animate={{ height: ["20%", "80%", "40%", "100%", "25%"][i % 5] + "" }}
                    transition={{ duration: 0.4 + (i % 3) * 0.15, repeat: Infinity, repeatType: "mirror", delay: i * 0.04 }}
                  />
                ))}
              </div>

              {/* Progress ring */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle cx="40" cy="40" r="36"
                    stroke="#F76A4A" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - progressPct)}`}
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span className="text-[15px] font-['Inter'] font-semibold" style={{ color: "#F5F3EF" }}>
                  {FMT(elapsed)}
                </span>
              </div>

              <motion.button whileTap={{ scale: 0.95 }} onClick={stopRecording}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "#F76A4A" }}>
                <Square size={18} fill="#0F0A06" color="#0F0A06" />
              </motion.button>
              <div className="text-[11px]" style={{ color: "rgba(245,243,239,0.35)" }}>Tap to stop</div>
            </div>
          )}

          {/* Preview */}
          {phase === "preview" && (
            <div className="flex flex-col gap-5">
              {/* Playback */}
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <motion.button whileTap={{ scale: 0.94 }} onClick={togglePreviewPlay}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(201,168,76,0.18)", border: "1px solid rgba(201,168,76,0.35)" }}>
                  {playing ? <Pause size={16} style={{ color: "#C9A84C" }} /> : <Play size={16} style={{ color: "#C9A84C" }} />}
                </motion.button>
                <div className="flex-1">
                  <div className="text-[12px] font-['Inter']" style={{ color: "#F5F3EF" }}>Voice letter · {FMT(elapsed)}</div>
                  <div className="h-1 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.10)" }}>
                    <div className="h-full rounded-full" style={{ width: "100%", background: "rgba(201,168,76,0.50)" }} />
                  </div>
                </div>
                <button onClick={reset} className="shrink-0 opacity-50 hover:opacity-80 transition-opacity">
                  <RotateCcw size={14} style={{ color: "#F5F3EF" }} />
                </button>
              </div>

              {/* Optional note */}
              <div>
                <div className="text-[9px] tracking-[0.28em] uppercase mb-2"
                  style={{ color: "rgba(201,168,76,0.45)" }}>Add a note (optional)</div>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="A line to go with your voice…"
                  className="w-full rounded-xl px-4 py-3 text-[13px] font-['Playfair_Display'] italic outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#F5F3EF" }}
                />
              </div>

              {/* Send */}
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleSend}
                disabled={sendLetter.isPending}
                className="w-full py-4 rounded-2xl text-[14px] font-['Inter'] font-medium"
                style={{
                  background: "linear-gradient(135deg,#C9A84C 0%,#E09060 55%,#F76A4A 100%)",
                  color: "#0F0A06",
                  boxShadow: "0 6px 24px rgba(201,168,76,0.22)",
                }}>
                <span className="flex items-center justify-center gap-2">
                  <Send size={15} />
                  Let your voice stay
                </span>
              </motion.button>
            </div>
          )}

          {phase === "sending" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
              <div className="text-[13px] font-['Playfair_Display'] italic" style={{ color: "rgba(245,243,239,0.55)" }}>
                Sending your voice…
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
