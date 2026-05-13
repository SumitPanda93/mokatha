/**
 * Post-live Mehfil — replay asset arrives via LiveKit egress webhook (no manual upload).
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
  useMehfilReplayDraftRow,
  useMehfilReplayDraftRealtime,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";

type Props = {
  mehfilId: string;
  defaultTitle: string;
  onClose: () => void;
};

export default function MehfilReplaySheet({ mehfilId, defaultTitle, onClose }: Props) {
  const qc = useQueryClient();
  const { data: draftRemote } = useMehfilReplayDraftRow(mehfilId, true);
  useMehfilReplayDraftRealtime(mehfilId, true);

  const [title, setTitle] = useState(defaultTitle || "Gathering replay");
  const [isPrivate, setIsPrivate] = useState(false);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await getMehfilReplayDraft(mehfilId);
        if (cancelled || !row) return;
        setReplayId(row.id);
        setTitle(row.title || defaultTitle);
        setIsPrivate(row.isPrivate);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mehfilId, defaultTitle]);

  useEffect(() => {
    if (!draftRemote) return;
    setReplayId(draftRemote.id);
    setTitle(draftRemote.title || defaultTitle);
    setIsPrivate(draftRemote.isPrivate);
  }, [draftRemote, defaultTitle]);

  const pipeline = draftRemote?.replayProcessingStatus ?? "pending";
  const hasAsset = !!(draftRemote?.audioUrl?.trim() || draftRemote?.videoUrl?.trim());
  const assetReady = hasAsset || pipeline === "ready";
  const failed = pipeline === "failed";
  const working =
    !failed &&
    !assetReady &&
    (pipeline === "recording" || pipeline === "processing" || pipeline === "pending");

  const invalidateReplay = () => {
    qc.invalidateQueries({ queryKey: ["mehfilReplayPublished", mehfilId] });
    qc.invalidateQueries({ queryKey: QK.mehfilReplayDraft(mehfilId) });
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
      let rid = replayId ?? draftRemote?.id ?? null;
      if (!rid) {
        const row = await upsertMehfilReplayDraft({
          mehfilId,
          audioUrl: null,
          title,
          isPrivate,
        });
        rid = row.id;
        setReplayId(rid);
      }
      if (!assetReady) {
        toast.message("Still preserving your gathering — publishing unlocks when the replay is ready.");
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
        toast.message("Still preserving your gathering — try again in a moment.");
      } else {
        toast.error(msg || "Publish failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const removeReplay = async () => {
    const rid = replayId ?? draftRemote?.id;
    if (!rid) {
      onClose();
      return;
    }
    if (!confirm("Discard this replay draft?")) return;
    setBusy(true);
    try {
      await deleteMehfilReplay(rid);
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
              Your replay
            </div>
            <p className="text-[12px] mt-2 font-['Inter'] leading-relaxed max-w-[300px]" style={{ color: "rgba(245,243,239,0.42)" }}>
              What unfolded here is being preserved automatically — choose how it appears once ready.
            </p>
          </div>
          <button type="button" onClick={busy ? undefined : onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <X size={16} style={{ color: "rgba(245,243,239,0.65)" }} />
          </button>
        </div>

        {failed ? (
          <div className="space-y-6 pb-4">
            <div className="px-4 py-5 rounded-2xl border border-rose-400/15 bg-rose-500/[0.06]">
              <p className="font-['Playfair_Display'] text-[17px] mb-2" style={{ color: "#fecaca" }}>
                We couldn&apos;t preserve this gathering.
              </p>
              <p className="text-[12px] font-['Inter'] leading-relaxed" style={{ color: "rgba(245,243,239,0.45)" }}>
                The room reached us, but recording couldn&apos;t finish. Nothing went wrong on your voice — it&apos;s safe to try another Mehfil when you&apos;re ready.
              </p>
              {draftRemote?.recordingError ? (
                <p className="text-[10px] mt-3 font-mono opacity-35">{draftRemote.recordingError}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2.5">
              <motion.button type="button" whileTap={{ scale: 0.985 }} disabled={busy} onClick={() => void removeReplay()}
                className="w-full py-3.5 rounded-full text-[14px] font-['Inter'] font-medium"
                style={{ background: "rgba(245,243,239,0.08)", color: "#F5F3EF" }}>
                Discard draft
              </motion.button>
              <button type="button" disabled={busy} onClick={onClose} className="w-full py-2.5 rounded-full text-[12px] font-['Inter']"
                style={{ color: "rgba(245,243,239,0.38)" }}>
                Done
              </button>
            </div>
          </div>
        ) : working ? (
          <div className="py-12 flex flex-col items-center gap-5 pb-8">
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "rgba(232,177,74,0.45)", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
            <div className="text-center space-y-2 max-w-[280px]">
              <p className="text-[15px] font-['Playfair_Display']" style={{ color: "rgba(245,243,239,0.88)" }}>
                Processing the Mehfil…
              </p>
              <p className="text-[12px] font-['Inter'] leading-relaxed" style={{ color: "rgba(245,243,239,0.45)" }}>
                Your gathering is being preserved. You can step away — we&apos;ll attach the replay quietly.
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => void savePreferences()}
              className="mt-2 px-8 py-3 rounded-full text-[12px] font-['Inter'] border border-white/[0.08] bg-white/[0.04]"
              style={{ color: "rgba(245,243,239,0.55)" }}>
              Save title & privacy while waiting
            </button>
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

            <div className={`mb-6 px-3 py-3 rounded-xl text-[11px] font-['Inter'] leading-relaxed border ${
              assetReady ? "border-emerald-500/20 bg-emerald-500/[0.07]" : "border-white/[0.07] bg-white/[0.04]"
            }`}
              style={{ color: assetReady ? "rgba(167,243,208,0.85)" : "rgba(245,243,239,0.48)" }}>
              {assetReady
                ? "Replay is ready — publish when it feels right, or keep it close."
                : "Still collecting the room recording…"}
            </div>

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
                  background: assetReady ? "linear-gradient(135deg,#E8B14A,#c07a3a)" : "rgba(232,177,74,0.18)",
                  color: assetReady ? "#1A0F14" : "rgba(245,243,239,0.55)",
                  opacity: busy ? 0.65 : 1,
                }}>
                {assetReady ? "Publish replay to feed" : "Publish when ready"}
              </motion.button>

              <button type="button" disabled={busy || !(replayId ?? draftRemote?.id)} onClick={() => void removeReplay()}
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
