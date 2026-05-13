/**
 * Post-live Mehfil: studio replay is prepared server-side from the live session.
 * Host chooses visibility — no manual upload/record in-product.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMehfilReplayDraft,
  upsertMehfilReplayDraft,
  publishMehfilReplay,
  deleteMehfilReplay,
  QK,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";

type Props = {
  mehfilId: string;
  defaultTitle: string;
  onClose: () => void;
};

export default function MehfilReplaySheet({ mehfilId, defaultTitle, onClose }: Props) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"processing" | "choice">("processing");
  const [title, setTitle] = useState(defaultTitle || "Gathering replay");
  const [isPrivate, setIsPrivate] = useState(false);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("choice"), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await getMehfilReplayDraft(mehfilId);
        if (cancelled || !row) return;
        setReplayId(row.id);
        setTitle(row.title || defaultTitle);
        setIsPrivate(row.isPrivate);
        setPendingAudio(!row.audioUrl?.trim());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mehfilId, defaultTitle]);

  const invalidateReplay = () => {
    qc.invalidateQueries({ queryKey: ["mehfilReplayPublished", mehfilId] });
    qc.invalidateQueries({ queryKey: QK.posts });
    qc.invalidateQueries({ queryKey: QK.mehfil(mehfilId) });
    qc.invalidateQueries({ queryKey: QK.mehfils });
  };

  const savePreferences = async () => {
    setBusy(true);
    try {
      const row = await upsertMehfilReplayDraft({
        mehfilId,
        audioUrl: null,
        title,
        isPrivate,
      });
      setReplayId(row.id);
      setPendingAudio(!row.audioUrl?.trim());
      invalidateReplay();
      trackEvent("mehfil_replay_prefs_saved", { mehfil_id: mehfilId });
      toast.success("Replay preferences saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const tryPublish = async () => {
    setBusy(true);
    try {
      let rid = replayId;
      if (!rid) {
        const row = await upsertMehfilReplayDraft({
          mehfilId,
          audioUrl: null,
          title,
          isPrivate,
        });
        rid = row.id;
        setReplayId(rid);
        setPendingAudio(!row.audioUrl?.trim());
      }
      if (pendingAudio) {
        toast.message("Studio replay is still processing — check back soon or keep this gathering private.");
        return;
      }
      await publishMehfilReplay(rid);
      invalidateReplay();
      trackEvent("mehfil_replay_publish", { mehfil_id: mehfilId, private: isPrivate });
      toast.success("Replay published");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "replay_audio_pending") {
        toast.message("Replay audio isn’t attached yet — saving stays private until processing completes.");
      } else {
        toast.error(msg || "Publish failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const removeReplay = async () => {
    if (!replayId) {
      onClose();
      return;
    }
    if (!confirm("Remove this replay draft?")) return;
    setBusy(true);
    try {
      await deleteMehfilReplay(replayId);
      setReplayId(null);
      invalidateReplay();
      trackEvent("mehfil_replay_deleted", { mehfil_id: mehfilId });
      toast.success("Replay removed");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={busy ? undefined : onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative rounded-t-[28px] px-6 pt-5 max-h-[88dvh] overflow-y-auto"
        style={{
          background: "linear-gradient(195deg,#231820 0%,#120b10 58%,#0a0609 100%)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "max(env(safe-area-inset-bottom), 28px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] font-['Inter']" style={{ color: "rgba(232,177,74,0.65)" }}>
              <Sparkles size={12} /> Gathering closed
            </div>
            <div className="font-['Playfair_Display'] text-[23px] mt-2 leading-tight" style={{ color: "#F5F3EF" }}>
              Replay
            </div>
            <p className="text-[12px] mt-2 font-['Inter'] leading-relaxed max-w-[300px]" style={{ color: "rgba(245,243,239,0.42)" }}>
              Your live session is being finalized. Choose how this gathering appears once studio audio is attached — no upload needed here.
            </p>
          </div>
          <button type="button" onClick={busy ? undefined : onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <X size={16} style={{ color: "rgba(245,243,239,0.65)" }} />
          </button>
        </div>

        {phase === "processing" ? (
          <div className="py-14 flex flex-col items-center gap-5">
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "rgba(232,177,74,0.45)", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-[13px] font-['Playfair_Display'] italic text-white/45 text-center">Stilling the room…</p>
          </div>
        ) : (
          <>
            <label className="block text-[10px] uppercase tracking-[0.22em] mb-2 font-['Inter']" style={{ color: "rgba(245,243,239,0.38)" }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl px-4 py-3.5 text-[15px] font-['Playfair_Display'] mb-5 outline-none"
              style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F3EF" }} />

            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-white/20" />
              <span className="text-[13px] font-['Inter'] leading-snug" style={{ color: "rgba(245,243,239,0.62)" }}>
                Keep replay private when published (only you on your shelf)
              </span>
            </label>

            {pendingAudio ? (
              <div className="mb-6 px-3 py-3 rounded-xl text-[11px] font-['Inter'] leading-relaxed border border-white/[0.07] bg-white/[0.04]"
                style={{ color: "rgba(245,243,239,0.48)" }}>
                Studio replay audio is processing. You can save preferences now; publish unlocks automatically when audio is ready.
              </div>
            ) : (
              <div className="mb-6 px-3 py-3 rounded-xl text-[11px] font-['Inter'] border border-emerald-500/20 bg-emerald-500/[0.07]"
                style={{ color: "rgba(167,243,208,0.85)" }}>
                Replay audio is attached — you can publish to your feed.
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <motion.button type="button" whileTap={{ scale: 0.985 }} disabled={busy}
                onClick={() => void savePreferences()}
                className="w-full py-3.5 rounded-full text-[14px] font-['Inter'] font-medium"
                style={{ background: "rgba(255,255,255,0.09)", color: "#F5F3EF" }}>
                Save replay preferences
              </motion.button>

              <motion.button type="button" whileTap={{ scale: 0.985 }} disabled={busy}
                onClick={() => void tryPublish()}
                className="w-full py-3.5 rounded-full text-[14px] font-['Inter'] font-semibold"
                style={{
                  background: pendingAudio ? "rgba(232,177,74,0.18)" : "linear-gradient(135deg,#E8B14A,#c07a3a)",
                  color: pendingAudio ? "rgba(245,243,239,0.55)" : "#1A0F14",
                  opacity: busy ? 0.65 : 1,
                }}>
                {pendingAudio ? "Publish when ready (waiting on audio)" : "Publish replay to feed"}
              </motion.button>

              <button type="button" disabled={busy || !replayId} onClick={() => void removeReplay()}
                className="w-full py-3 rounded-full text-[13px] font-['Inter']"
                style={{ background: "transparent", color: "rgba(247,106,74,0.75)" }}>
                Delete replay draft
              </button>

              <button type="button" disabled={busy} onClick={onClose}
                className="w-full py-2.5 rounded-full text-[12px] font-['Inter']"
                style={{ color: "rgba(245,243,239,0.38)" }}>
                Done
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
