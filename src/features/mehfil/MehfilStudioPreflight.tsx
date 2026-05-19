/**
 * Studio Mehfil device gate — camera preview, mic meter, loopback, permissions.
 * Shown after "Prepare Mehfil" for sessionMode studio before entering the room.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Mic, MicOff, Video, VideoOff, Volume2, AlertCircle } from "lucide-react";

const IVORY = "#f5f3ef";
const GOLD = "#c9a84c";
const MINT = "#6be89e";
const BG = "#0a0609";

export type StudioPreflightSnapshot = {
  cameraOk: boolean;
  micOk: boolean;
  permissionsOk: boolean;
  audioUnlocked: boolean;
};

type Props = {
  mehfilTitle: string;
  onBack: () => void;
  /** Pass live preflight stream into session context — do not stop tracks before navigate. */
  onEnter: (stream: MediaStream) => void;
};

export function MehfilStudioPreflight({ mehfilTitle, onBack, onEnter }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopbackRef = useRef<{ ctx: AudioContext; src: MediaStreamAudioSourceNode } | null>(null);
  /** When true, unmount cleanup must not stop tracks (handed off to MehfilMediaContext). */
  const transferredRef = useRef(false);

  const [phase, setPhase] = useState<"checking" | "ready" | "blocked">("checking");
  const [cameraDetected, setCameraDetected] = useState(false);
  const [micDetected, setMicDetected] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [micStreamActive, setMicStreamActive] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [loopbackOn, setLoopbackOn] = useState(false);
  const [meter, setMeter] = useState(0);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const canEnter =
    cameraStreamActive &&
    micStreamActive &&
    permissionsGranted &&
    audioUnlocked &&
    phase !== "blocked";

  const stopLoopback = useCallback(() => {
    if (loopbackRef.current) {
      try {
        loopbackRef.current.src.disconnect();
        void loopbackRef.current.ctx.close();
      } catch {
        /* ignore */
      }
      loopbackRef.current = null;
    }
    setLoopbackOn(false);
  }, []);

  const stopAll = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    stopLoopback();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoopback]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPhase("checking");
      setBlockReason(null);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        const mics = devices.filter((d) => d.kind === "audioinput");
        if (cancelled) return;
        setCameraDetected(cams.length > 0);
        setMicDetected(mics.length > 0);
        if (!cams.length || !mics.length) {
          setPhase("blocked");
          setBlockReason(!cams.length && !mics.length
            ? "No camera or microphone found on this device."
            : !cams.length
              ? "No camera detected — Studio Mehfil needs video."
              : "No microphone detected — listeners need your voice.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermissionsGranted(true);
        setCameraStreamActive(stream.getVideoTracks().some((t) => t.readyState === "live"));
        setMicStreamActive(stream.getAudioTracks().some((t) => t.readyState === "live"));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const src = ctx.createMediaStreamSource(stream);
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (cancelled || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          setMeter(avg);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        setPermissionsGranted(false);
        setPhase("blocked");
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setBlockReason("Camera and microphone access are required. Allow permissions in your browser settings, then try again.");
        } else if (name === "NotFoundError") {
          setBlockReason("We couldn't find a usable camera or microphone.");
        } else {
          setBlockReason(e instanceof Error ? e.message : "Could not access media devices.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (!transferredRef.current) stopAll();
    };
  }, [stopAll]);

  const unlockAudio = useCallback(async () => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      setAudioUnlocked(ctx.state === "running");
    } catch {
      setAudioUnlocked(false);
    }
  }, []);

  const toggleLoopback = useCallback(async () => {
    if (loopbackOn) {
      stopLoopback();
      return;
    }
    const stream = streamRef.current;
    if (!stream) return;
    await unlockAudio();
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      src.connect(ctx.destination);
      loopbackRef.current = { ctx, src };
      setLoopbackOn(true);
      setAudioUnlocked(true);
    } catch {
      setBlockReason("Could not enable loopback audio.");
    }
  }, [loopbackOn, stopLoopback, unlockAudio]);

  return (
    <motion.div
      className="min-h-[100dvh] flex flex-col font-['Inter']"
      style={{ background: BG, color: IVORY }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className="px-5 pt-[max(14px,env(safe-area-inset-top))] pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            stopAll();
            onBack();
          }}
          className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={20} className="opacity-80" />
        </button>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex-1 min-w-0"
        >
          <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "rgba(212,184,120,0.55)" }}>
            Studio check
          </p>
          <h1 className="font-['Playfair_Display'] text-[20px] truncate leading-tight mt-0.5">{mehfilTitle}</h1>
        </motion.div>
      </header>

      <div className="flex-1 flex flex-col items-center px-5 gap-6 pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[340px] rounded-[28px] overflow-hidden border border-white/[0.1] bg-[#120e14] shadow-[0_32px_90px_rgba(0,0,0,0.55)]"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative aspect-[9/16] max-h-[42vh] bg-black"
          >
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            {phase === "checking" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50"
              >
                <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${GOLD}66`, borderTopColor: "transparent" }} />
              </motion.div>
            )}
            {phase === "blocked" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-black/72"
              >
                <AlertCircle size={28} className="text-rose-300/90" />
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,243,239,0.72)" }}>{blockReason}</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="w-full max-w-[340px] space-y-4"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <div className="flex items-end justify-center gap-[3px] h-8 flex-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-[2px] rounded-full origin-bottom"
                  style={{
                    background: meter > 0.04 ? `linear-gradient(to top, ${GOLD}, ${MINT})` : "rgba(201,168,76,0.15)",
                  }}
                  animate={{ height: 6 + meter * 28 * ([0.6, 1, 0.75, 0.9, 0.55][i % 5] ?? 1) }}
                  transition={{ duration: 0.08 }}
                />
              ))}
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] shrink-0" style={{ color: "rgba(245,243,239,0.38)" }}>Mic</span>
          </div>

          <ul className="space-y-2 text-[12px]">
            <StatusRow ok={cameraDetected} label="Camera detected" icon={cameraDetected ? <Video size={14} /> : <VideoOff size={14} />} />
            <StatusRow ok={micDetected} label="Microphone detected" icon={micDetected ? <Mic size={14} /> : <MicOff size={14} />} />
            <StatusRow ok={permissionsGranted} label="Permissions granted" />
            <StatusRow ok={cameraStreamActive} label="Camera stream active" />
            <StatusRow ok={micStreamActive} label="Microphone stream active" />
            <StatusRow ok={audioUnlocked} label="Audio context unlocked" />
          </ul>

          <div className="flex flex-col gap-2">
            {!audioUnlocked && (
              <button
                type="button"
                onClick={() => void unlockAudio()}
                className="w-full py-3 rounded-full text-[13px] border border-white/[0.1] bg-white/[0.05]"
              >
                Unlock audio
              </button>
            )}
            <button
              type="button"
              disabled={!micStreamActive || phase === "blocked"}
              onClick={() => void toggleLoopback()}
              className="w-full py-3 rounded-full text-[13px] border flex items-center justify-center gap-2"
              style={{
                borderColor: loopbackOn ? "rgba(107,232,158,0.35)" : "rgba(255,255,255,0.1)",
                background: loopbackOn ? "rgba(107,232,158,0.08)" : "rgba(255,255,255,0.04)",
                opacity: !micStreamActive ? 0.45 : 1,
              }}
            >
              <Volume2 size={15} />
              {loopbackOn ? "Stop hearing yourself" : "Hear yourself"}
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black via-black/90 to-transparent"
      >
        <div className="max-w-[340px] mx-auto space-y-2">
          <motion.button
            type="button"
            disabled={!canEnter}
            whileTap={{ scale: canEnter ? 0.98 : 1 }}
            onClick={() => {
              const stream = streamRef.current;
              if (!stream) return;
              transferredRef.current = true;
              stopLoopback();
              if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
              onEnter(stream);
            }}
            className="w-full py-3.5 rounded-full text-[14px] font-medium disabled:opacity-35"
            style={{
              background: canEnter ? `linear-gradient(135deg, ${GOLD}, #e08055)` : "rgba(255,255,255,0.08)",
              color: canEnter ? BG : "rgba(245,243,239,0.5)",
            }}
          >
            Enter Mehfil
          </motion.button>
          {!canEnter && phase === "ready" && (
            <p className="text-center text-[11px]" style={{ color: "rgba(245,243,239,0.38)" }}>
              Unlock audio and confirm your camera and mic are live to continue.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatusRow({ ok, label, icon }: { ok: boolean; label: string; icon?: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: ok ? "rgba(107,232,158,0.06)" : "rgba(255,255,255,0.02)" }}>
      <span className="w-5 flex justify-center" style={{ color: ok ? MINT : "rgba(245,243,239,0.28)" }}>
        {icon ?? (ok ? "✓" : "·")}
      </span>
      <span style={{ color: ok ? "rgba(245,243,239,0.78)" : "rgba(245,243,239,0.38)" }}>{label}</span>
    </li>
  );
}
