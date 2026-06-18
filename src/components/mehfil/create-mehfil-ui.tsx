import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  ChevronLeft,
  Gift,
  HandHeart,
  ImagePlus,
  Loader2,
  Mic,
  Music,
  Plus,
  Radio,
  Sparkles,
  MessageCircle,
  Type,
  Check,
  Lock,
  Pencil,
  Feather,
  Ticket,
  Users,
} from "lucide-react";
import {
  FEED_BG,
  FEED_BORDER,
  FEED_CARD,
  FEED_GOLD,
  FEED_MUTED,
  FEED_PURPLE,
  FEED_PURPLE_SOFT,
  FEED_TEXT,
} from "@/components/feed/home-feed-ui";
import type { MehfilEntryType } from "@/lib/mehfilCreateDraft";

export {
  FEED_BG,
  FEED_BORDER,
  FEED_CARD,
  FEED_GOLD,
  FEED_MUTED,
  FEED_PURPLE,
  FEED_PURPLE_SOFT,
  FEED_TEXT,
};

export const MEHFIL_TITLE_MAX = 60;
export const MEHFIL_DESC_MAX = 250;
export const MEHFIL_COVER_MAX_MB = 5;
export const MEHFIL_HIGHLIGHT_SLOTS = 3;
export const MEHFIL_MAX_SPEAKERS_DEFAULT = 5;
export const MEHFIL_MAX_SPEAKERS_MIN = 1;
export const MEHFIL_MAX_SPEAKERS_MAX = 20;

export const CREATE_STEPS = ["Details", "Date & Time", "Settings", "Review"] as const;
export type CreateMehfilStep = (typeof CREATE_STEPS)[number];

export const MEHFIL_CATEGORY_OPTIONS = [
  { id: "music" as const, label: "Music", icon: Music },
  { id: "spiritual" as const, label: "Spiritual", icon: Sparkles },
  { id: "talks" as const, label: "Talks", icon: MessageCircle },
  { id: "open-mic" as const, label: "Open Mic", icon: Mic },
];

export type MehfilCategoryId = (typeof MEHFIL_CATEGORY_OPTIONS)[number]["id"];

export const CATEGORY_TO_TAG: Record<MehfilCategoryId, string> = {
  music: "music",
  spiritual: "spiritual",
  talks: "talks",
  "open-mic": "open mic",
};

export const MOOD_OPTIONS = [
  { tag: "poetry", label: "Poetry" },
  { tag: "ghazal", label: "Ghazal" },
  { tag: "stories", label: "Stories" },
  { tag: "open mic", label: "Open Mic" },
  { tag: "late night", label: "Late Night" },
  { tag: "spoken word", label: "Spoken Word" },
] as const;

export const MEHFIL_DEFAULT_COVER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><radialGradient id="r" cx="42%" cy="35%" r="68%"><stop offset="0%" stop-color="#2a1420"/><stop offset="55%" stop-color="#0d0609"/><stop offset="100%" stop-color="#050308"/></radialGradient><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c9a84c" stop-opacity="0.14"/><stop offset="50%" stop-color="#8b2d4a" stop-opacity="0.12"/><stop offset="100%" stop-color="#1a0a10"/></linearGradient></defs><rect width="960" height="540" fill="url(#r)"/><rect width="960" height="540" fill="url(#g)"/></svg>`,
  );

export function CreateMehfilShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] w-full relative overflow-x-hidden font-['Inter']"
      style={{ background: FEED_BG, color: FEED_TEXT }}
    >
      <div
        className="fixed top-[-80px] right-[-30px] w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(155,89,182,0.16) 0%, transparent 70%)", filter: "blur(52px)" }}
      />
      <div
        className="fixed bottom-[80px] left-[-60px] w-[220px] h-[220px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)", filter: "blur(48px)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse_at_center, transparent 35%, rgba(0,0,0,0.55) 100%)" }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CreateMehfilHeader({
  onBack,
  onSaveDraft,
  onOpenDrafts,
  savingDraft,
}: {
  onBack: () => void;
  onSaveDraft: () => void;
  onOpenDrafts?: () => void;
  savingDraft?: boolean;
}) {
  return (
    <header className="px-5 pt-[max(12px,env(safe-area-inset-top))] pb-2 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}
        aria-label="Back"
      >
        <ChevronLeft size={18} style={{ color: FEED_TEXT }} />
      </button>
      <div className="flex items-center gap-2">
        {onOpenDrafts && (
          <button
            type="button"
            onClick={onOpenDrafts}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full"
            style={{ color: FEED_MUTED, border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}
          >
            Drafts
          </button>
        )}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={savingDraft}
          className="text-[13px] font-medium px-3 py-1.5 rounded-full disabled:opacity-50"
          style={{ color: FEED_GOLD, border: `1px solid rgba(201,168,76,0.35)`, background: "rgba(201,168,76,0.08)" }}
        >
          {savingDraft ? "Saving…" : "Save Draft"}
        </button>
      </div>
    </header>
  );
}

export function CreateMehfilHero() {
  return (
    <div className="px-5 pt-2 pb-5">
      <h1 className="font-['Playfair_Display'] text-[28px] leading-[1.12] tracking-[-0.02em]">
        Create a New Mehfil
      </h1>
      <p className="text-[13px] mt-2 leading-relaxed" style={{ color: FEED_MUTED }}>
        Share your mehfil. Start a soulful conversation.
      </p>
    </div>
  );
}

export function CreateMehfilStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="px-5 pb-6">
      <div className="flex items-start">
        {CREATE_STEPS.map((label, i) => {
          const active = i === activeIndex;
          const done = i < activeIndex;
          return (
            <div key={label} className="flex items-start flex-1 min-w-0 last:flex-none">
              <div className="flex flex-col items-center min-w-0 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                  style={{
                    background: active || done ? "linear-gradient(135deg, #C9A84C, #9B59B6)" : FEED_CARD,
                    border: `1px solid ${active || done ? "transparent" : FEED_BORDER}`,
                    color: active || done ? FEED_BG : FEED_MUTED,
                  }}
                >
                  {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                </div>
                <span
                  className="text-[9px] mt-1.5 text-center leading-tight px-0.5 truncate w-full"
                  style={{ color: active ? FEED_GOLD : FEED_MUTED }}
                >
                  {label}
                </span>
              </div>
              {i < CREATE_STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mt-3.5 mx-1 min-w-[12px]"
                  style={{
                    background: `repeating-linear-gradient(90deg, ${done ? FEED_GOLD : FEED_BORDER} 0, ${done ? FEED_GOLD : FEED_BORDER} 4px, transparent 4px, transparent 8px)`,
                    opacity: done ? 0.7 : 0.45,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(201,168,76,0.10)" }}
        >
          <Icon size={15} style={{ color: FEED_GOLD }} strokeWidth={1.75} />
        </div>
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      {children}
    </section>
  );
}

export function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <div className="text-[10px] tabular-nums text-right mt-1" style={{ color: FEED_MUTED }}>
      {current}/{max}
    </div>
  );
}

export function MehfilTextInput({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
    >
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-transparent text-[15px] outline-none placeholder:opacity-40"
        style={{ color: FEED_TEXT }}
      />
    </div>
  );
}

export function MehfilTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  rows?: number;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3 relative"
      style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
    >
      <Pencil size={13} className="absolute top-3 right-3 opacity-25 pointer-events-none" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-transparent text-[14px] leading-relaxed outline-none resize-none placeholder:opacity-40 pr-6"
        style={{ color: FEED_TEXT }}
      />
    </div>
  );
}

export function CategoryCards({
  value,
  onChange,
}: {
  value: MehfilCategoryId;
  onChange: (v: MehfilCategoryId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {MEHFIL_CATEGORY_OPTIONS.map(({ id, label, icon: Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl min-w-[88px] transition-colors"
            style={{
              background: selected ? "rgba(201,168,76,0.12)" : FEED_CARD,
              border: `1px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
              color: selected ? FEED_TEXT : FEED_MUTED,
            }}
          >
            <Icon size={20} style={{ color: selected ? FEED_GOLD : FEED_MUTED }} strokeWidth={1.5} />
            <span className="text-[12px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CoverUploadArea({
  preview,
  uploading,
  onSelectFile,
}: {
  preview: string | null;
  uploading: boolean;
  onSelectFile: () => void;
}) {
  const display = preview || MEHFIL_DEFAULT_COVER;
  return (
    <div
      className="rounded-2xl overflow-hidden flex"
      style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD, minHeight: 120 }}
    >
      <div className="relative w-[42%] shrink-0 aspect-video">
        <img src={display} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 size={22} className="animate-spin" style={{ color: FEED_GOLD }} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSelectFile}
        disabled={uploading}
        className="flex-1 flex flex-col items-center justify-center gap-2 px-3 py-4 disabled:opacity-60"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(201,168,76,0.12)", border: `1px dashed rgba(201,168,76,0.35)` }}
        >
          <ImagePlus size={18} style={{ color: FEED_GOLD }} />
        </div>
        <span className="text-[13px] font-medium" style={{ color: FEED_GOLD }}>
          Upload Image
        </span>
        <span className="text-[10px] text-center leading-snug" style={{ color: FEED_MUTED }}>
          Recommended 16:9
          <br />
          Max size {MEHFIL_COVER_MAX_MB}MB
        </span>
      </button>
    </div>
  );
}

export function EntryTypeCards({
  value,
  onChange,
  ticketPrice,
  onTicketPriceChange,
}: {
  value: MehfilEntryType;
  onChange: (v: MehfilEntryType) => void;
  ticketPrice: number;
  onTicketPriceChange: (v: number) => void;
}) {
  const options: { id: MehfilEntryType; label: string; hint: string; icon: LucideIcon }[] = [
    { id: "free", label: "Entry Free", hint: "Open to everyone", icon: Gift },
    { id: "tip", label: "Tip Based", hint: "Support with a tip", icon: HandHeart },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {options.map(({ id, label, hint, icon: Icon }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="rounded-2xl p-4 text-left transition-colors"
              style={{
                background: selected ? "rgba(201,168,76,0.10)" : FEED_CARD,
                border: `1px solid ${selected ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
              }}
            >
              <Icon
                size={20}
                className="mb-2"
                style={{ color: selected ? FEED_GOLD : FEED_MUTED }}
                strokeWidth={1.5}
              />
              <div className="text-[14px] font-medium mb-0.5">{label}</div>
              <div className="text-[11px]" style={{ color: FEED_MUTED }}>
                {hint}
              </div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange("ticket")}
        className="w-full rounded-2xl p-4 text-left transition-colors"
        style={{
          background: value === "ticket" ? "rgba(201,168,76,0.10)" : FEED_CARD,
          border: `1px solid ${value === "ticket" ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
        }}
      >
        <Ticket
          size={20}
          className="mb-2"
          style={{ color: value === "ticket" ? FEED_GOLD : FEED_MUTED }}
          strokeWidth={1.5}
        />
        <div className="text-[14px] font-medium mb-0.5">Paid Ticket</div>
        <div className="text-[11px]" style={{ color: FEED_MUTED }}>
          Set an entry price for listeners
        </div>
      </button>
      {value === "ticket" && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
        >
          <span className="text-[13px] shrink-0" style={{ color: FEED_MUTED }}>
            Ticket price (₹)
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={ticketPrice || ""}
            onChange={(e) => onTicketPriceChange(Math.max(0, Number(e.target.value) || 0))}
            placeholder="e.g. 99"
            className="flex-1 bg-transparent text-[15px] outline-none text-right"
            style={{ color: FEED_TEXT }}
          />
        </div>
      )}
    </div>
  );
}

export function HighlightsEditor({
  highlights,
  onChange,
}: {
  highlights: string[];
  onChange: (v: string[]) => void;
}) {
  const addSlot = () => {
    if (highlights.length >= MEHFIL_HIGHLIGHT_SLOTS) return;
    onChange([...highlights, ""]);
  };

  const updateAt = (index: number, text: string) => {
    const next = [...highlights];
    next[index] = text.slice(0, 80);
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(highlights.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {highlights.map((h, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={h}
            onChange={(e) => updateAt(i, e.target.value)}
            placeholder={`Highlight ${i + 1}`}
            className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none"
            style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-[11px] px-2 shrink-0"
            style={{ color: FEED_MUTED }}
          >
            Remove
          </button>
        </div>
      ))}
      {highlights.length < MEHFIL_HIGHLIGHT_SLOTS && (
        <button
          type="button"
          onClick={addSlot}
          className="flex items-center gap-1.5 text-[12px] font-medium px-1 py-1"
          style={{ color: FEED_GOLD }}
        >
          <Plus size={14} />
          Add highlight
        </button>
      )}
    </div>
  );
}

export function DateTimeStep({
  startsNow,
  onStartsNowChange,
  startsAt,
  onStartsAtChange,
}: {
  startsNow: boolean;
  onStartsNowChange: (v: boolean) => void;
  startsAt: string;
  onStartsAtChange: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection icon={Radio} title="When do you want to start?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onStartsNowChange(true)}
            className="rounded-2xl p-4 text-left"
            style={{
              background: startsNow ? "rgba(201,168,76,0.10)" : FEED_CARD,
              border: `1px solid ${startsNow ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
            }}
          >
            <Radio size={18} className="mb-2" style={{ color: startsNow ? FEED_GOLD : FEED_MUTED }} />
            <div className="font-['Playfair_Display'] text-[16px] mb-1">Start now</div>
            <div className="text-[11px]" style={{ color: FEED_MUTED }}>
              Begin whenever you&apos;re ready
            </div>
          </button>
          <button
            type="button"
            onClick={() => onStartsNowChange(false)}
            className="rounded-2xl p-4 text-left"
            style={{
              background: !startsNow ? "rgba(201,168,76,0.10)" : FEED_CARD,
              border: `1px solid ${!startsNow ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
            }}
          >
            <Calendar size={18} className="mb-2" style={{ color: !startsNow ? FEED_GOLD : FEED_MUTED }} />
            <div className="font-['Playfair_Display'] text-[16px] mb-1">Schedule for later</div>
            <div className="text-[11px]" style={{ color: FEED_MUTED }}>
              Pick a date &amp; time to gather people
            </div>
          </button>
        </div>
        {!startsNow && (
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => onStartsAtChange(e.target.value)}
            className="w-full rounded-xl px-4 py-3.5 text-[13px] outline-none mt-3"
            style={{
              background: FEED_CARD,
              border: `1px solid ${FEED_BORDER}`,
              color: FEED_TEXT,
              colorScheme: "dark",
            }}
          />
        )}
      </FormSection>
      <div className="flex items-center justify-center gap-2 text-[10.5px] text-center leading-snug max-w-[17rem] mx-auto" style={{ color: FEED_MUTED }}>
        <Lock size={11} strokeWidth={1.65} className="shrink-0 opacity-70" />
        <span>You can edit all details anytime before going live</span>
      </div>
    </div>
  );
}

export function SettingsStep({
  sessionMode,
  onSessionModeChange,
  language,
  onLanguageChange,
  selectedTags,
  onToggleTag,
  maxSpeakers,
  onMaxSpeakersChange,
}: {
  sessionMode: "voice" | "studio";
  onSessionModeChange: (v: "voice" | "studio") => void;
  language: "or" | "hi";
  onLanguageChange: (v: "or" | "hi") => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  maxSpeakers: number;
  onMaxSpeakersChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection icon={Mic} title="Gathering mode">
        <div className="flex gap-2">
          {(["voice", "studio"] as const).map((mode) => {
            const on = sessionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSessionModeChange(mode)}
                className="flex-1 py-3 rounded-xl text-[12px] tracking-wide"
                style={{
                  border: `1px solid ${on ? "rgba(201,168,76,0.45)" : FEED_BORDER}`,
                  background: on ? "rgba(201,168,76,0.10)" : FEED_CARD,
                  color: on ? FEED_TEXT : FEED_MUTED,
                }}
              >
                {mode === "voice" ? "Voice salon" : "Studio Mehfil"}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed px-0.5" style={{ color: FEED_MUTED }}>
          Studio opens optional camera — voice stays intimate without video.
        </p>
      </FormSection>

      <FormSection icon={Users} title="Max speakers">
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
        >
          <input
            type="number"
            min={MEHFIL_MAX_SPEAKERS_MIN}
            max={MEHFIL_MAX_SPEAKERS_MAX}
            value={maxSpeakers}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onMaxSpeakersChange(Math.min(MEHFIL_MAX_SPEAKERS_MAX, Math.max(MEHFIL_MAX_SPEAKERS_MIN, n)));
            }}
            className="w-16 bg-transparent text-[15px] outline-none text-center font-medium"
            style={{ color: FEED_TEXT }}
          />
          <span className="text-[12px] flex-1" style={{ color: FEED_MUTED }}>
            Speakers can join the stage (1–{MEHFIL_MAX_SPEAKERS_MAX})
          </span>
        </div>
      </FormSection>

      <FormSection icon={Type} title="Language">
        <div className="flex rounded-xl p-1" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
          {(["or", "hi"] as const).map((l) => {
            const on = language === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => onLanguageChange(l)}
                className="relative flex-1 py-2.5 rounded-lg text-[15px] font-['Playfair_Display'] flex items-center justify-center gap-2"
                style={{ color: on ? FEED_TEXT : FEED_MUTED }}
              >
                {on && (
                  <span
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: "linear-gradient(165deg, rgba(201,168,76,0.12), rgba(155,89,182,0.08))",
                      border: "1px solid rgba(201,168,76,0.25)",
                    }}
                  />
                )}
                <span className="relative z-[1]">{l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}</span>
                {on && <Check size={14} className="relative z-[1]" style={{ color: FEED_GOLD }} />}
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection icon={Feather} title="Moods (select up to 3)">
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(({ tag, label }) => {
            const sel = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className="px-3.5 py-2 rounded-full text-[12px] border flex items-center gap-1.5"
                style={{
                  borderColor: sel ? "rgba(201,168,76,0.35)" : FEED_BORDER,
                  background: sel ? "rgba(201,168,76,0.10)" : FEED_CARD,
                  color: sel ? FEED_TEXT : FEED_MUTED,
                }}
              >
                {sel && <Check size={12} style={{ color: FEED_GOLD }} />}
                {label}
              </button>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

type ReviewProps = {
  title: string;
  description: string;
  category: MehfilCategoryId;
  coverPreview: string | null;
  entryType: MehfilEntryType;
  ticketPrice: number;
  highlights: string[];
  startsNow: boolean;
  startsAt: string;
  sessionMode: "voice" | "studio";
  language: "or" | "hi";
  selectedTags: string[];
  maxSpeakers: number;
};

function entryLabel(entryType: MehfilEntryType, ticketPrice: number): string {
  if (entryType === "ticket") return `Paid ticket · ₹${ticketPrice || 0}`;
  if (entryType === "tip") return "Tip based";
  return "Entry free";
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-[13px]" style={{ borderBottom: `1px solid ${FEED_BORDER}` }}>
      <span style={{ color: FEED_MUTED }}>{label}</span>
      <span className="text-right font-medium max-w-[58%] truncate">{value}</span>
    </div>
  );
}

export function ReviewStep(props: ReviewProps) {
  const catLabel = MEHFIL_CATEGORY_OPTIONS.find((c) => c.id === props.category)?.label ?? props.category;
  const when = props.startsNow
    ? "Start now"
    : new Date(props.startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const tags = props.selectedTags.filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <FormSection icon={Check} title="Review your mehfil">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}
        >
          <div className="aspect-video w-full">
            <img
              src={props.coverPreview || MEHFIL_DEFAULT_COVER}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-4 py-3">
            <div className="font-['Playfair_Display'] text-[18px] mb-1">{props.title || "Untitled mehfil"}</div>
            {props.description && (
              <p className="text-[12px] leading-relaxed line-clamp-3" style={{ color: FEED_MUTED }}>
                {props.description}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl px-4 mt-3" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
          <ReviewRow label="Category" value={catLabel} />
          <ReviewRow label="Entry" value={entryLabel(props.entryType, props.ticketPrice)} />
          <ReviewRow label="When" value={when} />
          <ReviewRow label="Mode" value={props.sessionMode === "voice" ? "Voice salon" : "Studio Mehfil"} />
          <ReviewRow label="Language" value={props.language === "or" ? "Odia" : "Hindi"} />
          <ReviewRow label="Max speakers" value={String(props.maxSpeakers)} />
          {tags && <ReviewRow label="Tags" value={tags} />}
          {props.highlights.filter(Boolean).length > 0 && (
            <ReviewRow label="Highlights" value={props.highlights.filter(Boolean).join(" · ")} />
          )}
        </div>
      </FormSection>
    </div>
  );
}

export function CreateMehfilFooter({
  label,
  disabled,
  loading,
  onClick,
  type = "button",
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 pointer-events-none"
      style={{ background: "linear-gradient(180deg, transparent, rgba(10,8,6,0.92) 40%)" }}
    >
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className="pointer-events-auto w-full max-w-[480px] mx-auto block py-3.5 rounded-full text-[15px] font-semibold disabled:opacity-40 transition-opacity"
        style={{
          background: "linear-gradient(90deg, #C9A84C 0%, #9B59B6 100%)",
          color: FEED_BG,
          boxShadow: "0 8px 32px rgba(155,89,182,0.35)",
        }}
      >
        {loading ? "Creating…" : label}
      </button>
    </div>
  );
}

export function DetailsStep(props: {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  category: MehfilCategoryId;
  onCategoryChange: (v: MehfilCategoryId) => void;
  coverPreview: string | null;
  coverUploading: boolean;
  onCoverSelect: () => void;
  entryType: MehfilEntryType;
  onEntryTypeChange: (v: MehfilEntryType) => void;
  ticketPrice: number;
  onTicketPriceChange: (v: number) => void;
  highlights: string[];
  onHighlightsChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection icon={Type} title="Mehfil Title">
        <MehfilTextInput
          id="mehfil-title"
          value={props.title}
          onChange={props.onTitleChange}
          placeholder="Give your mehfil a name"
          maxLength={MEHFIL_TITLE_MAX}
        />
        <CharCounter current={props.title.length} max={MEHFIL_TITLE_MAX} />
      </FormSection>

      <FormSection icon={Pencil} title="Description">
        <MehfilTextarea
          value={props.description}
          onChange={props.onDescriptionChange}
          placeholder="Describe the atmosphere, theme, or what listeners can expect…"
          maxLength={MEHFIL_DESC_MAX}
        />
        <CharCounter current={props.description.length} max={MEHFIL_DESC_MAX} />
      </FormSection>

      <FormSection icon={Music} title="Category">
        <CategoryCards value={props.category} onChange={props.onCategoryChange} />
      </FormSection>

      <FormSection icon={ImagePlus} title="Cover Image">
        <CoverUploadArea
          preview={props.coverPreview}
          uploading={props.coverUploading}
          onSelectFile={props.onCoverSelect}
        />
      </FormSection>

      <FormSection icon={Gift} title="Entry Type">
        <EntryTypeCards
          value={props.entryType}
          onChange={props.onEntryTypeChange}
          ticketPrice={props.ticketPrice}
          onTicketPriceChange={props.onTicketPriceChange}
        />
      </FormSection>

      <FormSection icon={Plus} title="Short Highlights (Optional)">
        <HighlightsEditor highlights={props.highlights} onChange={props.onHighlightsChange} />
      </FormSection>
    </div>
  );
}
