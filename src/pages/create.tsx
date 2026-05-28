import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  X, Mic, Radio, Video, Type, ImagePlus, Palette, BarChart3, MapPin, UserPlus, Lock, Eye, Users, Loader2, Check,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useAddPost, getCurrentUserId, uploadPostCoverImage, type AddPostInput } from "@/lib/store";
import {
  saveCreateDraft,
  draftThemeStyle,
  type CreatePostType,
  type CreateVisibility,
  type CreatePollDraft,
  type CreateLocation,
} from "@/lib/createDraft";
import type { PostBackgroundTheme } from "@/lib/postThemes";
import { useSavePostDraft } from "@/lib/postDrafts";
import CreateDraftsSheet from "@/components/create/CreateDraftsSheet";
import HubMediaRecorder from "@/components/create/HubMediaRecorder";
import {
  BackgroundThemeSheet,
  PollSheet,
  LocationSheet,
  TagPeopleSheet,
  applyDraftToHub,
} from "@/components/create/CreateAddonPanels";
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

type AddonId = "cover" | "background" | "poll" | "location" | "tag";

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

function minScheduleLocal(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
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
  const [scheduledAt, setScheduledAt] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState<PostBackgroundTheme | undefined>();
  const [poll, setPoll] = useState<CreatePollDraft | undefined>();
  const [location, setLocationTag] = useState<CreateLocation | undefined>();
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [hubAudioUrl, setHubAudioUrl] = useState<string | undefined>();
  const [hubAudioDuration, setHubAudioDuration] = useState<number | undefined>();
  const [hubVideoUrl, setHubVideoUrl] = useState<string | undefined>();
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>();
  const [addonSheet, setAddonSheet] = useState<AddonId | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const add = useAddPost();
  const saveDraft = useSavePostDraft();

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
    scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    backgroundTheme,
    poll,
    location,
    taggedUserIds: taggedUserIds.length ? taggedUserIds : undefined,
    audioUrl: hubAudioUrl,
    audioDurationSec: hubAudioDuration,
    videoUrl: hubVideoUrl,
  });

  const buildPostPayload = (kind: AddPostInput["kind"]): AddPostInput => ({
    kind,
    authorId: getCurrentUserId()!,
    title: title.trim() || body.trim().slice(0, TITLE_MAX) || "Untitled",
    body: body.trim(),
    language: "or",
    tags: [],
    accessType: accessMode,
    minTip: accessMode === "tip" ? effectiveMinTip : undefined,
    visibility,
    isPrivate,
    coverUrl: coverUrl ?? undefined,
    scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    backgroundTheme,
    location,
    poll,
    taggedUserIds: taggedUserIds.length ? taggedUserIds : undefined,
  });

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      toast.success("Cover added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
      setCoverPreview(null);
    } finally {
      setUploadingCover(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleAddon = (id: AddonId) => {
    if (id === "cover") { coverInputRef.current?.click(); return; }
    setAddonSheet(id);
  };

  const handleSaveDraft = () => {
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in to save drafts"); return; }
    saveDraft.mutate(
      { draft: buildDraft(), draftId: activeDraftId, title: title.trim() || undefined },
      {
        onSuccess: (row) => {
          setActiveDraftId(row.id);
          toast.success("Draft saved");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const loadDraft = (draft: ReturnType<typeof buildDraft>, draftId: string) => {
    setActiveDraftId(draftId);
    applyDraftToHub(draft as Parameters<typeof applyDraftToHub>[0], {
      setPostType, setTitle, setBody, setVisibility, setAccessMode, setMinTip, setCustomTip,
      setScheduleEnabled, setScheduledAt, setCoverUrl, setCoverPreview, setBackgroundTheme,
      setPoll, setLocation: setLocationTag, setTaggedUserIds, setHubAudioUrl, setHubAudioDuration, setHubVideoUrl,
    });
    toast.success("Draft loaded");
  };

  const navigateWithDraft = (path: string) => {
    saveCreateDraft(buildDraft());
    setLocation(path);
  };

  const publishFromHub = (payload: AddPostInput, successMsg: string, redirect = "/") => {
    add.mutate(payload, {
      onSuccess: () => {
        toast.success(successMsg);
        setLocation(redirect);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Publish failed"),
    });
  };

  const handleShare = () => {
    const me = getCurrentUserId();
    if (!me) { toast.error("Please sign in to create"); setLocation("/auth/login"); return; }

    if (scheduleEnabled) {
      if (!scheduledAt) { toast.error("Pick a schedule date & time"); return; }
      if (new Date(scheduledAt).getTime() <= Date.now()) { toast.error("Schedule time must be in the future"); return; }
    }

    if (postType === "text") {
      if (!body.trim()) { toast.error("Write something to share"); return; }
      publishFromHub(buildPostPayload("text"), scheduleEnabled ? "Post scheduled!" : "Post shared!");
      return;
    }

    if (postType === "voice" && hubAudioUrl) {
      if (!title.trim() && !body.trim()) { toast.error("Add a title or caption"); return; }
      publishFromHub({
        ...buildPostPayload("voice"),
        title: title.trim() || "Voice post",
        body: body.trim(),
        audioUrl: hubAudioUrl,
        durationSec: hubAudioDuration,
        tags: ["voice"],
      }, scheduleEnabled ? "Voice post scheduled!" : "Voice post shared!");
      return;
    }

    if (postType === "video" && hubVideoUrl) {
      publishFromHub({
        ...buildPostPayload("reel"),
        title: title.trim() || body.trim().slice(0, 72) || "Video post",
        body: body.trim(),
        videoUrl: hubVideoUrl,
        tags: ["reel"],
      }, scheduleEnabled ? "Video scheduled!" : "Video shared!");
      return;
    }

    if (postType === "voice") { navigateWithDraft("/create/voice"); return; }
    if (postType === "video") { navigateWithDraft("/create/reel"); return; }
    if (postType === "live") navigateWithDraft("/mehfil/host/new");
  };

  const addonActive = (id: AddonId) => {
    if (id === "cover") return !!coverUrl;
    if (id === "background") return !!backgroundTheme && backgroundTheme !== "default";
    if (id === "poll") return !!poll;
    if (id === "location") return !!location;
    if (id === "tag") return taggedUserIds.length > 0;
    return false;
  };

  const shareDisabled =
    add.isPending ||
    uploadingCover ||
    (postType === "text" && !body.trim());

  const shareLabel = (() => {
    if (scheduleEnabled) return add.isPending ? "Scheduling…" : "Schedule Post";
    if (postType === "live") return "Start Live Room";
    if (postType === "voice" && !hubAudioUrl) return "Continue to Record";
    if (postType === "video" && !hubVideoUrl) return "Continue to Video";
    if (add.isPending) return "Sharing…";
    if (postType === "voice" && hubAudioUrl) return "Share Voice Post";
    if (postType === "video" && hubVideoUrl) return "Share Video Post";
    return "Share Post";
  })();

  const ADDONS: { id: AddonId; label: string; icon: typeof ImagePlus }[] = [
    { id: "cover", label: "Cover Image", icon: ImagePlus },
    { id: "background", label: "Background", icon: Palette },
    { id: "poll", label: "Poll", icon: BarChart3 },
    { id: "location", label: "Location", icon: MapPin },
    { id: "tag", label: "Tag People", icon: UserPlus },
  ];

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <div className="fixed top-[-40px] right-[-30px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)", filter: "blur(48px)" }} />

      <div className="sticky top-0 z-20 px-5 pt-3 pb-2" style={{ background: "rgba(10,8,6,0.92)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setLocation("/")} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}>
            <X size={16} style={{ color: FEED_MUTED }} />
          </button>
          <div className="font-['Playfair_Display'] text-[22px] leading-none">Create Post</div>
          <button type="button" onClick={() => setDraftsOpen(true)} className="px-3 py-1.5 rounded-full text-[11px] font-['Inter'] font-medium"
            style={{ border: `1px solid ${FEED_BORDER}`, color: FEED_GOLD, background: "rgba(201,168,76,0.08)" }}>
            Drafts
          </button>
        </div>
        <div className="mt-3"><GoldWaveform /></div>
      </div>

      <div className="relative z-10 px-5 pb-8 space-y-6">
        <div className="pt-2">
          <h2 className="font-['Playfair_Display'] text-[20px] leading-tight">What do you want to share?</h2>
          <p className="text-[12px] font-['Inter'] mt-1" style={{ color: FEED_MUTED }}>Choose a format and tell your story</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {POST_TYPES.map((t) => {
            const selected = postType === t.id;
            const Icon = t.icon;
            return (
              <motion.button key={t.id} type="button" whileTap={{ scale: 0.97 }} onClick={() => setPostType(t.id)}
                className="flex flex-col items-start gap-2 p-3.5 rounded-2xl text-left transition-all"
                style={{ background: selected ? t.bg : FEED_CARD, border: `1.5px solid ${selected ? t.border : FEED_BORDER}`, boxShadow: selected ? `0 0 20px ${t.bg}` : undefined }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: selected ? `${t.color}22` : "rgba(255,255,255,0.04)" }}>
                  <Icon size={18} style={{ color: selected ? t.color : FEED_MUTED }} />
                </div>
                <span className="text-[13px] font-['Inter'] font-semibold" style={{ color: selected ? t.color : FEED_TEXT }}>{t.label}</span>
              </motion.button>
            );
          })}
        </div>

        {(postType === "voice" || postType === "video") && (
          <HubMediaRecorder
            mode={postType === "voice" ? "voice" : "video"}
            onVoiceReady={(url, dur) => { setHubAudioUrl(url); setHubAudioDuration(dur); }}
            onVideoReady={(url) => setHubVideoUrl(url)}
          />
        )}

        {(hubAudioUrl || hubVideoUrl) && (
          <div className="flex items-center gap-2 text-[12px] font-['Inter'] px-3 py-2 rounded-xl" style={{ background: "rgba(201,168,76,0.08)", border: `1px solid rgba(201,168,76,0.25)`, color: FEED_GOLD }}>
            <Check size={14} />
            {hubAudioUrl ? `Voice clip ready (${hubAudioDuration ?? 0}s)` : "Video clip ready — share from here or continue to trim"}
          </div>
        )}

        <div className="rounded-2xl p-4 transition-all" style={{ ...draftThemeStyle(backgroundTheme), border: `1px solid ${FEED_BORDER}` }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>
              Title <span className="normal-case tracking-normal opacity-70">(optional)</span>
            </label>
            <span className="text-[10px] font-['Inter'] tabular-nums" style={{ color: FEED_MUTED }}>{title.length}/{TITLE_MAX}</span>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))} placeholder="Give it a title…"
            className="w-full rounded-xl px-4 py-3 text-[14px] font-['Inter'] outline-none mb-4"
            style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }} />
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-['Inter'] uppercase tracking-[0.16em]" style={{ color: FEED_MUTED }}>
              {postType === "voice" ? "Caption" : "Body"}
            </label>
            <span className="text-[10px] font-['Inter'] tabular-nums" style={{ color: FEED_MUTED }}>{body.length}/{BODY_MAX}</span>
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))} placeholder="Say something…" rows={4}
            className="w-full rounded-xl px-4 py-3 text-[14px] font-['Inter'] outline-none resize-none leading-relaxed"
            style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }} />
        </div>

        {(coverPreview || coverUrl) && (
          <div className="relative rounded-xl overflow-hidden aspect-[16/9]">
            <img src={coverPreview || coverUrl!} alt="" className="w-full h-full object-cover" />
            {uploadingCover && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white" /></div>
            )}
            <button type="button" onClick={() => { setCoverUrl(null); setCoverPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"><X size={12} className="text-white" /></button>
          </div>
        )}

        {poll && (
          <div className="rounded-xl px-4 py-3 text-[12px] font-['Inter']" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
            <div className="font-medium mb-1">{poll.question}</div>
            <div style={{ color: FEED_MUTED }}>{poll.options.length} options</div>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2 text-[12px] font-['Inter']" style={{ color: FEED_GOLD }}>
            <MapPin size={14} /> {location.name}
          </div>
        )}
        {taggedUserIds.length > 0 && (
          <div className="text-[12px] font-['Inter']" style={{ color: FEED_MUTED }}>{taggedUserIds.length} people tagged</div>
        )}

        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>Add-ons</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {ADDONS.map((a) => (
              <button key={a.id} type="button" onClick={() => handleAddon(a.id)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-['Inter'] font-medium"
                style={{
                  background: addonActive(a.id) ? "rgba(201,168,76,0.12)" : FEED_CARD,
                  border: `1px solid ${addonActive(a.id) ? "rgba(201,168,76,0.35)" : FEED_BORDER}`,
                  color: addonActive(a.id) ? FEED_GOLD : FEED_MUTED,
                }}>
                <a.icon size={13} />{a.label}
              </button>
            ))}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
        </div>

        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>Who can see</div>
          <div className="grid grid-cols-3 gap-2">
            {VISIBILITY_OPTIONS.map((v) => {
              const selected = visibility === v.id;
              const Icon = v.icon;
              return (
                <button key={v.id} type="button" onClick={() => setVisibility(v.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-all"
                  style={{ background: selected ? "rgba(201,168,76,0.1)" : FEED_CARD, border: `1.5px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}` }}>
                  <Icon size={16} style={{ color: selected ? FEED_GOLD : FEED_MUTED }} />
                  <span className="text-[12px] font-['Inter'] font-medium" style={{ color: selected ? FEED_GOLD : FEED_TEXT }}>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-['Inter'] uppercase tracking-[0.16em] mb-2.5" style={{ color: FEED_MUTED }}>Access</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              { id: "free" as const, label: "Free to view", hint: "Open to everyone" },
              { id: "tip" as const, label: "Tip to unlock", hint: "Minimum tip required" },
            ]).map((a) => {
              const selected = accessMode === a.id;
              return (
                <button key={a.id} type="button" onClick={() => setAccessMode(a.id)} className="py-3 px-3 rounded-xl text-left"
                  style={{ background: selected ? "rgba(201,168,76,0.1)" : FEED_CARD, border: `1.5px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}` }}>
                  <div className="text-[12px] font-['Inter'] font-semibold" style={{ color: selected ? FEED_GOLD : FEED_TEXT }}>{a.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: FEED_MUTED }}>{a.hint}</div>
                </button>
              );
            })}
          </div>
          {accessMode === "tip" && (
            <div className="flex flex-wrap gap-2">
              {TIP_PRESETS.map((v) => (
                <button key={v} type="button" onClick={() => { setMinTip(v); setCustomTip(""); }}
                  className="px-3 py-2 rounded-xl text-[12px] font-['Inter'] font-medium"
                  style={{ background: minTip === v && !customTip ? "rgba(201,168,76,0.15)" : FEED_CARD, border: `1px solid ${minTip === v && !customTip ? "rgba(201,168,76,0.45)" : FEED_BORDER}`, color: minTip === v && !customTip ? FEED_GOLD : FEED_MUTED }}>
                  ₹{v}
                </button>
              ))}
              <input type="number" min={10} placeholder="Custom" value={customTip} onChange={(e) => setCustomTip(e.target.value)}
                className="w-20 px-3 py-2 rounded-xl text-[12px] font-['Inter'] outline-none"
                style={{ background: FEED_CARD, border: `1px solid ${customTip ? "rgba(201,168,76,0.45)" : FEED_BORDER}`, color: FEED_TEXT }} />
            </div>
          )}
        </div>

        <div className="rounded-xl p-4 space-y-3" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-['Inter'] font-medium">Schedule Post</div>
              <div className="text-[10px] mt-0.5" style={{ color: FEED_MUTED }}>Publish at a later time</div>
            </div>
            <button type="button" onClick={() => setScheduleEnabled((s) => !s)} className="w-11 h-6 rounded-full relative transition-colors"
              style={{ background: scheduleEnabled ? FEED_GOLD : "rgba(255,255,255,0.12)" }}>
              <div className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform"
                style={{ transform: scheduleEnabled ? "translateX(22px)" : "translateX(3px)" }} />
            </button>
          </div>
          {scheduleEnabled && (
            <input type="datetime-local" min={minScheduleLocal()} value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[13px] font-['Inter'] outline-none"
              style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }} />
          )}
        </div>

        <motion.button type="button" whileTap={{ scale: 0.98 }} disabled={shareDisabled} onClick={handleShare}
          className="w-full py-4 rounded-2xl text-[15px] font-['Inter'] font-semibold disabled:opacity-45 transition-opacity"
          style={{ background: `linear-gradient(135deg, ${FEED_GOLD}, #E8B14A)`, color: FEED_BG, boxShadow: "0 8px 28px rgba(201,168,76,0.32)" }}>
          {shareLabel}
        </motion.button>
      </div>

      <CreateDraftsSheet open={draftsOpen} onOpenChange={setDraftsOpen} onLoad={loadDraft} onSaveCurrent={handleSaveDraft} saving={saveDraft.isPending} />
      <BackgroundThemeSheet open={addonSheet === "background"} onOpenChange={(o) => !o && setAddonSheet(null)} value={backgroundTheme} onChange={setBackgroundTheme} />
      <PollSheet open={addonSheet === "poll"} onOpenChange={(o) => !o && setAddonSheet(null)} value={poll} onChange={setPoll} />
      <LocationSheet open={addonSheet === "location"} onOpenChange={(o) => !o && setAddonSheet(null)} value={location} onChange={setLocationTag} />
      <TagPeopleSheet open={addonSheet === "tag"} onOpenChange={(o) => !o && setAddonSheet(null)} value={taggedUserIds} onChange={setTaggedUserIds} />
    </div>
  );
}
