import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, Loader2 } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useCurrentUser, uploadAvatar, updateUser, getCurrentUserId, useUpdateUser } from "@/lib/store";
import { toast } from "sonner";

export default function AccountSettings() {
  useTitle("Profile");
  const [, setLocation] = useLocation();
  const { data: user, refetch } = useCurrentUser();
  const updateMutation = useUpdateUser();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocationField] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const me = getCurrentUserId();
    if (!me) { toast.error("Sign in to upload a photo"); return; }

    // Preview immediately
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

  const save = () => {
    const me = getCurrentUserId();
    if (!me) return;
    updateMutation.mutate(
      { id: me, displayName: name, handle, bio, location, language, avatarUrl: avatar },
      { onSuccess: () => setLocation("/settings") }
    );
  };

  if (!user) return <div className="p-10 text-muted-foreground text-center">Sign in to edit your profile.</div>;

  return (
    <div className="min-h-screen w-full bg-background pb-12">
      <div className="px-5 py-3 flex items-center justify-between sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/settings")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="font-['Playfair_Display'] text-[18px]">Profile</div>
        <button
          onClick={save}
          disabled={updateMutation.isPending}
          className="text-[12px] px-3 py-1.5 rounded-full bg-foreground text-background flex items-center gap-1 disabled:opacity-50"
        >
          {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
        </button>
      </div>

      <div className="flex flex-col items-center mt-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted">
            {avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-[32px] text-muted-foreground">?</div>
            }
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Tap camera to change photo</p>
      </div>

      <div className="px-5 mt-6 space-y-4">
        <Field label="Display name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-terracotta" />
        </Field>
        <Field label="Handle">
          <div className="flex items-center bg-card border border-border rounded-xl px-3 py-3">
            <span className="text-[14px] text-muted-foreground">@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))} className="flex-1 bg-transparent outline-none text-[14px] ml-1" />
          </div>
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13px] outline-none focus:border-terracotta resize-none" />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocationField(e.target.value)} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-terracotta" />
        </Field>
        <Field label="Language">
          <div className="flex gap-2">
            {(["or", "hi"] as const).map((l) => (
              <button key={l} onClick={() => setLanguage(l)} className={`px-4 py-2 rounded-full border text-[12px] transition-colors ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
                {l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
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
