import { useLocation } from "wouter";
import { UserX } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { SettingsShell, SettingsHeader, SectionLabel, SettingsCard, SETTINGS_MUTED } from "./settings-ui";

export default function BlockedUsers() {
  useTitle("Blocked Users");
  const [, setLocation] = useLocation();

  return (
    <SettingsShell>
      <SettingsHeader title="Blocked Users" onBack={() => setLocation("/settings")} />

      <div className="px-5 pb-10">
        <SectionLabel>Blocked accounts</SectionLabel>
        <SettingsCard>
          <div className="px-4 py-8 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(201,168,76,0.10)" }}>
              <UserX size={20} style={{ color: "#C9A84C" }} />
            </div>
            <div className="text-[14px] font-['Inter'] mb-1.5">No blocked accounts</div>
            <div className="text-[12px] font-['Inter'] leading-relaxed max-w-[260px] mx-auto" style={{ color: SETTINGS_MUTED }}>
              Tap the menu on a profile to block someone. Blocked users cannot message you or see your posts.
            </div>
          </div>
        </SettingsCard>
      </div>
    </SettingsShell>
  );
}
