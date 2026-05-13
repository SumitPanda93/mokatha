/**
 * Premium profile sharing — copy, WhatsApp, Instagram hint, native share.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Share2 } from "lucide-react";
import { SHEET_SPRING } from "@/lib/motionTokens";
import { toast } from "sonner";

export type ProfileShareSheetProps = {
  open: boolean;
  onClose: () => void;
  profileUrl: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
};

export function ProfileShareSheet({
  open,
  onClose,
  profileUrl,
  displayName,
  handle,
  avatarUrl,
}: ProfileShareSheetProps) {
  const line = `${displayName} — Mo Katha\n${profileUrl}`;

  const copyLink = () => {
    void navigator.clipboard?.writeText(profileUrl);
    toast.success("Profile link copied");
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(line)}`, "_blank", "noopener,noreferrer");
  };

  const shareInstagramHint = () => {
    void navigator.clipboard?.writeText(profileUrl);
    toast.message("Link copied — paste it in an Instagram Story link sticker");
  };

  const shareNative = async () => {
    if (!navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${displayName} · Mo Katha`,
        text: `@${handle}`,
        url: profileUrl,
      });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-black/48 backdrop-blur-[3px] border-0 p-0 cursor-default"
            aria-label="Close share"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            exit={{ y: "105%" }}
            transition={SHEET_SPRING}
            className="relative mx-3 mb-[max(env(safe-area-inset-bottom),12px)] rounded-[26px] border border-border/45 bg-background/97 backdrop-blur-2xl px-5 pt-4 pb-6 shadow-[0_-12px_48px_rgba(0,0,0,0.18)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-['Inter'] uppercase tracking-[0.28em] text-muted-foreground">Share profile</span>
              <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors" aria-label="Close">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex gap-3.5 p-3.5 rounded-2xl border border-border/35 bg-card/55 mb-5">
              <div className="w-[52px] h-[52px] rounded-xl overflow-hidden shrink-0 bg-muted ring-1 ring-black/[0.06]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-['Playfair_Display'] text-lg text-muted-foreground">{displayName.charAt(0)}</div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="font-['Playfair_Display'] text-[18px] leading-tight text-foreground truncate">{displayName}</div>
                <div className="text-[11px] font-['Inter'] text-muted-foreground mt-1">@{handle}</div>
                <div className="text-[10px] font-['Inter'] text-muted-foreground/70 mt-2 truncate">{profileUrl.replace(/^https?:\/\//, "")}</div>
              </div>
            </div>

            <div className="space-y-2 font-['Inter']">
              {"share" in navigator && typeof navigator.share === "function" ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => void shareNative()}
                  className="w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-border/40 bg-foreground text-background text-[14px] font-medium"
                >
                  <Share2 size={17} strokeWidth={1.75} />
                  Share via…
                </motion.button>
              ) : null}

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={copyLink}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-border/45 bg-card/70 text-[14px]"
              >
                <Link2 size={17} strokeWidth={1.75} className="text-muted-foreground" />
                Copy profile link
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={shareWhatsApp}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-border/45 bg-card/70 text-[14px]"
              >
                <span className="text-[15px] leading-none" aria-hidden>💬</span>
                WhatsApp
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={shareInstagramHint}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-border/45 bg-card/70 text-[14px]"
              >
                <span className="text-[15px] leading-none" aria-hidden>📷</span>
                Instagram Story
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
