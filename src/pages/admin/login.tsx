import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { supabase } from "@/lib/store";
import { toast } from "sonner";

export default function AdminLogin() {
  useTitle("Admin sign-in");
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    if (code.length < 6) e.code = "Enter all 6 digits";
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrors({ email: error.message });
        return;
      }
      toast.success("Signed in as administrator");
      setLocation("/admin/dashboard");
    } catch (err: any) {
      setErrors({ email: err.message ?? "Sign-in failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0D] text-[#F5F3EF] px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6BAE8A]/10 border border-[#6BAE8A]/30 mb-5">
            <ShieldCheck size={28} className="text-[#6BAE8A]" />
          </div>
          <div className="font-['Playfair_Display'] text-[28px]">Mo Katha <span className="text-[#6BAE8A] italic">Admin</span></div>
          <div className="text-[12px] text-[#A0A0A0] mt-1.5">Restricted console · authorised editors only</div>
        </div>

        <div className="space-y-3">
          {/* Email */}
          <div>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
              placeholder="Admin email"
              className={`w-full bg-[#1A1A1A] border rounded-xl px-4 py-3 text-[14px] outline-none transition-colors ${errors.email ? "border-destructive" : "border-[#2A2A2A] focus:border-[#6BAE8A]"}`}
            />
            {errors.email && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <div className={`flex items-center bg-[#1A1A1A] border rounded-xl px-4 py-3 ${errors.password ? "border-destructive" : "border-[#2A2A2A] focus-within:border-[#6BAE8A]"}`}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                placeholder="Password"
                className="flex-1 bg-transparent outline-none text-[14px]"
              />
              <button onClick={() => setShowPw((v) => !v)} className="text-[#A0A0A0] hover:text-[#F5F3EF] ml-2">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.password}</p>}
          </div>

          {/* 2FA code placeholder (UI kept, not enforced in v0.1) */}
          <div>
            <div className={`flex items-center bg-[#1A1A1A] border rounded-xl px-4 py-3 ${errors.code ? "border-destructive" : "border-[#2A2A2A] focus-within:border-[#6BAE8A]"}`}>
              <Lock size={14} className="text-[#A0A0A0] mr-3 shrink-0" />
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErrors((p) => ({ ...p, code: "" })); }}
                placeholder="6-digit authenticator code"
                className="flex-1 bg-transparent outline-none text-[14px] tracking-[0.35em]"
                inputMode="numeric"
              />
            </div>
            {errors.code && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.code}</p>}
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#6BAE8A] text-[#0D0D0D] text-[14px] font-medium disabled:opacity-60 transition-opacity mt-1"
          >
            {loading ? "Signing in…" : "Sign in to console"}
          </motion.button>
        </div>

        <div className="mt-5 p-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A]">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#A0A0A0] mb-1">Setup</div>
          <div className="text-[12px] text-[#D5D2CE] space-y-0.5">
            <div>Use the email + password of your Supabase admin account</div>
            <div className="text-[#A0A0A0]">Run migration 004 to set <code className="text-[#6BAE8A]">is_admin = true</code> on your profile</div>
          </div>
        </div>

        <div className="mt-5 text-center text-[10px] text-[#555] uppercase tracking-[0.2em]">All actions are logged · IP recorded</div>
      </motion.div>
    </div>
  );
}
