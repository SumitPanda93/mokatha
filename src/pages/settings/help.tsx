import { useLocation } from "wouter";
import { Mail, MessageSquare, BookOpen, ExternalLink } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { SettingsShell, SettingsHeader, SectionLabel, SettingsCard, SettingsLinkRow, SETTINGS_MUTED } from "./settings-ui";

export default function HelpSupport() {
  useTitle("Help & Support");
  const [, setLocation] = useLocation();

  return (
    <SettingsShell>
      <SettingsHeader title="Help & Support" onBack={() => setLocation("/settings")} />

      <div className="px-5 pb-10 space-y-6">
        <section>
          <SectionLabel>Get in touch</SectionLabel>
          <SettingsCard>
            <SettingsLinkRow
              icon={Mail}
              label="Email support"
              hint="hello@mokatha.in"
              onClick={() => { window.location.href = "mailto:hello@mokatha.in"; }}
            />
            <SettingsLinkRow
              icon={MessageSquare}
              label="Community help"
              hint="Ask in the Mehfil lounge"
              onClick={() => setLocation("/messages")}
            />
            <SettingsLinkRow
              icon={BookOpen}
              label="Community handbook"
              hint="How a salon listens to itself"
              to="/settings/about"
            />
          </SettingsCard>
        </section>

        <div className="rounded-2xl px-5 py-4 text-center" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.18)" }}>
          <div className="font-['Playfair_Display'] text-[18px] mb-1.5">We're here for you</div>
          <div className="text-[12px] font-['Inter'] leading-relaxed" style={{ color: SETTINGS_MUTED }}>
            Most questions are answered within one business day. Include your handle for faster help.
          </div>
          <a
            href="mailto:hello@mokatha.in"
            className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-['Inter']"
            style={{ color: "#C9A84C" }}
          >
            hello@mokatha.in <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </SettingsShell>
  );
}
