import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Loader2, CheckCircle, XCircle } from "lucide-react";
import { fetchStripeProducts, startTipCheckout, startUnlockCheckout, startMehfilTicketCheckout } from "@/lib/payments";
import { getCurrentUserId } from "@/lib/store";

type Mode = "tip" | "unlock" | "mehfil";

interface Props {
  mode: Mode;
  recipientId: string;
  postId?: string;
  mehfilId?: string;
  onClose: () => void;
}

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: StripePrice[];
}

const MODE_META: Record<Mode, { title: string; subtitle: string; metaKind: string }> = {
  tip:     { title: "Send a tip",        subtitle: "Support this creator",             metaKind: "tip" },
  unlock:  { title: "Unlock this piece", subtitle: "One-time payment for full access", metaKind: "unlock" },
  mehfil:  { title: "Get your ticket",   subtitle: "Join this premium Mehfil",         metaKind: "mehfil" },
};

const FMT = (unit_amount: number) => `₹${(unit_amount / 100).toLocaleString()}`;

export default function PaymentModal({ mode, recipientId, postId, mehfilId, onClose }: Props) {
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [selected, setSelected] = useState<StripePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = getCurrentUserId();
  const meta = MODE_META[mode];

  useEffect(() => {
    fetchStripeProducts()
      .then((all) => {
        const relevant = all.filter((p) => p.metadata?.kind === meta.metaKind);
        setProducts(relevant);
        if (relevant[0]?.prices[0]) setSelected(relevant[0].prices[0]);
      })
      .catch(() => setError("Could not load prices. Please try again."))
      .finally(() => setLoading(false));
  }, [meta.metaKind]);

  const proceed = async () => {
    if (!selected || !me) return;
    setRedirecting(true);
    try {
      if (mode === "tip") {
        await startTipCheckout({ payerId: me, recipientId, priceId: selected.id, postId });
      } else if (mode === "unlock" && postId) {
        await startUnlockCheckout({ payerId: me, recipientId, postId, priceId: selected.id });
      } else if (mode === "mehfil" && mehfilId) {
        await startMehfilTicketCheckout({ payerId: me, recipientId, mehfilId, priceId: selected.id });
      }
    } catch (e: any) {
      setError(e.message);
      setRedirecting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl"
        >
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="font-['Playfair_Display'] text-[22px] leading-tight">{meta.title}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">{meta.subtitle}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center shrink-0 ml-3">
              <X size={14} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
              <div className="text-[13px] text-muted-foreground">Loading prices…</div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <XCircle size={28} className="text-terracotta" />
              <div className="text-[13px] text-muted-foreground">{error}</div>
              <button onClick={onClose} className="text-[13px] px-6 py-2 rounded-full border border-border">Close</button>
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-[13px]">
              Payments not yet configured. Check back soon.
            </div>
          ) : (
            <>
              {/* Price grid */}
              <div className="text-[10px] font-['Inter'] uppercase tracking-[0.2em] text-muted-foreground mb-2">Choose amount</div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {products.flatMap((p) => p.prices).map((price) => (
                  <button
                    key={price.id}
                    onClick={() => setSelected(price)}
                    className={`py-3 rounded-xl border text-[15px] font-['Playfair_Display'] transition-all ${
                      selected?.id === price.id
                        ? "border-terracotta bg-terracotta/8 text-terracotta"
                        : "border-border hover:border-terracotta/50"
                    }`}
                  >
                    {FMT(price.unit_amount)}
                  </button>
                ))}
              </div>

              {/* Pay button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={proceed}
                disabled={!selected || redirecting || !me}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5 text-[15px] font-['Inter'] font-medium text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #D97040, #B45A2A)" }}
              >
                {redirecting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <CreditCard size={16} />
                    Pay {selected ? FMT(selected.unit_amount) : ""} securely
                  </>
                )}
              </motion.button>

              {!me && (
                <p className="text-center text-[11px] text-muted-foreground mt-3">Sign in to continue</p>
              )}
              <p className="text-center text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <CheckCircle size={10} className="text-sage" /> Powered by Stripe · secure checkout
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
