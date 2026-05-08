import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, Loader2, Eye, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useCurrentUser, uploadAvatar, updateUser, getCurrentUserId, useUpdateUser,
  checkHandleAvailable, useDeactivateAccount,
} from "@/lib/store";
import { toast } from "sonner";

// ─── Normalise handle input ────────────────────────────────────────────────────
function normaliseHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 30);
}

function isValidHandle(h: string): boolean {
  return /^[a-z0-9][a-z0-9_.]{1,29}$/.test(h);
}

// ─── Deactivate Confirmation Sheet ────────────────────────────────────────────
function DeactivateSheet({ onClose, onConfirm, pending }: {
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative rounded-t-3xl bg-background border-t border-border px-6 pt-6 pb-10"
      >
        {/* Handle bar */}
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-6" />

        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <X size={15} className="text-muted-foreground" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-destructive" />
        </div>

        <h2 className="font-['Playfair_Display'] text-[22px] mb-2">Deactivate your account?</h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
          Your profile and stories will be hidden from others. Your data is safely
          preserved — you can reactivate any time by signing back in and contacting
          our team.
        </p>

        <div className="space-y-2.5 text-[12px] text-muted-foreground bg-muted/50 rounded-2xl px-4 py-3 mb-6">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">·</span>
            Profile hidden immediately
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">·</span>
            You will be signed out
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">·</span>
            Content and earnings preserved
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onConfirm}
          disabled={pending}
          className="w-full py-3.5 rounded-2xl bg-destructive text-destructive-foreground text-[14px] font-['Inter'] font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {pending
            ? <><Loader2 size={14} className="animate-spin" /> Deactivating…</>
            : "Yes, deactivate my account"}
        </motion.button>

        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-[13px] text-muted-foreground font-['Inter'] hover:text-foreground transition-colors"
        >
          Keep my account
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AccountSettings() {
  useTitle("Profile");
  const [, setLocation] = useLocation();
  const { data: user, refetch } = useCurrentUser();
  const updateMutation = useUpdateUser();
  const deactivateMutation = useDeactivateAccount();

  const [name, setName]           = useState("");
  const [handle, setHandle]       = useState("");
  const [bio, setBio]             = useState("");
  const [location, setLocationField] = useState("");
  const [language, setLanguage]   = useState<"or" | "hi">("or");
  const [avatar, setAvatar]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  // Handle availability state
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const handleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.displayName);
      setHandle(user.handle);
      setBio(user.bio ?? "");
      setLocationField(user.location ?? "");
      setLanguage(user.language ?? "or");
      setAvatar(user.avatarUrl);
    }
  }, [user?.id]);

  // ── Handle change with debounced availability check ──────────────────────────
  const onHandleChange = useCallback((raw: string) => {
    const normalised = normaliseHandle(raw);
    setHandle(normalised);

    if (handleDebounceRef.current) clearTimeout(handleDebounceRef.current);

    if (!isValidHandle(normalised)) {
      setHandleStatus(normalised.length < 2 ? "idle" : "invalid");
      return;
    }
    if (user && normalised === user.handle.toLowerCase()) {
      setHandleStatus("idle");
      return;
    }

    setHandleStatus("checking");
    handleDebounceRef.current = setTimeout(async () => {
      try {
        const available = await checkHandleAvailable(normalised, user?.id ?? "");
        setHandleStatus(available ? "available" : "taken");
      } catch {
        setHandleStatus("idle");
      }
    }, 500);
  }, [user]);

  // ── Avatar upload ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in to upload a photo"); return; }
    const localUrl = URL.createObjectURL(file);
    setAvatar(localUrl);
    setUploading(true);
    try {
      const url = await uploadAvatar(me, file);
      setAvatar(url);
      await updateUser(me, { avatarUrl: url });
      await refetch();
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
      setAvatar(user?.avatarUrl ?? "");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────────
  const save = () => {
    const me = getCurrentUserId();
    if (!me) return;
    if (handleStatus === "taken") { toast.error("Handle is taken — choose a different one"); return; }
    if (handleStatus === "invalid") { toast.error("Handle must be 2–30 characters, letters/numbers/dots/underscores only"); return; }
    updateMutation.mutate(
      { id: me, displayName: name, handle, bio, location, language, avatarUrl: avatar },
      { onSuccess: () => setLocation("/settings") },
    );
  };

  // ── Deactivate ────────────────────────────────────────────────────────────────
  const confirmDeactivate = () => {
    deactivateMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Account deactivated. You have been signed out.");
        setLocation("/auth/login");
      },
    });
  };

  if (!user) return <div className="p-10 text-muted-foreground text-center">Sign in to edit your profile.</div>;

  const handleIndicator = () => {
    if (handleStatus === "checking") return <Loader2 size={12} className="animate-spin text-muted-foreground" />;
    if (handleStatus === "available") return <Check size={12} className="text-emerald-500" />;
    if (handleStatus === "taken") return <span className="text-[11px] text-destructive">taken</span>;
    if (handleStatus === "invalid") return <span className="text-[11px] text-amber-500">invalid</span>;
    return null;
  };

  return (
    <>
      <div className="min-h-screen w-full bg-background pb-16">
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between sticky top-0 bg-background/85 backdrop-blur-md z-20">
          <button onClick={() => setLocation("/settings")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div className="font-['Playfair_Display'] text-[18px]">Profile</div>
          <button
            onClick={save}
            disabled={updateMutation.isPending || handleStatus === "taken"}
            className="text-[12px] px-3 py-1.5 rounded-full bg-foreground text-background flex items-center gap-1 disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mt-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted">
              {avatar
                ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[32px] text-muted-foreground">?</div>}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-md hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Tap camera to change photo</p>
        </div>

        {/* "View as visitor" shortcut */}
        <div className="px-5 mt-5">
          <button
            onClick={() => setLocation(`/u/${user.handle}`)}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-card border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye size={15} />
            <span>Preview profile as visitor</span>
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 mt-5 space-y-4">
          <Field label="Display name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-terracotta transition-colors"
            />
          </Field>

          <Field label="Handle">
            <div className={`flex items-center bg-card border rounded-xl px-3 py-3 transition-colors ${
              handleStatus === "taken" ? "border-destructive" :
              handleStatus === "available" ? "border-emerald-500/60" :
              handleStatus === "invalid" ? "border-amber-500/60" :
              "border-border focus-within:border-terracotta"
            }`}>
              <span className="text-[14px] text-muted-foreground">@</span>
              <input
                value={handle}
                onChange={(e) => onHandleChange(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[14px] ml-1"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="ml-2 flex items-center">{handleIndicator()}</div>
            </div>
            <AnimatePresence>
              {handleStatus === "available" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-[11px] text-emerald-500 mt-1 px-1">
                  @{handle} is available
                </motion.div>
              )}
              {handleStatus === "taken" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-[11px] text-destructive mt-1 px-1">
                  This handle is taken
                </motion.div>
              )}
              {handleStatus === "invalid" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-[11px] text-amber-500 mt-1 px-1">
                  2–30 chars, letters/numbers/dots/underscores only
                </motion.div>
              )}
            </AnimatePresence>
          </Field>

          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] outline-none focus:border-terracotta resize-none transition-colors"
            />
          </Field>

          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocationField(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-terracotta transition-colors"
            />
          </Field>

          <Field label="Language">
            <div className="flex gap-2">
              {(["or", "hi"] as const).map((l) => (
                <button key={l} onClick={() => setLanguage(l)}
                  className={`px-4 py-2 rounded-full border text-[12px] transition-colors ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
                  {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Danger zone */}
        <div className="px-5 mt-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Danger zone</div>
          <div className="bg-card border border-border rounded-2xl px-4 py-4">
            <div className="text-[13px] font-medium mb-1">Deactivate account</div>
            <div className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
              Your profile will be hidden. Your stories and earnings are preserved.
            </div>
            <button
              onClick={() => setShowDeactivate(true)}
              className="text-[12px] text-destructive border border-destructive/30 rounded-xl px-4 py-2.5 hover:bg-destructive/5 transition-colors"
            >
              Deactivate my account
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate confirmation sheet */}
      <AnimatePresence>
        {showDeactivate && (
          <DeactivateSheet
            onClose={() => setShowDeactivate(false)}
            onConfirm={confirmDeactivate}
            pending={deactivateMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
