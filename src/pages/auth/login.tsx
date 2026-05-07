import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Phone, ArrowRight } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } from "@/lib/store";

type Mode = "options" | "phone_input" | "otp_input";

export default function Login() {
  useTitle("Sign In");
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
      setMode("otp_input");
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
      setError(err.message ?? "Invalid code. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0A0806] text-[#F5F3EF]">
      <div className="px-6 py-4 flex items-center">
        <button
          onClick={() => {
            if (mode !== "options") { setMode("options"); setError(""); }
            else setLocation("/");
          }}
          className="p-2 -ml-2 rounded-full hover:bg-white/5"
        >
          <ChevronLeft size={22} className="text-[#F5F3EF]/70" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="flex justify-center pt-2 pb-6"
      >
        <img src="/logo.png" alt="Mo Katha" className="w-[120px] h-[120px] object-contain" draggable={false} />
      </motion.div>

      <div className="px-8 pb-16 flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mb-8"
        >
          <div className="text-[11px] tracking-[0.22em] uppercase text-[#C9A84C] mb-2">
            {mode === "options" ? "Welcome Back" : mode === "phone_input" ? "Sign in with Phone" : "Check your phone"}
          </div>
          <h1 className="text-[28px] font-['Playfair_Display'] leading-tight">
            {mode === "options" && <>Return to your<br /><span className="italic text-[#C9A84C]">quiet place</span></>}
            {mode === "phone_input" && <>Enter your<br /><span className="italic text-[#C9A84C]">phone number</span></>}
            {mode === "otp_input" && <>Enter the<br /><span className="italic text-[#C9A84C]">6-digit code</span></>}
          </h1>
          {mode === "otp_input" && (
            <p className="text-[12px] text-[#F5F3EF]/45 mt-2">Sent to +91 {phone.replace(/\D/g, "").slice(-10)}</p>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="mt-auto space-y-3"
          >
            {error && (
              <div className="text-[12px] text-[#E87777] text-center bg-[#E87777]/10 rounded-xl px-4 py-3 leading-relaxed">
                {error}
              </div>
            )}

            {/* ── Options screen ── */}
            {mode === "options" && (
              <>
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
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {loading ? "Opening Google…" : "Continue with Google"}
                </button>

                {/* Email OTP */}
                <button
                  onClick={() => { setMode("phone_input"); setError(""); }}
                  className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.35)", color: "#C9A84C" }}
                >
                  <Phone size={18} />
                  Continue with Phone
                </button>

              </>
            )}

            {/* ── Phone input ── */}
            {mode === "phone_input" && (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  autoFocus
                  className="w-full py-4 px-5 rounded-2xl font-['Inter'] text-[15px] bg-white/8 border border-white/15 text-[#F5F3EF] placeholder:text-[#F5F3EF]/30 outline-none focus:border-[#C9A84C]/60"
                />
                <button
                  type="submit"
                  disabled={loading || phone.replace(/\D/g, "").slice(-10).length !== 10}
                  className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#0A0806" }}
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[#0A0806] border-t-transparent animate-spin" />
                  ) : (
                    <><span>Send code</span><ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            )}

            {/* ── OTP input ── */}
            {mode === "otp_input" && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  autoFocus
                  className="w-full py-4 px-5 rounded-2xl font-['Inter'] text-[24px] tracking-[0.3em] text-center bg-white/8 border border-white/15 text-[#F5F3EF] placeholder:text-[#F5F3EF]/20 outline-none focus:border-[#C9A84C]/60"
                />
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-4 rounded-2xl font-['Inter'] font-medium text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#0A0806" }}
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[#0A0806] border-t-transparent animate-spin" />
                  ) : (
                    <><span>Verify & sign in</span><ArrowRight size={16} /></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtp(""); setError(""); handleSendOtp({ preventDefault: () => {} } as any); }}
                  className="w-full py-2 text-[12px] text-[#F5F3EF]/35 font-['Inter']"
                >
                  Resend code
                </button>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
