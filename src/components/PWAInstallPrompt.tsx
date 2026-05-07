import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa-install-dismissed";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSSheet, setShowIOSSheet] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed recently
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS guide after 5 seconds
      const t = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setShowBanner(false);
    setShowIOSSheet(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    if (isIOS) { setShowIOSSheet(true); setShowBanner(false); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner && !showIOSSheet) return null;

  return (
    <>
      {/* Install banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="fixed bottom-24 left-3 right-3 z-[70] rounded-2xl overflow-hidden"
            style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
          >
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center shrink-0">
                <Download size={16} className="text-terracotta" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-['Inter'] font-medium text-foreground leading-tight">Add Mo Katha to Home Screen</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Use it like a real app — no browser chrome</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={handleInstall}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-['Inter'] font-medium text-white bg-terracotta hover:bg-terracotta/90 active:scale-95 transition-all">
                  Install
                </button>
                <button onClick={dismiss} className="w-7 h-7 flex items-center justify-center text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS install guide sheet */}
      <AnimatePresence>
        {showIOSSheet && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={dismiss}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] bg-background rounded-t-3xl px-6 pt-4 pb-10"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              <div className="font-['Playfair_Display'] text-[22px] mb-1">Add to Home Screen</div>
              <div className="text-[12px] text-muted-foreground mb-6">Follow these steps to install Mo Katha on your iPhone or iPad.</div>
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[14px] font-bold text-muted-foreground shrink-0">1</div>
                  <div className="flex-1">
                    <div className="text-[13px] font-['Inter'] font-medium">Tap the Share button</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      Look for <Share size={12} className="inline mx-0.5" /> in Safari's toolbar
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[14px] font-bold text-muted-foreground shrink-0">2</div>
                  <div>
                    <div className="text-[13px] font-['Inter'] font-medium">Tap "Add to Home Screen"</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Scroll down in the share menu</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[14px] font-bold text-muted-foreground shrink-0">3</div>
                  <div>
                    <div className="text-[13px] font-['Inter'] font-medium">Tap "Add"</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Mo Katha will appear on your Home Screen</div>
                  </div>
                </div>
              </div>
              <button onClick={dismiss} className="w-full py-3 rounded-xl border border-border text-[13px] text-muted-foreground">Done</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
