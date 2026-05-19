/**
 * Premium “prepare the mehfil” creation shell — visual layer only; submits via existing useCreateMehfil payload shape.
 */
import { useMemo, useState } from "react";
import { MehfilStudioPreflight } from "@/features/mehfil/MehfilStudioPreflight";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Feather,
  Pencil,
  Calendar,
  Radio,
  Check,
  Lock,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useCreateMehfil, getCurrentUserId } from "@/lib/store";
import type { Mehfil } from "@/lib/store";
import { toast } from "sonner";

const ATMOSPHERE_MAX = 160;

/** Fixed atmospheric plate — no user picker (SVG gradient data URI). */
const MEHFIL_DEFAULT_COVER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><radialGradient id="r" cx="42%" cy="35%" r="68%"><stop offset="0%" stop-color="#2a1420"/><stop offset="55%" stop-color="#0d0609"/><stop offset="100%" stop-color="#050308"/></radialGradient><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c9a84c" stop-opacity="0.14"/><stop offset="50%" stop-color="#8b2d4a" stop-opacity="0.12"/><stop offset="100%" stop-color="#1a0a10"/></linearGradient></defs><rect width="960" height="540" fill="url(#r)"/><rect width="960" height="540" fill="url(#g)"/></svg>`,
  );

const MOODS = [
  { tag: "poetry", label: "Poetry" },
  { tag: "ghazal", label: "Ghazal" },
  { tag: "stories", label: "Stories" },
  { tag: "open mic", label: "Open Mic" },
  { tag: "late night", label: "Late Night" },
  { tag: "spoken word", label: "Spoken Word" },
] as const;

const IVORY = "#f5f3ef";
const GOLD = "#d4b878";
/** Editorial accent labels — restrained vs bright chrome */
const GOLD_LABEL = "rgba(212,184,120,0.38)";
const GOLD_WHISPER = "rgba(212,184,120,0.22)";
/** Shared tactile easing — calm release, no snappy UI curves */
const EASE_SOFT = [0.22, 1, 0.36, 1] as const;
const EASE_ORB = [0.33, 1, 0.52, 1] as const;

export function PrepareMehfilForm() {
  useTitle("Prepare the mehfil");
  const [, setLocation] = useLocation();
  const create = useCreateMehfil();
  const me = getCurrentUserId();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState<"voice" | "studio">("voice");
  const [startsNow, setStartsNow] = useState(true);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [preflightMehfil, setPreflightMehfil] = useState<{ id: string; title: string } | null>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${8 + ((i * 37) % 84)}%`,
        top: `${10 + ((i * 53) % 80)}%`,
        dur: 10 + (i % 6),
        delay: (i % 5) * 0.7,
      })),
    [],
  );

  const toggleMood = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) {
        toast.message("Choose up to three moods");
        return prev;
      }
      return [...prev, tag];
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!me) {
      toast.error("Please sign in to host a Mehfil");
      setLocation("/auth/login");
      return;
    }
    const payload: Omit<Mehfil, "id" | "listeners" | "isLive"> = {
      hostId: me,
      title: title.trim(),
      description,
      coverUrl: MEHFIL_DEFAULT_COVER,
      language,
      tags: selectedTags,
      startsAt: startsNow ? new Date().toISOString() : new Date(startsAt).toISOString(),
      sessionMode,
    };
    create.mutate(payload, {
      onSuccess: (m) => {
        toast.success("Mehfil created");
        if (sessionMode === "studio") {
          setPreflightMehfil({ id: m.id, title: m.title });
        } else {
          setLocation(`/mehfil/${m.id}`);
        }
      },
      onError: (err: Error) => toast.error(`Could not create Mehfil: ${err.message}`),
    });
  };

  const descLen = description.length;

  if (preflightMehfil) {
    return (
      <MehfilStudioPreflight
        mehfilTitle={preflightMehfil.title}
        onBack={() => setPreflightMehfil(null)}
        onEnter={() => setLocation(`/mehfil/${preflightMehfil.id}`)}
      />
    );
  }

  return (
    <div
      className="min-h-[100dvh] w-full text-[color:var(--pv-ivory)] relative overflow-x-hidden font-['Inter']"
      style={{
        ["--pv-ivory" as string]: IVORY,
        background: "#020103",
      }}
    >
      {/* Depth: wine wash · fog · gold veil · vignette · floor fade */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_-12%,rgba(72,22,38,0.22),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_108%,rgba(8,4,10,0.55),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_42%,rgba(180,160,190,0.04),transparent_72%)] blur-[48px] opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_82%_88%,rgba(201,168,76,0.035),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(0,0,0,0.72)_88%,rgba(0,0,0,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_38%,rgba(4,2,5,0.94)_100%)]" />

      {/* Drift particles — softer diffusion */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full blur-[1px]"
            style={{
              left: p.left,
              top: p.top,
              width: 3,
              height: 3,
              background: `rgba(232,218,195,${0.08 + (p.id % 5) * 0.035})`,
              boxShadow: `0 0 ${14 + p.id}px rgba(212,184,120,0.08)`,
            }}
            animate={{ y: [0, -10, 3, 0], opacity: [0.18, 0.42, 0.26, 0.18] }}
            transition={{
              duration: p.dur + 2,
              repeat: Infinity,
              ease: EASE_ORB,
              delay: p.delay,
            }}
          />
        ))}
      </div>

      <form onSubmit={submit} className="relative z-10 flex flex-col min-h-[100dvh] pb-[max(7rem,env(safe-area-inset-bottom))]">
        {/* Floating header */}
        <header className="px-5 pt-[max(14px,env(safe-area-inset-top))] pb-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setLocation("/mehfil")}
            className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.035] backdrop-blur-md flex items-center justify-center transition-transform duration-500 ease-out active:scale-[0.96]"
            aria-label="Back"
          >
            <ChevronLeft size={20} className="opacity-80" />
          </button>
          <div className="space-y-2">
            <h1 className="font-['Playfair_Display'] text-[26px] sm:text-[28px] leading-[1.15] tracking-[-0.02em] text-[color:var(--pv-ivory)] opacity-[0.96]">
              Prepare the mehfil
            </h1>
            <p className="text-[12px] sm:text-[13px] leading-[1.65] tracking-[0.02em] max-w-[19rem] text-[rgba(245,243,239,0.34)] font-light">
              A room for voices, silence and stories.
            </p>
            <div className="pt-1 text-[10px] tracking-[0.35em] text-[rgba(245,243,239,0.22)]">✦</div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center px-5 gap-11 sm:gap-12">
          {/* Hero orb */}
          <div className="relative flex flex-col items-center w-full max-w-[380px]">
            <motion.div
              className="relative rounded-full p-[2.5px]"
              animate={{
                scale: [1, 1.008, 1],
                opacity: [0.94, 0.99, 0.94],
              }}
              transition={{ duration: 8.5, repeat: Infinity, ease: EASE_ORB }}
              style={{
                background:
                  "conic-gradient(from 218deg, rgba(212,184,120,0.38), rgba(232,130,150,0.22), rgba(90,28,42,0.42), rgba(212,184,120,0.32))",
                boxShadow:
                  "0 0 80px rgba(42,16,28,0.28), 0 0 140px rgba(201,168,76,0.04), inset 0 0 52px rgba(255,255,255,0.025)",
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 96, repeat: Infinity, ease: "linear" }}
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(255,228,210,0.085) 48deg, transparent 92deg, transparent 360deg)",
                  opacity: 0.55,
                }}
              />
              <div
                className="relative w-[min(82vw,300px)] aspect-square rounded-full overflow-hidden flex flex-col items-center justify-center px-6"
                style={{
                  background:
                    "radial-gradient(circle at 36% 30%, rgba(48,22,34,0.92), rgba(10,6,12,0.97) 52%, rgba(3,2,5,0.99) 100%)",
                  boxShadow:
                    "inset 0 0 100px rgba(0,0,0,0.72), inset 0 -24px 48px rgba(0,0,0,0.45)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-full opacity-55"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 38%, rgba(212,184,120,0.06), transparent 58%)",
                  }}
                />
                {/* Waveform */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 flex items-end justify-center gap-[3px] h-12 opacity-[0.32] pointer-events-none">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="inline-block w-[2px] rounded-full bg-gradient-to-t from-transparent to-amber-100/55 origin-bottom align-middle"
                      style={{ height: 28 }}
                      animate={{ scaleY: [0.22, 1, 0.4, 0.78, 0.38][i % 5] }}
                      transition={{
                        duration: 1 + (i % 7) * 0.07,
                        repeat: Infinity,
                        repeatType: "mirror",
                        delay: i * 0.045,
                        ease: EASE_SOFT,
                      }}
                    />
                  ))}
                </div>

                <div className="relative z-[1] flex flex-col items-center gap-3 w-full mt-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[rgba(248,113,113,0.72)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400/45 opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500/85" />
                    </span>
                    LIVE
                  </div>

                  <label
                    htmlFor="mehfil-title-prepare"
                    className="text-[10px] uppercase tracking-[0.26em] text-[rgba(245,243,239,0.26)] mb-0.5 font-['Inter'] cursor-text"
                  >
                    Name your mehfil
                  </label>
                  <textarea
                    id="mehfil-title-prepare"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    rows={2}
                    placeholder="Give your mehfil a title"
                    maxLength={120}
                    className="w-full bg-transparent text-center font-['Playfair_Display'] text-[22px] sm:text-[26px] leading-snug outline-none border-none resize-none placeholder:text-white/[0.22] text-[rgba(245,243,239,0.93)] caret-amber-200/70"
                  />
                  <Feather size={17} className="opacity-[0.38]" style={{ color: GOLD_WHISPER }} strokeWidth={1.15} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Atmosphere — secondary hierarchy vs orb title */}
          <section className="w-full max-w-[420px] space-y-2.5">
            <div className="text-[10px] uppercase tracking-[0.28em] font-medium" style={{ color: GOLD_LABEL }}>
              Describe the atmosphere
            </div>
            <div className="relative rounded-[22px] overflow-hidden border border-white/[0.065] bg-white/[0.028] backdrop-blur-xl shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  boxShadow: "inset 0 1px 0 rgba(212,184,120,0.12)",
                }}
              />
              <Pencil size={14} className="absolute top-3.5 right-3.5 opacity-[0.2] pointer-events-none" />
              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, ATMOSPHERE_MAX))
                }
                placeholder="A space to share words, music and meaningful conversations…"
                rows={4}
                className="relative w-full bg-transparent px-4 py-4 pr-10 pb-8 text-[13.5px] leading-[1.72] outline-none resize-none placeholder:text-white/[0.22] text-[rgba(245,243,239,0.68)] tracking-[0.01em]"
              />
              <div className="absolute bottom-2.5 right-3 text-[10px] tabular-nums text-[rgba(245,243,239,0.28)] tracking-wide">
                {descLen}/{ATMOSPHERE_MAX}
              </div>
            </div>
          </section>

          {/* Voice vs Studio */}
          <section className="w-full max-w-[420px] space-y-2.5">
            <div className="text-[10px] uppercase tracking-[0.28em] font-medium" style={{ color: GOLD_LABEL }}>
              Gathering mode
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSessionMode("voice")}
                className="flex-1 py-3 rounded-[18px] text-[12px] font-['Inter'] tracking-wide transition-colors border"
                style={{
                  borderColor: sessionMode === "voice" ? "rgba(212,184,120,0.45)" : "rgba(255,255,255,0.06)",
                  background: sessionMode === "voice" ? "rgba(212,184,120,0.09)" : "rgba(255,255,255,0.03)",
                  color: sessionMode === "voice" ? IVORY : "rgba(245,243,239,0.42)",
                }}
              >
                Voice salon
              </button>
              <button
                type="button"
                onClick={() => setSessionMode("studio")}
                className="flex-1 py-3 rounded-[18px] text-[12px] font-['Inter'] tracking-wide transition-colors border"
                style={{
                  borderColor: sessionMode === "studio" ? "rgba(212,184,120,0.45)" : "rgba(255,255,255,0.06)",
                  background: sessionMode === "studio" ? "rgba(212,184,120,0.09)" : "rgba(255,255,255,0.03)",
                  color: sessionMode === "studio" ? IVORY : "rgba(245,243,239,0.42)",
                }}
              >
                Studio Mehfil
              </button>
            </div>
            <p className="text-[11px] leading-relaxed font-['Inter']" style={{ color: "rgba(245,243,239,0.28)" }}>
              Studio opens optional camera — voice stays intimate without video.
            </p>
          </section>

          {/* Language */}
          <section className="w-full max-w-[420px] space-y-2.5">
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: GOLD_LABEL }}>
              Language
            </div>
            <div className="flex rounded-[18px] p-1 border border-white/[0.07] bg-black/30 backdrop-blur-xl shadow-[0_18px_52px_rgba(0,0,0,0.32)]">
              {(["or", "hi"] as const).map((l) => {
                const on = language === l;
                return (
                  <motion.button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    whileTap={{ scale: 0.985 }}
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                    className={`relative flex-1 py-3 rounded-[14px] text-[15px] font-['Playfair_Display'] transition-colors duration-500 ease-out flex items-center justify-center gap-2 ${
                      on ? "text-[color:var(--pv-ivory)]" : "text-white/[0.38]"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="lang-bg"
                        className="absolute inset-0 rounded-[14px] border border-amber-200/18"
                        style={{
                          background:
                            "linear-gradient(165deg, rgba(212,184,120,0.1), rgba(60,24,36,0.12))",
                          boxShadow: "inset 0 0 28px rgba(212,184,120,0.04), 0 0 22px rgba(212,184,120,0.05)",
                        }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      />
                    )}
                    <span className="relative z-[1]">{l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}</span>
                    {on && <Check size={15} className="relative z-[1] opacity-90" strokeWidth={2} />}
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Moods — extra vertical rhythm on small screens */}
          <section className="w-full max-w-[420px] space-y-3.5">
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: GOLD_LABEL }}>
              Moods{" "}
              <span className="normal-case tracking-[0.04em] text-[rgba(245,243,239,0.28)] font-normal">
                (select up to 3)
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-3.5 sm:gap-y-4 py-0.5">
              {MOODS.map(({ tag, label }) => {
                const sel = selectedTags.includes(tag);
                return (
                  <motion.button
                    key={tag}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 460, damping: 32 }}
                    onClick={() => toggleMood(tag)}
                    className={`px-3.5 py-2.5 sm:py-2.5 rounded-full text-[12px] border transition-[border-color,background-color,box-shadow] duration-500 ease-out ${
                      sel
                        ? "border-amber-200/28 text-[rgba(245,243,239,0.9)] bg-white/[0.055]"
                        : "border-white/[0.055] text-[rgba(245,243,239,0.48)] bg-white/[0.025]"
                    }`}
                    style={
                      sel
                        ? {
                            boxShadow:
                              "0 0 26px rgba(212,184,120,0.1), inset 0 0 18px rgba(212,184,120,0.04)",
                          }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {sel ? <Check size={13} className="opacity-90 shrink-0" /> : null}
                      {label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* When */}
          <section className="w-full max-w-[420px] space-y-3">
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: GOLD_LABEL }}>
              When do you want to start?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.992 }}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
                onClick={() => setStartsNow(true)}
                className={`rounded-[20px] p-4 text-left border transition-[border-color,background-color,box-shadow] duration-500 ease-out ${
                  startsNow ? "border-amber-200/22 bg-white/[0.052]" : "border-white/[0.055] bg-black/22"
                } backdrop-blur-xl`}
                style={
                  startsNow
                    ? {
                        boxShadow:
                          "0 0 36px rgba(212,184,120,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                      }
                    : undefined
                }
              >
                <Radio size={18} className={`mb-2 ${startsNow ? "opacity-90" : "opacity-[0.32]"}`} style={{ color: startsNow ? GOLD : undefined }} />
                <div className="font-['Playfair_Display'] text-[16px] text-[rgba(245,243,239,0.92)] mb-1 tracking-tight">Start now</div>
                <div className="text-[11px] leading-relaxed text-[rgba(245,243,239,0.36)] tracking-[0.02em]">
                  Begin whenever you&apos;re ready
                </div>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.992 }}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
                onClick={() => setStartsNow(false)}
                className={`rounded-[20px] p-4 text-left border transition-[border-color,background-color,box-shadow] duration-500 ease-out ${
                  !startsNow ? "border-amber-200/22 bg-white/[0.052]" : "border-white/[0.055] bg-black/22"
                } backdrop-blur-xl`}
                style={
                  !startsNow
                    ? {
                        boxShadow:
                          "0 0 36px rgba(212,184,120,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                      }
                    : undefined
                }
              >
                <Calendar size={18} className={`mb-2 ${!startsNow ? "opacity-90" : "opacity-[0.32]"}`} style={{ color: !startsNow ? GOLD : undefined }} />
                <div className="font-['Playfair_Display'] text-[16px] text-[rgba(245,243,239,0.92)] mb-1 tracking-tight">Schedule for later</div>
                <div className="text-[11px] leading-relaxed text-[rgba(245,243,239,0.36)] tracking-[0.02em]">
                  Pick a date &amp; time to gather people
                </div>
              </motion.button>
            </div>
            {!startsNow && (
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-[16px] border border-white/[0.08] bg-black/40 backdrop-blur-md px-4 py-3.5 text-[13px] outline-none focus:border-amber-200/25 transition-colors text-[color:var(--pv-ivory)]"
                style={{ colorScheme: "dark" }}
              />
            )}
          </section>

          {/* Footer reassurance — tertiary copy */}
          <div className="flex items-center justify-center gap-2 text-[10.5px] text-[rgba(245,243,239,0.26)] tracking-[0.04em] pb-2 max-w-[17rem] mx-auto text-center leading-snug">
            <Lock size={11} strokeWidth={1.65} className="shrink-0 opacity-70" />
            <span>You can edit all details anytime before going live</span>
          </div>
        </div>

        {/* Primary CTA — frosted floating control, minimal tint */}
        <div className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none">
          <div className="max-w-[420px] mx-auto pointer-events-auto">
            <motion.button
              type="submit"
              disabled={!title.trim() || create.isPending}
              whileTap={{ scale: title.trim() ? 0.988 : 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="relative w-full py-3.5 rounded-[999px] text-[14px] font-medium tracking-[0.03em] disabled:opacity-35 overflow-hidden border border-white/[0.14] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(248,246,242,0.94)",
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  background:
                    "linear-gradient(105deg, rgba(232,207,160,0.12) 0%, rgba(200,120,140,0.06) 48%, rgba(80,28,48,0.1) 100%)",
                }}
              />
              <span className="relative flex items-center justify-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="relative rounded-full h-2 w-2 bg-[rgba(220,100,100,0.85)] shadow-[0_0_12px_rgba(220,100,100,0.35)]" />
                </span>
                {create.isPending ? "Creating…" : startsNow ? "Start the mehfil" : "Schedule the mehfil"}
              </span>
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  );
}
