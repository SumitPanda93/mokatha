import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useRegisterUserWithAuth } from "@/lib/store";

// ─── Creator role options ─────────────────────────────────────────────────────

const ROLES = ["Writer", "Poet", "Storyteller", "Listener"] as const;
type Role = typeof ROLES[number];

const ROLE_PLACEHOLDER: Record<Role, string> = {
  Writer:      "Finds stories in ordinary afternoons…",
  Poet:        "Writes in the language of rain…",
  Storyteller: "Holds the room with a single breath…",
  Listener:    "Listens before the world wakes up…",
};

const LANGUAGES = [
  { code: "or" as const, script: "ଓଡ଼ିଆ", label: "Odia" },
  { code: "hi" as const, script: "हिन्दी", label: "Hindi" },
];

// ─── Shared input style helpers ───────────────────────────────────────────────

const FIELD_BASE: React.CSSProperties = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#F5F3EF",
};
const FIELD_FOCUS_BORDER = "rgba(201,168,76,0.50)";

function onFocusGold(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = FIELD_FOCUS_BORDER;
}
function onBlurReset(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileSetup() {
  useTitle("Set up your space");
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [role, setRole] = useState<Role | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const register = useRegisterUserWithAuth();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setPhotoLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const finish = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    // Compose bio: prepend role if selected
    const finalBio = [role, bio.trim()].filter(Boolean).join(" · ");
    register.mutate(
      { displayName: name.trim(), language },
      {
        onSuccess: (user) => {
          import("@/lib/store").then(({ updateUser }) => {
            updateUser(user.id, {
              ...(photoUrl ? { avatarUrl: photoUrl } : {}),
              ...(finalBio ? { bio: finalBio } : {}),
            });
          });
          setLocation("/");
        },
      }
    );
  };

  const canSubmit = name.trim().length >= 2 && !register.isPending;
  const bioPlaceholder = role ? ROLE_PLACEHOLDER[role] : "Writes from the kitchen window…";

  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden" style={{ background: "#0A0806" }}>
      {/* ── Ambient glows ── */}
      <div className="fixed top-[-80px] right-[-60px] w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.11) 0%, transparent 70%)", filter: "blur(48px)" }} />
      <div className="fixed bottom-[80px] left-[-60px] w-[220px] h-[220px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(247,106,74,0.08) 0%, transparent 70%)", filter: "blur(52px)" }} />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="px-7 pt-12 pb-2"
      >
        <div className="text-[10px] tracking-[0.30em] uppercase mb-3"
          style={{ color: "rgba(201,168,76,0.55)" }}>
          Profile setup
        </div>
        <div className="font-['Playfair_Display'] text-[30px] leading-[1.22]"
          style={{ color: "#F5F3EF" }}>
          Your voice,{" "}
          <span className="italic"
            style={{
              background: "linear-gradient(90deg, #C9A84C, #F76A4A)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            your portrait.
          </span>
        </div>
        <div className="text-[12px] mt-2.5 leading-[1.65]"
          style={{ color: "rgba(245,243,239,0.38)" }}>
          A picture and a line — just enough for readers to know you're here.
        </div>
      </motion.div>

      <form onSubmit={finish} className="flex-1 flex flex-col px-7 pt-6 pb-12 gap-8">

        {/* ── Portrait upload ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.7 }}
          className="flex flex-col items-center"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhoto}
          />

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => fileRef.current?.click()}
            className="relative"
            style={{ width: 112, height: 112 }}
          >
            {/* Gradient ring — appears when photo is selected */}
            <AnimatePresence>
              {photoUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    inset: -3,
                    background: "linear-gradient(135deg, #C9A84C, #F76A4A, #9B6FD8)",
                    padding: 2,
                    borderRadius: "50%",
                  }}
                >
                  <div className="w-full h-full rounded-full" style={{ background: "#0A0806" }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Portrait circle */}
            <div
              className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: photoUrl ? "transparent" : "rgba(255,255,255,0.035)",
                border: photoUrl ? "none" : "1.5px dashed rgba(201,168,76,0.32)",
              }}
            >
              {photoLoading && (
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
              )}
              {!photoLoading && photoUrl && (
                <img src={photoUrl} alt="Portrait" className="w-full h-full object-cover" />
              )}
              {!photoLoading && !photoUrl && (
                <div className="flex flex-col items-center gap-1.5">
                  <Camera size={22} style={{ color: "rgba(201,168,76,0.50)" }} />
                  <span className="text-[8px] tracking-[0.14em] uppercase"
                    style={{ color: "rgba(201,168,76,0.38)" }}>Portrait</span>
                </div>
              )}
            </div>

            {/* Check badge */}
            <AnimatePresence>
              {photoUrl && !photoLoading && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute bottom-0.5 right-0.5 w-[26px] h-[26px] rounded-full flex items-center justify-center"
                  style={{ background: "#C9A84C" }}
                >
                  <Check size={13} color="#0A0806" strokeWidth={2.5} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.p
            key={photoUrl ? "change" : "add"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[11px]"
            style={{ color: "rgba(245,243,239,0.28)" }}
          >
            {photoUrl ? "Tap to change portrait" : "Add your portrait"}
          </motion.p>
        </motion.div>

        {/* ── Name ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.65 }}
        >
          <div className="text-[9px] tracking-[0.28em] uppercase mb-2.5"
            style={{ color: "rgba(201,168,76,0.55)" }}>
            What should readers call you?
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full rounded-2xl px-5 py-3.5 text-[19px] font-['Playfair_Display'] outline-none transition-colors"
            style={{ ...FIELD_BASE }}
            onFocus={onFocusGold}
            onBlur={onBlurReset}
          />
        </motion.div>

        {/* ── Creator role ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.65 }}
        >
          <div className="text-[9px] tracking-[0.28em] uppercase mb-3"
            style={{ color: "rgba(201,168,76,0.55)" }}>
            I am a…
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const active = role === r;
              return (
                <motion.button
                  key={r}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setRole(active ? null : r)}
                  className="px-4 py-2 rounded-full text-[12px] font-['Inter'] transition-all"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(201,168,76,0.20), rgba(247,106,74,0.14))"
                      : "rgba(255,255,255,0.035)",
                    border: active
                      ? "1px solid rgba(201,168,76,0.55)"
                      : "1px solid rgba(255,255,255,0.09)",
                    color: active ? "#C9A84C" : "rgba(245,243,239,0.40)",
                  }}
                >
                  {r}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Bio ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.65 }}
        >
          <div className="text-[9px] tracking-[0.28em] uppercase mb-2.5"
            style={{ color: "rgba(201,168,76,0.55)" }}>
            Leave a line behind
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={bioPlaceholder}
            rows={3}
            className="w-full rounded-2xl px-5 py-3.5 text-[14px] outline-none resize-none transition-colors font-['Playfair_Display'] italic leading-[1.7]"
            style={{ ...FIELD_BASE }}
            onFocus={onFocusGold}
            onBlur={onBlurReset}
          />
        </motion.div>

        {/* ── Language ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, duration: 0.65 }}
        >
          <div className="text-[9px] tracking-[0.28em] uppercase mb-3"
            style={{ color: "rgba(201,168,76,0.55)" }}>
            I write in…
          </div>
          <div className="flex gap-3">
            {LANGUAGES.map((l) => {
              const active = language === l.code;
              return (
                <motion.button
                  key={l.code}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLanguage(l.code)}
                  className="flex-1 py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
                  style={{
                    background: active ? "rgba(201,168,76,0.10)" : "rgba(255,255,255,0.025)",
                    border: active
                      ? "1px solid rgba(201,168,76,0.45)"
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="text-[22px] font-serif leading-none"
                    style={{ color: active ? "#C9A84C" : "rgba(245,243,239,0.38)" }}>
                    {l.script}
                  </div>
                  <div className="text-[9px] tracking-[0.18em] uppercase"
                    style={{ color: active ? "rgba(201,168,76,0.65)" : "rgba(245,243,239,0.22)" }}>
                    {l.label}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.65 }}
          className="mt-auto pt-2"
        >
          <motion.button
            type="submit"
            disabled={!canSubmit}
            whileTap={{ scale: canSubmit ? 0.97 : 1 }}
            className="w-full py-4 rounded-2xl text-[15px] font-['Inter'] font-medium transition-all"
            style={{
              background: canSubmit
                ? "linear-gradient(135deg, #C9A84C 0%, #E09060 55%, #F76A4A 100%)"
                : "rgba(255,255,255,0.06)",
              color: canSubmit ? "#0A0806" : "rgba(245,243,239,0.28)",
              boxShadow: canSubmit ? "0 8px 28px rgba(201,168,76,0.22)" : "none",
            }}
          >
            {register.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-[#0A0806] border-t-transparent animate-spin" />
                Setting up your space…
              </span>
            ) : (
              "Let your voice stay"
            )}
          </motion.button>

          <p className="text-center mt-4 text-[10px]"
            style={{ color: "rgba(245,243,239,0.18)" }}>
            You can always refine this later.
          </p>
        </motion.div>

      </form>
    </div>
  );
}
