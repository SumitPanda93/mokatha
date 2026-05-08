/**
 * Post-live Mehfil replay: upload / record audio, optional cover, private draft or publish to feed.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Upload, Trash2, X, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCurrentUserId,
  uploadAudio,
  upsertMehfilReplayDraft,
  publishMehfilReplay,
  deleteMehfilReplay,
  supabase,
  QK,
} from "@/lib/store";
import { trackEvent } from "@/lib/analytics";

async function uploadReplayCover(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `covers/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

type Props = {
  mehfilId: string;
  defaultTitle: string;
  onClose: () => void;
};

export default function MehfilReplaySheet({ mehfilId, defaultTitle, onClose }: Props) {
  const qc = useQueryClient();
  const me = getCurrentUserId() ?? "";
  const [title, setTitle] = useState(defaultTitle || "Mehfil replay");
  const [isPrivate, setIsPrivate] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | undefined>();
  const [replayId, setReplayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const invalidateReplay = () => {
    qc.invalidateQueries({ queryKey: ["mehfilReplayPublished", mehfilId] });
    qc.invalidateQueries({ queryKey: QK.posts });
    qc.invalidateQueries({ queryKey: QK.mehfil(mehfilId) });
    qc.invalidateQueries({ queryKey: QK.mehfils });
  };

  const onAudioFile = async (file: File) => {
    if (!me) return;
    setBusy(true);
    try {
      const url = await uploadAudio(me, file, file.name.endsWith(".mp3") ? "mp3" : "webm");
      setAudioUrl(url);
      setDurationSec(undefined);
      toast.success("Audio attached");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (!me || blob.size < 100) return;
        setBusy(true);
        try {
          const url = await uploadAudio(me, blob, "webm");
          setAudioUrl(url);
          toast.success("Recording saved");
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Could not save recording");
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const onCoverFile = async (file: File) => {
    if (!me) return;
    setBusy(true);
    try {
      const url = await uploadReplayCover(me, file);
      setCoverUrl(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!audioUrl) {
      toast.error("Add audio first — upload or record.");
      return;
    }
    setBusy(true);
    try {
      const row = await upsertMehfilReplayDraft({
        mehfilId,
        audioUrl,
        title,
        coverUrl: coverUrl ?? undefined,
        durationSec,
        isPrivate,
      });
      setReplayId(row.id);
      invalidateReplay();
      trackEvent("mehfil_replay_draft_saved", { mehfil_id: mehfilId });
      toast.success("Replay saved (draft)");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!audioUrl) {
      toast.error("Add audio first.");
      return;
    }
    setBusy(true);
    try {
      let rid = replayId;
      if (!rid) {
        const row = await upsertMehfilReplayDraft({
          mehfilId,
          audioUrl,
          title,
          coverUrl: coverUrl ?? undefined,
          durationSec,
          isPrivate,
        });
        rid = row.id;
        setReplayId(rid);
      }
      await publishMehfilReplay(rid);
      invalidateReplay();
      trackEvent("mehfil_replay_publish", { mehfil_id: mehfilId, private: isPrivate });
      toast.success("Replay published to your feed");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const removeReplay = async () => {
    if (!replayId) {
      setAudioUrl(null);
      setCoverUrl(null);
      return;
    }
    if (!confirm("Delete this replay draft permanently?")) return;
    setBusy(true);
    try {
      await deleteMehfilReplay(replayId);
      setReplayId(null);
      setAudioUrl(null);
      setCoverUrl(null);
      invalidateReplay();
      trackEvent("mehfil_replay_deleted", { mehfil_id: mehfilId });
      toast.success("Replay removed");
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={busy ? undefined : onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative rounded-t-[28px] px-6 pt-5 max-h-[92dvh] overflow-y-auto"
        style={{
          background: "linear-gradient(180deg,#2A1F24 0%,#1A0F14 100%)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          paddingBottom: "max(env(safe-area-inset-bottom), 28px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em]" style={{ color: "rgba(232,177,74,0.7)" }}>
              <Sparkles size={12} /> Save the gathering
            </div>
            <div className="font-['Playfair_Display'] text-[22px] mt-1" style={{ color: "#F5F3EF" }}>
              Mehfil replay
            </div>
            <div className="text-[12px] mt-1 font-['Inter']" style={{ color: "rgba(245,243,239,0.45)" }}>
              Let this moment stay — publish when you are ready.
            </div>
          </div>
          <button type="button" onClick={busy ? undefined : onClose} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <X size={16} style={{ color: "rgba(245,243,239,0.7)" }} />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(245,243,239,0.4)" }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] font-['Playfair_Display'] mb-4 outline-none"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F3EF" }} />

        <div className="flex gap-2 mb-4">
          <button type="button" disabled={busy}
            onClick={() => audioInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-['Inter']"
            style={{ background: "rgba(232,177,74,0.12)", border: "1px solid rgba(232,177,74,0.35)", color: "#E8B14A" }}>
            <Upload size={15} /> Upload audio
          </button>
          <button type="button" disabled={busy}
            onClick={toggleRecord}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-['Inter']"
            style={{
              background: recording ? "rgba(247,106,74,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${recording ? "rgba(247,106,74,0.5)" : "rgba(255,255,255,0.12)"}`,
              color: recording ? "#F76A4A" : "rgba(245,243,239,0.85)",
            }}>
            <Mic size={15} /> {recording ? "Stop" : "Record"}
          </button>
        </div>
        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAudioFile(f); e.target.value = ""; }} />

        {audioUrl && (
          <div className="text-[11px] mb-4 font-['Inter'] italic" style={{ color: "rgba(107,232,158,0.85)" }}>
            Audio ready · listeners can hear this once you publish.
          </div>
        )}

        <label className="block text-[11px] uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(245,243,239,0.4)" }}>Cover (optional)</label>
        <button type="button" disabled={busy} onClick={() => coverInputRef.current?.click()}
          className="w-full py-8 rounded-xl mb-4 text-[13px] font-['Inter']"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(245,243,239,0.5)" }}>
          {coverUrl ? "Change cover image" : "Add cover image"}
        </button>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCoverFile(f); e.target.value = ""; }} />

        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-white/20" />
          <span className="text-[13px] font-['Inter']" style={{ color: "rgba(245,243,239,0.65)" }}>
            Keep unpublished posts private (only you see them in feed)
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <motion.button type="button" whileTap={{ scale: 0.98 }} disabled={busy}
            onClick={() => void publish()}
            className="w-full py-3.5 rounded-full text-[14px] font-['Inter'] font-semibold"
            style={{
              background: "linear-gradient(135deg,#E8B14A,#F76A4A)",
              color: "#1A0F14",
              opacity: busy ? 0.6 : 1,
            }}>
            Publish replay to feed
          </motion.button>
          <button type="button" disabled={busy} onClick={() => void saveDraft()}
            className="w-full py-3 rounded-full text-[13px] font-['Inter']"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(245,243,239,0.85)" }}>
            Save draft only
          </button>
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={busy || !replayId} onClick={() => void removeReplay()}
              className="flex-1 py-2.5 rounded-full text-[12px] font-['Inter'] flex items-center justify-center gap-2"
              style={{ background: "rgba(247,106,74,0.12)", color: "#F76A4A" }}>
              <Trash2 size={14} /> Delete draft
            </button>
            <button type="button" disabled={busy} onClick={onClose}
              className="flex-1 py-2.5 rounded-full text-[12px] font-['Inter']"
              style={{ background: "transparent", color: "rgba(245,243,239,0.45)" }}>
              Skip · leave
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
