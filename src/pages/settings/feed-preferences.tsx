import { useLocation } from "wouter";
import { SlidersHorizontal } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  SettingsShell, SettingsHeader, SectionLabel, SettingsCard, SettingsToggleRow,
  SETTINGS_GOLD, SETTINGS_MUTED,
} from "./settings-ui";
import { FEED_FILTERS, type FeedFilter } from "@/components/feed/home-feed-ui";
import { useFeedPreferences } from "@/lib/feedPreferences";

export default function FeedPreferencesPage() {
  useTitle("Feed preferences");
  const [, setLocation] = useLocation();
  const { prefs, setPref, resetPrefs } = useFeedPreferences();

  return (
    <SettingsShell>
      <SettingsHeader title="Feed preferences" onBack={() => setLocation("/")} />

      <div className="px-5 pb-10 space-y-6">
        <p className="text-[12px] font-['Inter'] leading-relaxed" style={{ color: SETTINGS_MUTED }}>
          Shape what appears on your home feed and which tab opens first.
        </p>

        <section>
          <SectionLabel>Default tab</SectionLabel>
          <SettingsCard>
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {FEED_FILTERS.map((f) => {
                const active = prefs.defaultFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPref("defaultFilter", f as FeedFilter)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-['Inter'] border transition-colors"
                    style={
                      active
                        ? { background: "rgba(201,168,76,0.18)", borderColor: "rgba(201,168,76,0.45)", color: SETTINGS_GOLD }
                        : { borderColor: "rgba(255,255,255,0.08)", color: SETTINGS_MUTED }
                    }
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </SettingsCard>
        </section>

        <section>
          <SectionLabel>Content on home (All tab)</SectionLabel>
          <SettingsCard>
            <SettingsToggleRow icon={SlidersHorizontal} label="Voice posts" hint="Audio stories and poems" on={prefs.showVoice} onChange={(v) => setPref("showVoice", v)} />
            <SettingsToggleRow icon={SlidersHorizontal} label="Text & stories" hint="Written katha and chapters" on={prefs.showText} onChange={(v) => setPref("showText", v)} />
            <SettingsToggleRow icon={SlidersHorizontal} label="Reels" hint="Short vertical clips" on={prefs.showReels} onChange={(v) => setPref("showReels", v)} />
            <SettingsToggleRow icon={SlidersHorizontal} label="Live Mehfil cards" hint="Rooms in the masonry feed" on={prefs.showMehfil} onChange={(v) => setPref("showMehfil", v)} />
            <SettingsToggleRow icon={SlidersHorizontal} label="Live rings on stories" hint="Highlight hosts who are live" on={prefs.showLiveInStories} onChange={(v) => setPref("showLiveInStories", v)} />
            <SettingsToggleRow icon={SlidersHorizontal} label="Data saver feed" hint="Prefer smaller previews" on={prefs.dataSaverFeed} onChange={(v) => setPref("dataSaverFeed", v)} />
          </SettingsCard>
        </section>

        <button
          type="button"
          onClick={resetPrefs}
          className="w-full py-3 rounded-xl text-[13px] font-['Inter'] border"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: SETTINGS_MUTED }}
        >
          Reset to defaults
        </button>
      </div>
    </SettingsShell>
  );
}
