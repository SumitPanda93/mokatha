import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { handleOAuthCallback } from "@/lib/store";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [dots, setDots] = useState(".");
  const called = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    // Check if Supabase returned an error in the URL
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") || params.get("error");
    if (urlError) {
      setError(urlError);
      return;
    }

    handleOAuthCallback()
      .then((result) => {
        if (result === "existing") {
          setLocation("/");
        } else if (result === "new") {
          setLocation("/auth/profile-setup");
        } else {
          setError("timed_out");
        }
      })
      .catch((e: Error) => {
        setError(e.message || "An unexpected error occurred.");
      });
  }, [setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0806] flex flex-col items-center justify-center px-8 gap-6">
        <img src="/logo.png" alt="Mo Katha" className="w-16 h-16 object-contain opacity-60" />
        <div className="text-center max-w-sm">
          <div className="text-[14px] font-['Inter'] text-[#E87777] mb-3">Sign-in failed</div>
          <div className="text-[12px] text-[#F5F3EF]/50 leading-relaxed font-['Inter']">{error}</div>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => { called.current = false; setError(null); window.location.href = "/auth/login"; }}
            className="w-full py-3 rounded-xl text-[13px] font-['Inter'] font-medium text-[#0A0806] bg-[#C9A84C]"
          >
            Back to sign in
          </button>
          <button
            onClick={() => setLocation("/setup")}
            className="w-full py-3 rounded-xl text-[13px] font-['Inter'] text-[#C9A84C] border border-[#C9A84C]/30"
          >
            View setup guide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0806] flex flex-col items-center justify-center gap-8">
      <img src="/logo.png" alt="Mo Katha" className="w-20 h-20 object-contain" />
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
        <div className="text-[14px] font-['Inter'] text-[#F5F3EF]/50">
          Signing you in{dots}
        </div>
      </div>
    </div>
  );
}
