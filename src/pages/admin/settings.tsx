import { useState } from "react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAdminConfig, useSetAdminConfig } from "@/lib/store";

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)}
      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-sage" : "bg-[#333]"}`}>
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function AdminSettings() {
  useTitle("Admin · Platform settings");
  const { data: config, isLoading: configLoading } = useAdminConfig();
  const setConfig = useSetAdminConfig();

  // Platform toggles (local state — not yet DB-backed for these)
  const [autoMod,    setAutoMod]    = useState(true);
  const [allowReels, setAllowReels] = useState(true);
  const [allowMehfil, setAllowMehfil] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [tagline, setTagline] = useState("A quiet salon for Odia and Hindi voices.");
  const [welcome, setWelcome] = useState("Tea, tabla, a half-finished poem.");

  // Monetization limits (from DB)
  const [maxSupport,   setMaxSupport]   = useState<number | null>(null);
  const [dailyLimit,   setDailyLimit]   = useState<number | null>(null);
  const [maxWithdraw,  setMaxWithdraw]  = useState<number | null>(null);
  const [mehfilCap,    setMehfilCap]    = useState<number | null>(null);
  const [rewardsOn,    setRewardsOn]    = useState<boolean | null>(null);

  // Hydrate local sliders from DB once loaded
  const effectiveMaxSupport  = maxSupport  ?? config?.max_support_amount  ?? 5;
  const effectiveDailyLimit  = dailyLimit  ?? config?.daily_support_limit ?? 25;
  const effectiveMaxWithdraw = maxWithdraw ?? config?.max_withdrawal_limit ?? 500;
  const effectiveMehfilCap   = mehfilCap   ?? config?.mehfil_ticket_cap   ?? 5;
  const effectiveRewardsOn   = rewardsOn   ?? (config?.reader_rewards_enabled ?? true);

  const savePlatform = () => toast.success("Platform settings saved");

  const saveMonetization = async () => {
    await Promise.all([
      setConfig.mutateAsync({ key: "max_support_amount",   value: String(effectiveMaxSupport)  }),
      setConfig.mutateAsync({ key: "daily_support_limit",  value: String(effectiveDailyLimit)  }),
      setConfig.mutateAsync({ key: "max_withdrawal_limit", value: String(effectiveMaxWithdraw) }),
      setConfig.mutateAsync({ key: "mehfil_ticket_cap",    value: String(effectiveMehfilCap)   }),
      setConfig.mutateAsync({ key: "reader_rewards_enabled", value: String(effectiveRewardsOn) }),
    ]);
  };

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Platform settings</div>
          <div className="text-[12px] text-[#A0A0A0]">Knobs that shape the salon experience.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* ── Monetization limits (DB-backed) ── */}
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-2">Monetization limits</div>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">
            {configLoading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-[12px] text-[#A0A0A0]">
                <RefreshCw size={13} className="animate-spin" /> Loading config…
              </div>
            ) : (
              <>
                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13px] mb-0.5">Max support per action</div>
                      <div className="text-[11px] text-[#A0A0A0]">Cap on ☕🌹👏📖 appreciation amounts</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#A0A0A0]">₹</span>
                      <input type="number" min={1} max={500} value={effectiveMaxSupport}
                        onChange={(e) => setMaxSupport(Number(e.target.value))}
                        className="w-20 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none text-right" />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13px] mb-0.5">Daily support limit per reader</div>
                      <div className="text-[11px] text-[#A0A0A0]">Total appreciation a reader can send per day</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#A0A0A0]">₹</span>
                      <input type="number" min={1} max={5000} value={effectiveDailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value))}
                        className="w-20 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none text-right" />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13px] mb-0.5">Max withdrawal limit</div>
                      <div className="text-[11px] text-[#A0A0A0]">Maximum single withdrawal amount</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#A0A0A0]">₹</span>
                      <input type="number" min={10} max={100000} value={effectiveMaxWithdraw}
                        onChange={(e) => setMaxWithdraw(Number(e.target.value))}
                        className="w-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none text-right" />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[13px] mb-0.5">Mehfil ticket cap</div>
                      <div className="text-[11px] text-[#A0A0A0]">Maximum ticket price hosts can set</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#A0A0A0]">₹</span>
                      <input type="number" min={0} max={500} value={effectiveMehfilCap}
                        onChange={(e) => setMehfilCap(Number(e.target.value))}
                        className="w-20 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none text-right" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1">
                    <div className="text-[13px]">Reader rewards (Ink) enabled</div>
                    <div className="text-[11px] text-[#A0A0A0]">Ink points for reading, joining Mehfils, sharing</div>
                  </div>
                  <Toggle on={effectiveRewardsOn} set={(v) => setRewardsOn(v)} />
                </div>

                <div className="px-4 py-3">
                  <button onClick={saveMonetization} disabled={setConfig.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sage text-[#0F0A14] text-[12px] font-medium">
                    {setConfig.isPending
                      ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
                      : <><Save size={12} /> Save monetization limits</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Money ── */}
        <Section title="Money">
          <Field label="Platform fee" hint="Charged on tips received">
            <div className="flex items-center gap-2">
              <input type="number" defaultValue={2} min={0} max={100}
                className="w-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" />
              <span className="text-[12px] text-[#A0A0A0]">%</span>
            </div>
          </Field>
        </Section>

        {/* ── Features ── */}
        <Section title="Features">
          <Row label="Reels enabled"       hint="Short vertical video posts"    right={<Toggle on={allowReels}  set={setAllowReels}  />} />
          <Row label="Mehfil rooms enabled" hint="Live audio sessions"           right={<Toggle on={allowMehfil} set={setAllowMehfil} />} />
          <Row label="Auto-moderation"     hint="AI pre-screens new posts"       right={<Toggle on={autoMod}     set={setAutoMod}     />} />
        </Section>

        {/* ── Brand voice ── */}
        <Section title="Brand voice">
          <Field label="Tagline">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" />
          </Field>
          <Field label="Welcome line">
            <input value={welcome} onChange={(e) => setWelcome(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" />
          </Field>
        </Section>

        {/* ── Status ── */}
        <Section title="Status">
          <Row label="Maintenance mode" hint="App shows a soft pause screen"
            right={<Toggle on={maintenance} set={setMaintenance} />} />
          <div className="px-4 py-3.5 text-[11px] text-[#A0A0A0]">Build 2026.05 · all systems normal</div>
        </Section>
      </div>

      {/* Save platform settings */}
      <div className="mt-6 flex justify-end">
        <button onClick={savePlatform}
          className="px-5 py-2.5 rounded-xl bg-sage text-[#0F0A14] text-[12px] font-medium flex items-center gap-2">
          <Save size={13} /> Save platform settings
        </button>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-2">{title}</div>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">{children}</div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-[12px] mb-1">{label}</div>
      {hint && <div className="text-[11px] text-[#A0A0A0] mb-2">{hint}</div>}
      {children}
    </div>
  );
}
function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1">
        <div className="text-[13px]">{label}</div>
        {hint && <div className="text-[11px] text-[#A0A0A0]">{hint}</div>}
      </div>
      {right}
    </div>
  );
}
