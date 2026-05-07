import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useRegisterUserWithAuth } from "@/lib/store";

const AVATARS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces",
];

export default function ProfileSetup() {
  useTitle("Set up your space");
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const register = useRegisterUserWithAuth();

  const finish = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    register.mutate(
      { displayName: name.trim(), language },
      { onSuccess: (user) => {
          import("@/lib/store").then(({ updateUser }) => {
            updateUser(user.id, { avatarUrl: avatar, bio });
          });
          setLocation("/");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="px-6 pt-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Profile setup</div>
        <div className="font-['Playfair_Display'] text-[32px] leading-tight mt-1">
          Make this room{" "}
          <span className="italic" style={{ background: "linear-gradient(90deg,hsl(var(--terracotta)),hsl(var(--plum)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            yours
          </span>
        </div>
        <div className="text-[13px] text-muted-foreground mt-2">A picture, a line, a voice. Just enough so other readers can find you.</div>
      </div>

      <form onSubmit={finish} className="flex-1 flex flex-col">
        <div className="px-6 mt-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Your name</div>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Full name" autoFocus
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[16px] font-['Playfair_Display'] outline-none focus:border-terracotta"
          />
        </div>

        <div className="px-6 mt-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Pick a portrait</div>
          <div className="grid grid-cols-3 gap-3">
            {AVATARS.map((a) => (
              <motion.button whileTap={{ scale: 0.95 }} type="button" key={a} onClick={() => setAvatar(a)}
                className={`relative aspect-square rounded-2xl overflow-hidden border-2 ${avatar === a ? "border-terracotta" : "border-transparent"}`}>
                <img src={a} alt="" className="w-full h-full object-cover" />
                {avatar === a && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-terracotta text-white flex items-center justify-center"><Check size={12} /></div>}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-6 mt-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">A line about you</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Writes from the kitchen window…" rows={3}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[13.5px] outline-none focus:border-terracotta resize-none" />
        </div>

        <div className="px-6 mt-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Your language</div>
          <div className="flex gap-2">
            {(["or", "hi"] as const).map((l) => (
              <button type="button" key={l} onClick={() => setLanguage(l)}
                className={`flex-1 py-3 rounded-xl border ${language === l ? "bg-foreground text-background border-foreground" : "border-border"}`}>
                <div className="font-['Playfair_Display'] text-[18px]">{l === "or" ? "ଓଡ଼ିଆ" : "हिन्दी"}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] mt-0.5 opacity-70">{l === "or" ? "Odia" : "Hindi"}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 mt-8 mb-10 mt-auto">
          <button type="submit" disabled={name.trim().length < 2 || register.isPending}
            className="w-full py-3.5 rounded-xl bg-foreground text-background text-[14px] disabled:opacity-50 transition-all">
            {register.isPending ? "Creating account…" : "Enter the salon"}
          </button>
        </div>
      </form>
    </div>
  );
}
