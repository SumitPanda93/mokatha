import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";

export default function PaymentResult() {
  useTitle("Payment");
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("payment");
  const sessionId = params.get("session_id");
  const redirect = params.get("redirect");
  const isSuccess = status === "success";
  const [verifying, setVerifying] = useState(isSuccess && !!sessionId);

  useEffect(() => {
    if (!isSuccess || !sessionId) return;
    // Trigger server-side credit application
    fetch("/api/payments/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => setVerifying(false));
  }, [isSuccess, sessionId]);

  useEffect(() => {
    const dest = redirect ?? "/wallet";
    const t = setTimeout(() => setLocation(dest), 3500);
    return () => clearTimeout(t);
  }, [setLocation, redirect]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center gap-5">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`w-20 h-20 rounded-full flex items-center justify-center ${isSuccess ? "bg-sage/15" : "bg-terracotta/15"}`}
      >
        {verifying
          ? <Loader2 size={36} className="text-sage animate-spin" />
          : isSuccess
            ? <CheckCircle size={40} className="text-sage" />
            : <XCircle size={40} className="text-terracotta" />}
      </motion.div>

      <div>
        <div className="font-['Playfair_Display'] text-[28px] leading-tight">
          {isSuccess ? "Payment successful" : "Payment cancelled"}
        </div>
        <div className="text-[13px] text-muted-foreground mt-2 max-w-[280px]">
          {isSuccess
            ? "The creator has been notified. Thank you for your support."
            : "No charge was made. You can try again any time."}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">Redirecting…</div>
    </div>
  );
}
