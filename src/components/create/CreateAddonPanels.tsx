import { useEffect, useState } from "react";
import { MapPin, Navigation, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { POST_BACKGROUND_THEMES } from "@/lib/postThemes";
import type { CreateDraft, CreateLocation, CreatePollDraft } from "@/lib/createDraft";
import type { PostBackgroundTheme } from "@/lib/postThemes";
import { searchUsersForTag, type User } from "@/lib/store";
import { FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_TEXT } from "@/components/feed/home-feed-ui";
import { toast } from "sonner";

const inputCls = "w-full rounded-xl px-4 py-3 text-[14px] font-['Inter'] outline-none";
const inputStyle = { background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT };

type SheetProps = { open: boolean; onOpenChange: (v: boolean) => void };

export function BackgroundThemeSheet({
  open, onOpenChange, value, onChange,
}: SheetProps & { value?: PostBackgroundTheme; onChange: (t: PostBackgroundTheme) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl" style={{ background: "#0A0806", color: FEED_TEXT }}>
        <SheetHeader><SheetTitle className="font-['Playfair_Display'] text-left" style={{ color: FEED_TEXT }}>Background</SheetTitle></SheetHeader>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {POST_BACKGROUND_THEMES.map((t) => (
            <button key={t.id} type="button" onClick={() => { onChange(t.id); onOpenChange(false); }}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl"
              style={{ border: `2px solid ${value === t.id ? FEED_GOLD : "transparent"}` }}>
              <div className="w-full aspect-square rounded-lg" style={{ background: t.preview }} />
              <span className="text-[9px] font-['Inter']" style={{ color: FEED_MUTED }}>{t.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PollSheet({
  open, onOpenChange, value, onChange,
}: SheetProps & { value?: CreatePollDraft; onChange: (p: CreatePollDraft | undefined) => void }) {
  const [question, setQuestion] = useState(value?.question ?? "");
  const [options, setOptions] = useState<string[]>(value?.options ?? ["", ""]);

  useEffect(() => {
    if (open) {
      setQuestion(value?.question ?? "");
      setOptions(value?.options?.length ? [...value.options] : ["", ""]);
    }
  }, [open, value]);

  const save = () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) {
      toast.error("Add a question and at least 2 options");
      return;
    }
    onChange({ question: question.trim(), options: opts });
    onOpenChange(false);
    toast.success("Poll added");
  };

  const clear = () => {
    onChange(undefined);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto" style={{ background: "#0A0806", color: FEED_TEXT }}>
        <SheetHeader><SheetTitle className="font-['Playfair_Display'] text-left" style={{ color: FEED_TEXT }}>Poll</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question…" maxLength={120} className={inputCls} style={inputStyle} />
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input value={o} onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Option ${i + 1}`} maxLength={60} className={inputCls} style={inputStyle} />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))} className="p-3"><X size={14} style={{ color: FEED_MUTED }} /></button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button type="button" onClick={() => setOptions((a) => [...a, ""])} className="flex items-center gap-1 text-[12px]" style={{ color: FEED_GOLD }}>
              <Plus size={14} /> Add option
            </button>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={clear} className="flex-1 py-3 rounded-xl text-[13px]" style={{ border: `1px solid ${FEED_BORDER}`, color: FEED_MUTED }}>Remove</button>
            <button type="button" onClick={save} className="flex-1 py-3 rounded-xl text-[13px] font-medium" style={{ background: FEED_GOLD, color: "#0A0806" }}>Save poll</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LocationSheet({
  open, onOpenChange, value, onChange,
}: SheetProps & { value?: CreateLocation; onChange: (loc: CreateLocation | undefined) => void }) {
  const [name, setName] = useState(value?.name ?? "");
  const [lat, setLat] = useState(value?.lat != null ? String(value.lat) : "");
  const [lng, setLng] = useState(value?.lng != null ? String(value.lng) : "");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (open) {
      setName(value?.name ?? "");
      setLat(value?.lat != null ? String(value.lat) : "");
      setLng(value?.lng != null ? String(value.lng) : "");
    }
  }, [open, value]);

  const useGeolocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        if (!name.trim()) setName("Current location");
        setLocating(false);
        toast.success("Location captured");
      },
      () => { setLocating(false); toast.error("Could not get location"); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const save = () => {
    if (!name.trim()) { toast.error("Enter a location name"); return; }
    onChange({
      name: name.trim(),
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });
    onOpenChange(false);
    toast.success("Location added");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl" style={{ background: "#0A0806", color: FEED_TEXT }}>
        <SheetHeader><SheetTitle className="font-['Playfair_Display'] text-left flex items-center gap-2" style={{ color: FEED_TEXT }}><MapPin size={16} /> Location</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name…" className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (optional)" className={inputCls} style={inputStyle} />
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude (optional)" className={inputCls} style={inputStyle} />
          </div>
          <button type="button" disabled={locating} onClick={useGeolocation}
            className="w-full py-3 rounded-xl text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ border: `1px solid ${FEED_BORDER}`, color: FEED_GOLD }}>
            <Navigation size={14} /> {locating ? "Locating…" : "Use my location"}
          </button>
          <button type="button" onClick={save} className="w-full py-3 rounded-xl text-[13px] font-medium" style={{ background: FEED_GOLD, color: "#0A0806" }}>Save location</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TagPeopleSheet({
  open, onOpenChange, value, onChange,
}: SheetProps & { value?: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setSelected(value ?? []); }, [open, value]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      searchUsersForTag(query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 10 ? s : [...s, id]));
  };

  const save = () => {
    onChange(selected);
    onOpenChange(false);
    toast.success(selected.length ? `Tagged ${selected.length} people` : "Tags cleared");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto" style={{ background: "#0A0806", color: FEED_TEXT }}>
        <SheetHeader><SheetTitle className="font-['Playfair_Display'] text-left" style={{ color: FEED_TEXT }}>Tag people</SheetTitle></SheetHeader>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or handle…" className={`${inputCls} mt-4`} style={inputStyle} />
        <div className="mt-3 space-y-1">
          {loading && <p className="text-[11px]" style={{ color: FEED_MUTED }}>Searching…</p>}
          {results.map((u) => {
            const on = selected.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left"
                style={{ background: on ? "rgba(201,168,76,0.1)" : FEED_CARD, border: `1px solid ${on ? "rgba(201,168,76,0.35)" : FEED_BORDER}` }}>
                <img src={u.avatarUrl || "/avatar-placeholder.png"} alt="" className="w-8 h-8 rounded-full object-cover bg-white/10" />
                <div className="min-w-0">
                  <div className="text-[13px] font-['Inter'] truncate">{u.displayName}</div>
                  <div className="text-[10px]" style={{ color: FEED_MUTED }}>@{u.handle}</div>
                </div>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="text-[11px] mt-3" style={{ color: FEED_GOLD }}>{selected.length} selected</p>
        )}
        <button type="button" onClick={save} className="w-full mt-4 py-3 rounded-xl text-[13px] font-medium" style={{ background: FEED_GOLD, color: "#0A0806" }}>Done</button>
      </SheetContent>
    </Sheet>
  );
}

/** Apply a loaded DB draft onto create-hub state setters */
export function applyDraftToHub(draft: CreateDraft, setters: {
  setPostType: (t: CreateDraft["postType"]) => void;
  setTitle: (s: string) => void;
  setBody: (s: string) => void;
  setVisibility: (v: CreateDraft["visibility"]) => void;
  setAccessMode: (m: "free" | "tip") => void;
  setMinTip: (n: number) => void;
  setCustomTip: (s: string) => void;
  setScheduleEnabled: (b: boolean) => void;
  setScheduledAt: (s: string) => void;
  setCoverUrl: (s: string | null) => void;
  setCoverPreview: (s: string | null) => void;
  setBackgroundTheme: (t: PostBackgroundTheme | undefined) => void;
  setPoll: (p: CreatePollDraft | undefined) => void;
  setLocation: (l: CreateLocation | undefined) => void;
  setTaggedUserIds: (ids: string[]) => void;
  setHubAudioUrl: (s: string | undefined) => void;
  setHubAudioDuration: (n: number | undefined) => void;
  setHubVideoUrl: (s: string | undefined) => void;
}) {
  setters.setPostType(draft.postType);
  setters.setTitle(draft.title ?? "");
  setters.setBody(draft.body ?? "");
  setters.setVisibility(draft.visibility ?? (draft.isPrivate ? "private" : "public"));
  setters.setAccessMode(draft.accessType === "tip" ? "tip" : "free");
  if (draft.minTip) setters.setMinTip(draft.minTip);
  setters.setCustomTip("");
  setters.setScheduleEnabled(!!draft.scheduledAt);
  setters.setScheduledAt(draft.scheduledAt ?? "");
  if (draft.coverUrl) { setters.setCoverUrl(draft.coverUrl); setters.setCoverPreview(draft.coverUrl); }
  setters.setBackgroundTheme(draft.backgroundTheme);
  setters.setPoll(draft.poll);
  setters.setLocation(draft.location);
  setters.setTaggedUserIds(draft.taggedUserIds ?? []);
  setters.setHubAudioUrl(draft.audioUrl);
  setters.setHubAudioDuration(draft.audioDurationSec);
  setters.setHubVideoUrl(draft.videoUrl);
}
