import { useState } from "react";
import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useCurrentUser, usePostsRealtime } from "@/lib/store";
import { useAuthState } from "@/lib/auth";
import { ProfileView } from "@/components/profile/ProfileView";
import { ProfileShell, PROFILE_MUTED } from "@/components/profile/profile-ui";

export default function Profile() {
  useTitle("Profile");
  const [, setLocation] = useLocation();
  const { ready } = useAuthState();
  const { data: user } = useCurrentUser();
  const [viewAs, setViewAs] = useState(false);
  usePostsRealtime();

  if (!ready) {
    return (
      <ProfileShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
        </div>
      </ProfileShell>
    );
  }

  if (!user) {
    return (
      <ProfileShell>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="font-['Playfair_Display'] text-[18px]">Profile</div>
          <div className="w-9 h-9" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center pb-24 min-h-[60vh]">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <Settings size={26} style={{ color: PROFILE_MUTED }} />
          </div>
          <div>
            <div className="font-['Playfair_Display'] text-[24px] mb-2">Your profile awaits</div>
            <div className="text-[13px] leading-relaxed" style={{ color: PROFILE_MUTED }}>
              Sign in to manage your stories, track earnings and Ink Points.
            </div>
          </div>
          <button
            onClick={() => setLocation("/auth/login")}
            className="px-10 py-3.5 rounded-full text-[14px] font-['Inter'] font-medium"
            style={{ background: "linear-gradient(90deg, #C9A84C, #E8B14A)", color: "#0A0806" }}
          >
            Sign in
          </button>
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileView
      user={user}
      isOwnProfile
      viewAsVisitor={viewAs}
      onToggleViewAs={() => setViewAs((v) => !v)}
    />
  );
}
