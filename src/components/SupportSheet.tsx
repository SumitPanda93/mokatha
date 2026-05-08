/**
 * SupportSheet — premium emotional appreciation bottom sheet.
 * Replaces generic "tip" with warm creator-support actions.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { useSendSupport, useWalletBalance, useAdminConfig, SupportActionKind, getCurrentUserId } from "@/lib/store";

// ─── Action definitions ───────────────────────────────────────────────────────

const ACTIONS: { kind: SupportActionKind; emoji: string; label: string; sublabel: string }[] = [
  { kind: "chai",    emoji: "☕", label: "Buy Chai",        sublabel: "A warm gesture of gratitude" },
  { kind: "rose",    emoji: "🌹", label: "Send Rose",       sublabel: "For words that moved you"    },
  { kind: "applaud", emoji: "👏", label: "Applaud",         sublabel: "Your work deserves this"      },
  { kind: "support", emoji: "📖", label: "Support Writing", sublabel: "Keep their voice alive"       },
];

const AMOUNTS = [1, 2, 5];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SupportSheetProps {
  toUserId: string;
  toUserName: string;
  postId?: string;
  mehfilId?: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportSheet({
  toUserId, toUserName, postId, mehfilId, onClose,
}: SupportSheetProps) {
  const me = getCurrentUserId();
  const { data: balance = 0 } = useWalletBalance(me ?? "");
  const { data: config } = useAdminConfig();
  const send = useSendSupport();

  const [action, setAction] = useState<SupportActionKind>("chai");
  const [amount, setAmount] = useState(1);
  const [done, setDone] = useState(false);

  const maxAmount = config?.max_support_amount ?? 5;
  const availableAmounts = AMOUNTS.filter((a) => a <= maxAmount);
  const canSend = !!me && balance >= amount && !send.isPending && !done;

  const handleSend = async () => {
    if (!canSend) return;
    await send.mutateAsync({ toUserId, actionType: action, amount, postId, mehfilId });
    setDone(true);
    setTimeout(onClose, 1800);
  };

  const selectedAction = ACTIONS.find((a) => a.kind === action)!;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] overflow-hidden"
        style={{ background: "#0F0A06", maxWidth: 480, margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-5 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)" }}>
          <X size={14} style={{ color: "rgba(245,243,239,0.55)" }} />
        </button>

        <div className="px-6 pt-2 pb-8">

          {/* Header */}
          <div className="mb-5">
            <div className="text-[10px] tracking-[0.28em] uppercase mb-1.5"
              style={{ color: "rgba(201,168,76,0.55)" }}>
              Appreciate a creator
            </div>
            <div className="font-['Playfair_Display'] text-[22px] leading-tight"
              style={{ color: "#F5F3EF" }}>
              For{" "}
              <span className="italic"
                style={{ background: "linear-gradient(90deg,#C9A84C,#F76A4A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {toUserName}
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: "rgba(245,243,239,0.35)" }}>
              Your balance: ₹{balance.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Done state */}
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8 gap-3"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#F76A4A)" }}
                >
                  <Check size={28} color="#0F0A06" strokeWidth={2.5} />
                </motion.div>
                <div className="text-[16px] font-['Playfair_Display'] italic"
                  style={{ color: "#F5F3EF" }}>
                  {selectedAction.emoji} Sent with warmth
                </div>
                <div className="text-[12px]" style={{ color: "rgba(245,243,239,0.40)" }}>
                  ₹{amount} appreciation delivered
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!done && (
            <>
              {/* Action selector */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {ACTIONS.map((a) => {
                  const active = action === a.kind;
                  return (
                    <motion.button
                      key={a.kind}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setAction(a.kind)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                      style={{
                        background: active ? "rgba(201,168,76,0.13)" : "rgba(255,255,255,0.04)",
                        border: active ? "1px solid rgba(201,168,76,0.45)" : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <span className="text-[22px] leading-none">{a.emoji}</span>
                      <div>
                        <div className="text-[12px] font-['Inter'] font-medium"
                          style={{ color: active ? "#C9A84C" : "rgba(245,243,239,0.75)" }}>
                          {a.label}
                        </div>
                        <div className="text-[10px] leading-[1.4]"
                          style={{ color: "rgba(245,243,239,0.30)" }}>
                          {a.sublabel}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Amount selector */}
              <div className="mb-6">
                <div className="text-[9px] tracking-[0.28em] uppercase mb-2.5"
                  style={{ color: "rgba(201,168,76,0.45)" }}>
                  Amount
                </div>
                <div className="flex gap-2.5">
                  {availableAmounts.map((a) => {
                    const active = amount === a;
                    return (
                      <motion.button
                        key={a}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setAmount(a)}
                        className="flex-1 py-3 rounded-xl text-[15px] font-['Inter'] font-semibold transition-all"
                        style={{
                          background: active
                            ? "linear-gradient(135deg,rgba(201,168,76,0.22),rgba(247,106,74,0.16))"
                            : "rgba(255,255,255,0.04)",
                          border: active
                            ? "1px solid rgba(201,168,76,0.50)"
                            : "1px solid rgba(255,255,255,0.07)",
                          color: active ? "#C9A84C" : "rgba(245,243,239,0.45)",
                        }}
                      >
                        ₹{a}
                      </motion.button>
                    );
                  })}
                </div>
                {balance < amount && (
                  <div className="text-[11px] mt-2" style={{ color: "#F76A4A" }}>
                    Insufficient balance — top up your wallet first
                  </div>
                )}
              </div>

              {/* CTA */}
              <motion.button
                type="button"
                disabled={!canSend}
                whileTap={{ scale: canSend ? 0.97 : 1 }}
                onClick={handleSend}
                className="w-full py-4 rounded-2xl text-[14px] font-['Inter'] font-medium transition-all"
                style={{
                  background: canSend
                    ? "linear-gradient(135deg,#C9A84C 0%,#E09060 55%,#F76A4A 100%)"
                    : "rgba(255,255,255,0.06)",
                  color: canSend ? "#0F0A06" : "rgba(245,243,239,0.28)",
                  boxShadow: canSend ? "0 6px 24px rgba(201,168,76,0.22)" : "none",
                }}
              >
                {send.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "#0F0A06", borderTopColor: "transparent" }} />
                    Sending…
                  </span>
                ) : (
                  `${selectedAction.emoji} Send ${selectedAction.label} · ₹${amount}`
                )}
              </motion.button>

              <p className="text-center mt-3 text-[10px]" style={{ color: "rgba(245,243,239,0.18)" }}>
                Appreciation goes directly to the creator.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
