import { useState } from "react";
import { useLocation } from "wouter";
import { Radio, Mic, Video, Bell } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import { SettingsShell, SettingsHeader, SectionLabel, SettingsCard, SettingsToggleRow } from "./settings-ui";

export default function MehfilPreferences() {
  useTitle("Mehfil Preferences");
  const [, setLocation] = useLocation();

  const [autoJoinAudio, setAutoJoinAudio] = useState(true);
  const [cameraDefault, setCameraDefault] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState(true);
  const [handRaiseSound, setHandRaiseSound] = useState(true);

  return (
    <SettingsShell>
      <SettingsHeader title="Mehfil Preferences" onBack={() => setLocation("/settings")} />

      <div className="px-5 pb-10 space-y-6">
        <section>
          <SectionLabel>Live rooms</SectionLabel>
          <SettingsCard>
            <SettingsToggleRow
              icon={Mic}
              label="Auto-join with mic muted"
              hint="Join as listener with mic off"
              on={autoJoinAudio}
              onChange={setAutoJoinAudio}
            />
            <SettingsToggleRow
              icon={Video}
              label="Camera on by default"
              hint="For studio Mehfils you host"
              on={cameraDefault}
              onChange={setCameraDefault}
            />
            <SettingsToggleRow
              icon={Bell}
              label="Live session alerts"
              hint="When followed hosts go live"
              on={liveAlerts}
              onChange={setLiveAlerts}
            />
            <SettingsToggleRow
              icon={Radio}
              label="Hand-raise sound"
              hint="Subtle chime when you're called"
              on={handRaiseSound}
              onChange={setHandRaiseSound}
            />
          </SettingsCard>
        </section>

        <p className="text-[11px] font-['Inter'] text-center leading-relaxed px-4" style={{ color: "rgba(245,243,239,0.38)" }}>
          Preferences are saved locally for now. Server sync coming soon.
        </p>
      </div>
    </SettingsShell>
  );
}
