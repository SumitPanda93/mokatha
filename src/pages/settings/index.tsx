import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  User, Lock, Bell, UserX, Radio, Languages, Moon, Volume2, Wifi,
  HelpCircle, Info, FileText, LogOut, Camera, BadgeCheck, ChevronRight,
} from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { useCurrentUser, logout } from "@/lib/store";
import { initUserPreferences, useUserPreferences } from "@/lib/userPreferences";
import {
  SettingsShell, SettingsHeader, SectionLabel, SettingsCard,
  SettingsLinkRow, SettingsToggleRow, SETTINGS_BORDER, SETTINGS_CARD, SETTINGS_GOLD, SETTINGS_MUTED,
} from "./settings-ui";

const CREATOR_ROLES = ["Writer", "Poet", "Storyteller", "Listener"] as const;

function extractRole(bio?: string): string {
  if (!bio) return "Storyteller";
  const first = bio.split(" · ")[0]?.trim();
  return CREATOR_ROLES.includes(first as typeof CREATOR_ROLES[number]) ? first! : "Storyteller";
}

const LANGUAGE_LABELS: Record<string, string> = {
  or: "Odia",
  hi: "Hindi",
  en: "English",
};

export default function SettingsHome() {
  useTitle("Settings");
  const [, setLocation] = useLocation();
  const { data: user } = useCurrentUser();
  const { prefs, setPref } = useUserPreferences();

  useEffect(() => {
    initUserPreferences();
  }, []);

  const handleLogout = async () => {
    await logout();
    setLocation("/auth/login");
  };

  const languageLabel = user ? (LANGUAGE_LABELS[user.language] ?? "English") : "English";

  return (
    <SettingsShell>
      <SettingsHeader title="Settings" onBack={() => setLocation("/me")} />

      <div className="px-5 pb-8 space-y-6">
        {/* Profile card */}
        {user && (
          <Link href="/settings/account" className="block">
            <div
              className="rounded-2xl p-4 flex items-center gap-3.5 transition-opacity hover:opacity-95 active:opacity-90"
              style={{ background: SETTINGS_CARD, border: `1px solid ${SETTINGS_BORDER}` }}
            >
              <div className="relative shrink-0">
                <div
                  className="w-[58px] h-[58px] rounded-full overflow-hidden"
                  style={{ border: "2px solid rgba(201,168,76,0.35)" }}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[22px]" style={{ background: "rgba(255,255,255,0.06)", color: SETTINGS_MUTED }}>
                      ?
                    </div>
                  )}
                </div>
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E8B14A)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                >
                  <Camera size={11} className="text-[#0A0806]" strokeWidth={2.25} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-['Inter'] font-medium truncate">{user.displayName}</span>
                  {user.verified && <BadgeCheck size={15} className="text-[#6B8E5A] shrink-0" />}
                </div>
                <div className="text-[12px] font-['Inter'] mt-0.5 truncate" style={{ color: SETTINGS_MUTED }}>@{user.handle}</div>
                <span
                  className="inline-block mt-2 text-[10px] font-['Inter'] tracking-[0.08em] uppercase px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(201,168,76,0.14)", color: SETTINGS_GOLD, border: "1px solid rgba(201,168,76,0.28)" }}
                >
                  {extractRole(user.bio)}
                </span>
              </div>

              <ChevronRight size={16} style={{ color: SETTINGS_MUTED }} />
            </div>
          </Link>
        )}

        {/* Account */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <SettingsCard>
            <SettingsLinkRow icon={User} label="Account" hint="Profile, handle, photo" to="/settings/account" />
            <SettingsLinkRow icon={Lock} label="Privacy" hint="Visibility, messages, safety" to="/settings/privacy" />
            <SettingsLinkRow icon={Bell} label="Notifications" hint="Push and email alerts" to="/settings/notifications" />
            <SettingsLinkRow icon={UserX} label="Blocked Users" hint="Manage blocked accounts" to="/settings/blocked" />
          </SettingsCard>
        </section>

        {/* Preferences */}
        <section>
          <SectionLabel>Preferences</SectionLabel>
          <SettingsCard>
            <SettingsLinkRow icon={Radio} label="Mehfil Preferences" hint="Live room defaults" to="/settings/mehfil-preferences" />
            <SettingsLinkRow
              icon={Languages}
              label="Language"
              hint={`Reading language · ${languageLabel}`}
              to="/settings/account"
              trailing={<span className="text-[12px] font-['Inter']" style={{ color: SETTINGS_GOLD }}>{languageLabel}</span>}
            />
            <SettingsToggleRow
              icon={Moon}
              label="Dark Mode"
              hint="Premium dark theme across the app"
              on={prefs.darkMode}
              onChange={(v) => setPref("darkMode", v)}
            />
            <SettingsToggleRow
              icon={Volume2}
              label="Sound Effects"
              hint="UI taps and notification sounds"
              on={prefs.soundEffects}
              onChange={(v) => setPref("soundEffects", v)}
            />
            <SettingsToggleRow
              icon={Wifi}
              label="Data Saver"
              hint="Reduce media quality on cellular"
              on={prefs.dataSaver}
              onChange={(v) => setPref("dataSaver", v)}
            />
          </SettingsCard>
        </section>

        {/* Support & About */}
        <section>
          <SectionLabel>Support & About</SectionLabel>
          <SettingsCard>
            <SettingsLinkRow icon={HelpCircle} label="Help & Support" hint="Contact our team" to="/settings/help" />
            <SettingsLinkRow icon={Info} label="About Mo Katha" hint="Version 1.0.0" to="/settings/about" />
            <SettingsLinkRow icon={FileText} label="Terms & Conditions" hint="Legal and community rules" to="/settings/about" />
            <SettingsLinkRow icon={LogOut} label="Logout" onClick={handleLogout} destructive />
          </SettingsCard>
        </section>

        <div className="text-center text-[10px] font-['Inter'] pt-2" style={{ color: SETTINGS_MUTED }}>
          Mo Katha · Version 1.0.0
        </div>
      </div>
    </SettingsShell>
  );
}
