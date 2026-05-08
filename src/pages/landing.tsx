import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } from "@/lib/store";

// ─── Literary quotes that rotate ─────────────────────────────────────────────
const QUOTES = [
  { text: "Every voice deserves a page.", lang: "en" },
  { text: "କଥାଟିଏ କହୁଁ , କଥାଟିଏ !", lang: "or" },
  { text: "Stories that breathe. Voices that last.", lang: "en" },
];
const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length];

type Mode = "options" | "phone" | "otp";

interface Props {
  /** Called when user chooses to browse without signing in */
  onBrowse: () => void;
}

export default function Landing({ onBrowse }: Props) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("options");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message ?? "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return;
    setLoading(true);
    setError("");
    try {
      await sendPhoneOtp(digits);
      setMode("otp");
    } catch (err: any) {
      setError(err.message ?? "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const digits = phone.replace(/\D/g, "").slice(-10);
      const result = await verifyPhoneOtp(digits, otp.trim());
      if (result === "existing") setLocation("/");
      else setLocation("/auth/profile-setup");
    } catch (err: any) {
      setError(err.message ?? "Invalid code. Try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{ background: "#0A0806" }}
    >
      {/* ── Ambient glows ── */}
      <div
        className="absolute top-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 70%)", filter: "blur(40px)" }}
      />
      <div
        className="absolute bottom-[120px] right-[-80px] w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(247,106,74,0.10) 0%, transparent 70%)", filter: "blur(50px)" }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-[180px] h-[180px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(120,80,160,0.08) 0%, transparent 70%)", filter: "blur(60px)" }}
      />

      {/* ── Branding ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="flex flex-col items-center pt-14 pb-6 px-8 text-center"
      >
        <img
          src="/logo.png"
          alt="Mo Katha"
          className="w-[72px] h-[72px] object-contain mb-5"
          draggable={false}
        />
        <div
          className="text-[36px] font-['Playfair_Display'] leading-none mb-1"
          style={{ color: "#F5F3EF" }}
        >
          Mo{" "}
          <span
            className="italic"
            style={{ background: "linear-gradient(90deg, #C9A84C, #F76A4A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            Katha
          </span>
        </div>
        <div className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "rgba(245,243,239,0.45)" }}>
          Voice · Poetry · Story
        </div>
      </motion.div>

      {/* ── Literary quote ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1.1 }}
        className="mx-8 mb-8 text-center"
      >
        <div
          className={`text-[16px] leading-[1.7] ${quote.lang === "or" ? "font-serif" : "font-['Playfair_Display'] italic"}`}
          style={{ color: "rgba(201,168,76,0.85)" }}
        >
          {quote.text}
        </div>
      </motion.div>

      {/* ── Creator platform statement ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.72, duration: 1.0, ease: "easeOut" }}
        className="flex items-center justify-center gap-0 pb-8 px-6"
      >
        {(["EXPLORE", "EXPRESS", "EARN"] as const).map((word, i) => (
          <span key={word} className="flex items-center">
            <span
              className="text-[11px] font-['Inter'] font-semibold tracking-[0.32em]"
              style={{
                background: i === 1
                  ? "linear-gradient(90deg, #C9A84C 0%, #F76A4A 100%)"
                  : "none",
                WebkitBackgroundClip: i === 1 ? "text" : undefined,
                WebkitTextFillColor: i === 1 ? "transparent" : undefined,
                color: i === 1 ? undefined : "rgba(245,243,239,0.38)",
              }}
            >
              {word}
            </span>
            {i < 2 && (
              <span
                className="mx-3 text-[6px] rounded-full"
                style={{ color: "rgba(201,168,76,0.45)", letterSpacing: 0 }}
                aria-hidden
              >
                ●
              </span>
            )}
          </span>
        ))}
      </motion.div>

      {/* ── Auth actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex-1 flex flex-col justify-end px-6 pb-10"
      >
        {error && (
          <div className="text-[12px] text-[#E87777] text-center bg-[#E87777]/10 rounded-xl px-4 py-3 mb-3 leading-relaxed">
            {error}
          </div>
        )}

        {mode === "options" && (
          <div className="space-y-3">
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "#F5F3EF" }}
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Opening Google…" : "Continue with Google"}
            </button>

            {/* Phone */}
            <button
              onClick={() => { setMode("phone"); setError(""); }}
              className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              style={{ background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.30)", color: "#C9A84C" }}
            >
              <Phone size={18} />
              Continue with Phone
            </button>

            {/* Guest browse */}
            <button
              onClick={onBrowse}
              className="w-full py-3 flex items-center justify-center gap-1.5 text-[13px] font-['Inter'] transition-colors"
              style={{ color: "rgba(245,243,239,0.38)" }}
            >
              Browse stories without signing in
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {mode === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <div className="text-[13px] font-['Playfair_Display'] italic mb-2" style={{ color: "#C9A84C" }}>
              Enter your phone number
            </div>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              autoFocus
              className="w-full py-4 px-5 rounded-2xl font-['Inter'] text-[15px] outline-none focus:border-[#C9A84C]/60"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F3EF" }}
            />
            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, "").slice(-10).length !== 10}
              className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#0A0806" }}
            >
              {loading ? <div className="w-5 h-5 rounded-full border-2 border-[#0A0806] border-t-transparent animate-spin" /> : <><span>Send code</span><ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => { setMode("options"); setError(""); }}
              className="w-full py-2 text-[12px] font-['Inter']" style={{ color: "rgba(245,243,239,0.30)" }}>
              ← Back
            </button>
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div className="text-[13px] font-['Playfair_Display'] italic mb-2" style={{ color: "#C9A84C" }}>
              Enter the 6-digit code sent to +91 {phone.replace(/\D/g, "").slice(-10)}
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full py-4 px-5 rounded-2xl font-['Inter'] text-[24px] tracking-[0.3em] text-center outline-none focus:border-[#C9A84C]/60"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F3EF" }}
            />
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#0A0806" }}
            >
              {loading ? <div className="w-5 h-5 rounded-full border-2 border-[#0A0806] border-t-transparent animate-spin" /> : <><span>Verify &amp; sign in</span><ArrowRight size={16} /></>}
            </button>
            <button type="button"
              onClick={() => { setOtp(""); setError(""); handleSendOtp({ preventDefault: () => {} } as any); }}
              className="w-full py-2 text-[12px] font-['Inter']" style={{ color: "rgba(245,243,239,0.30)" }}>
              Resend code
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-[10px] text-center mt-6 leading-relaxed" style={{ color: "rgba(245,243,239,0.22)" }}>
          By continuing you agree to Mo Katha's{" "}
          <span style={{ color: "rgba(201,168,76,0.6)" }}>Terms</span>
          {" "}&amp;{" "}
          <span style={{ color: "rgba(201,168,76,0.6)" }}>Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
}
