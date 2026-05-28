import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  X, Mic, Radio, Video, Type, ImagePlus, Palette, BarChart3, MapPin, UserPlus, Lock, Eye, Users, Loader2,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadPostCoverImage } from "@/lib/store";
import { saveCreateDraft, type CreatePostType, type CreateVisibility } from "@/lib/createDraft";
import { FEED_BG, FEED_BORDER, FEED_GOLD, FEED_MUTED, FEED_TEXT, FEED_CARD } from "@/components/feed/home-feed-ui";
import { toast } from "sonner";

const TITLE_MAX = 80;
const BODY_MAX = 500;

const POST_TYPES: {
  id: CreatePostType;
  label: string;
  icon: typeof Mic;
  color: string;
  border: string;
  bg: string;
}[] = [
  { id: "voice", label: "Voice Post", icon: Mic, color: FEED_GOLD, border: "rgba(201,168,76,0.55)", bg: "rgba(201,168,76,0.12)" },
  { id: "live", label: "Live Room", icon: Radio, color: "#9B59B6", border: "rgba(155,89,182,0.55)", bg: "rgba(155,89,182,0.12)" },
  { id: "video", label: "Video Post", icon: Video, color: "#E86A9A", border: "rgba(232,106,154,0.55)", bg: "rgba(232,106,154,0.12)" },
  { id: "text", label: "Text Post", icon: Type, color: "#F76A4A", border: "rgba(247,106,74,0.55)", bg: "rgba(247,106,74,0.12)" },
];

const VISIBILITY_OPTIONS: { id: CreateVisibility; label: string; icon: typeof Eye; hint: string }[] = [
  { id: "public", label: "Public", icon: Eye, hint: "Anyone can see" },
  { id: "followers", label: "Followers", icon: Users, hint: "Followers only" },
  { id: "private", label: "Private", icon: Lock, hint: "Only you" },
];

const TIP_PRESETS = [10, 20, 50, 100] as const;

const ADDONS = [
  { id: "cover", label: "Cover Image", icon: ImagePlus, wired: true },
  { id: "background", label: "Background", icon: Palette, wired: false },
  { id: "poll", label: "Poll", icon: BarChart3, wired: false },
  { id: "location", label: "Location", icon: MapPin, wired: false },
  { id: "tag", label: "Tag People", icon: UserPlus, wired: false },
] as const;

function GoldWaveform() {
  return (
    <div className="flex items-end justify-center gap-[2px] h-3 px-5">
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${4 + ((i * 7 + 11) % 12)}px`,
            background: `linear-gradient(180deg, ${FEED_GOLD}, rgba(201,168,76,0.35))`,
            opacity: 0.35 + ((i * 13) % 7) * 0.08,
          }}
        />
      ))}
    </div>
  );
}

export default function CreateHub() {
  useTitle("Create Post");
  const [, setLocation] = useLocation();

  const [postType, setPostType] = useState<CreatePostType>("voice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CreateVisibility>("public");
  const [accessMode, setAccessMode] = useState<"free" | "tip">("free");
  const [minTip, setMinTip] = useState(10);
  const [customTip, setCustomTip] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const add = useAddPost();

  const effectiveMinTip = customTip ? Number(customTip) || minTip : minTip;
  const isPrivate = visibility === "private";

  const buildDraft = () => ({
    postType,
    title: title.trim() || undefined,
    body: body.trim() || undefined,
    accessType: accessMode,
    minTip: accessMode === "tip" ? effectiveMinTip : undefined,
    visibility,
    isPrivate,
    coverUrl: coverUrl ?? undefined,
  });

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) {
      toast.error("Sign in first");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setUploadingCover(true);
    try {
      const url = await uploadPostCoverImage(me, file);
      setCoverUrl(url);
      toast.success("Cover added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
      setCoverPreview(null);
    } finally {
      setUploadingCover(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleAddon = (id: string) => {
    if (id === "cover") {
      coverInputRef.current?.click();
      return;
    }
    const labels: Record<string, string> = {
      background: "Background themes",
      poll: "Polls",
      location: "Location tagging",
      tag: "Tag people",
    };
    toast.message(`${labels[id] ?? id} — coming soon`);
  };

  const handleDrafts = () => {
    toast.message("Drafts — coming soon");
  };

  const navigateWithDraft = (path: string) => {
    saveCreateDraft(buildDraft());
    setLocation(path);
  };

  const handleShare = () => {
    const me = getCurrentUserId();
    if (!me) {
      toast.error("Please sign in to create");
      setLocation("/auth/login");
      return;
    }

    if (scheduleEnabled) {
      toast.message("Schedule post — coming soon");
      return;
    }

    if (visibility === "followers") {
      toast.message("Followers-only visibility — coming soon (posting as public for now)");
    }

    if (postType === "text") {
      if (!body.trim()) {
        toast.error("Write something to share");
        return;
      }
      const finalTitle = title.trim() || body.trim().slice(0, TITLE_MAX) || "Untitled";
      add.mutate(
        {
          kind: "text",
          authorId: me,
          title: finalTitle,
          body: body.trim(),
          language: "or",
          tags: [],
          accessType: accessMode,
          minTip: accessMode === "tip" ? effectiveMinTip : undefined,
          isPrivate,
          coverUrl: coverUrl ?? undefined,
        },
        {
          onSuccess: () => {
            toast.success("Post shared!");
            setLocation("/");
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Publish failed"),
        },
      );
      return;
    }

    if (postType === "voice") {
      navigateWithDraft("/create/voice");
      return;
    }
    if (postType === "video") {
      navigateWithDraft("/create/reel");
      return;
    }
    if (postType === "live") {
      navigateWithDraft("/mehfil/host/new");
    }
  };

  const shareDisabled =
    add.isPending ||
    uploadingCover ||
    (postType === "text" && !body.trim());

  const shareLabel =
    postType === "live"
      ? "Start Live Room"
      : postType === "voice"
        ? "Continue to Record"
        : postType === "video"
          ? "Continue to Video"
          : add.isPending
            ? "Sharing…"
            : "Share Post";

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <div
        className="fixed top-[-40px] right-[-30px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)", filter: "blur(48px)" }}
      />

      {/* Header */}
      <div className="sticky top-0 z-20 px-5 pt-3 pb-2" style={{ background: "rgba(10,8,6,0.92)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}
          >
            <X size={16} style={{ color: FEED_MUTED }} />
          </button>
          <div className="font-['Playfair_Display'] text-[22px] leading-none">Create Post</div>
          <button
            type="button"
            onClick={handleDrafts}
            className="px-3 py-1.5 rounded-full text-[11px] font-['Inter'] font-medium"
            style={{ border: `1px solid ${FEED_BORDER}`, color: FEED_GOLD, background: "rgba(201,168,76,0.08)" }}
          >
            Drafts
          </button>
        </div>
        <div className="mt-3">
          <GoldWaveform />
        </div>
      </div>

      <div className="relative z-10 px-5 pb-8 space-y-6">
        {/* Intro */}
        <div className="pt-2">
          <h2 className="font-['Playfair_Display'] text-[20px] leading-tight">What do you want to share?</h2>
          <p className="text-[12px] font-['Inter'] mt-1" style={{ color: FEED_MUTED }}>
            Choose a format and tell your story
          </p>
        </div>

        {/* Type cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {POST_TYPES.map((t) => {
            const selected = postType === t.id;
            const Icon = t.icon;
            return (
              <motion.button
                key={t.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setPostType(t.id)}
                className="flex flex-col items-start gap-2 p-3.5 rounded-2xl text-left transition-all"
                style={{
                  background: selected ? t.bg : FEED_CARD,
                  border: `1.5px solid ${selected ? t.border : FEED_BORDER}`,
                  boxShadow: selected ? `0 0 20px ${t.bg}` : undefined,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: selected ? `${t.color}22` : "rgba(255,255,255,0.04)" }}
                >
                  <Icon size={18} style={{ color: selected ? t.color : FEED_MUTED }} />
                </div>
                <span className="text-[13px] font-['Inter'] font-semibold" style={{ color: selected ? t.color : FEED_TEXT }}>
                  {t.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>
              Title <span className="normal-case tracking-normal opacity-70">(optional)</span>
            </label>
            <span className="text-[10px] font-['Inter'] tabular-nums" style={{ color: FEED_MUTED }}>
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="Give it a title…"
            className="w-full rounded-xl px-4 py-3 text-[14px] font-['Inter'] outline-none"
            style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }}
          />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>
              {postType === "voice" ? "Caption" : "Body"}
            </label>
            <span className="text-[10px] font-['Inter'] tabular-nums" style={{ color: FEED_MUTED }}>
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder="Say something…"
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-[14px] font-['Inter'] outline-none resize-none leading-relaxed"
            style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }}
          />
        </div>

        {/* Cover preview */}
        {(coverPreview || coverUrl) && (
          <div className="relative rounded-xl overflow-hidden aspect-[16/9]">
            <img src={coverPreview || coverUrl!} alt="" className="w-full h-full object-cover" />
            {uploadingCover && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-white" />
              </div>
            )}
            <button
              type="button"
              onClick={() => { setCoverUrl(null); setCoverPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
            >
              <X size={12} className="text-white" />
            </button>
          </div>
        )}

        {/* Add-ons */}
        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>
            Add-ons
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {ADDONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAddon(a.id)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-['Inter'] font-medium"
                style={{
                  background: a.id === "cover" && coverUrl ? "rgba(201,168,76,0.12)" : FEED_CARD,
                  border: `1px solid ${a.id === "cover" && coverUrl ? "rgba(201,168,76,0.35)" : FEED_BORDER}`,
                  color: a.id === "cover" && coverUrl ? FEED_GOLD : FEED_MUTED,
                }}
              >
                <a.icon size={13} />
                {a.label}
              </button>
            ))}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
        </div>

        {/* Visibility */}
        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>
            Who can see
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VISIBILITY_OPTIONS.map((v) => {
              const selected = visibility === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-all"
                  style={{
                    background: selected ? "rgba(201,168,76,0.1)" : FEED_CARD,
                    border: `1.5px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
                  }}
                >
                  <Icon size={16} style={{ color: selected ? FEED_GOLD : FEED_MUTED }} />
                  <span className="text-[12px] font-['Inter'] font-medium" style={{ color: selected ? FEED_GOLD : FEED_TEXT }}>
                    {v.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Access */}
        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>
            Access
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              { id: "free" as const, label: "Free to view", hint: "Open to everyone" },
              { id: "tip" as const, label: "Tip to unlock", hint: "Minimum tip required" },
            ]).map((a) => {
              const selected = accessMode === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccessMode(a.id)}
                  className="py-3 px-3 rounded-xl text-left"
                  style={{
                    background: selected ? "rgba(201,168,76,0.1)" : FEED_CARD,
                    border: `1.5px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
                  }}
                >
                  <div className="text-[12px] font-['Inter'] font-semibold" style={{ color: selected ? FEED_GOLD : FEED_TEXT }}>
                    {a.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: FEED_MUTED }}>{a.hint}</div>
                </button>
              );
            })}
          </div>
          {accessMode === "tip" && (
            <div className="flex flex-wrap gap-2">
              {TIP_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setMinTip(v); setCustomTip(""); }}
                  className="px-3 py-2 rounded-xl text-[12px] font-['Inter'] font-medium"
                  style={{
                    background: minTip === v && !customTip ? "rgba(201,168,76,0.15)" : FEED_CARD,
                    border: `1px solid ${minTip === v && !customTip ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
                    color: minTip === v && !customTip ? FEED_GOLD : FEED_MUTED,
                  }}
                >
                  ₹{v}
                </button>
              ))}
              <input
                type="number"
                min={10}
                placeholder="Custom"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                className="w-20 px-3 py-2 rounded-xl text-[12px] font-['Inter'] outline-none"
                style={{ background: FEED_CARD, border: `1px solid ${customTip ? "rgba(201,168,76,0.45)" : FEED_BORDER}`, color: FEED_TEXT }}
              />
            </div>
          )}
        </div>

        {/* Schedule */}
        <div
          className="flex items-center justify-between py-3 px-4 rounded-xl"
          style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
        >
          <div>
            <div className="text-[13px] font-['Inter'] font-medium">Schedule Post</div>
            <div className="text-[10px] mt-0.5" style={{ color: FEED_MUTED }}>Publish at a later time</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setScheduleEnabled((s) => !s);
              if (!scheduleEnabled) toast.message("Schedule post — coming soon");
            }}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ background: scheduleEnabled ? FEED_GOLD : "rgba(255,255,255,0.12)" }}
          >
            <div
              className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform"
              style={{ transform: scheduleEnabled ? "translateX(22px)" : "translateX(3px)" }}
            />
          </button>
        </div>

        {/* Share */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={shareDisabled}
          onClick={handleShare}
          className="w-full py-4 rounded-2xl text-[15px] font-['Inter'] font-semibold disabled:opacity-45 transition-opacity"
          style={{
            background: `linear-gradient(135deg, ${FEED_GOLD}, #E8B14A)`,
            color: FEED_BG,
            boxShadow: "0 8px 28px rgba(201,168,76,0.32)",
          }}
        >
          {shareLabel}
        </motion.button>
      </div>
    </div>
  );
}
