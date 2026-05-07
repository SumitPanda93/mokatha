import { useState } from "react";
import AdminShell from "@/components/layout/AdminShell";
import { useTitle } from "@/hooks/useTitle";
import { Save } from "lucide-react";
import { toast } from "sonner";

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <button onClick={() => set(!on)} className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-sage" : "bg-[#333]"}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} /></button>;
}

export default function AdminSettings() {
  useTitle("Admin · Platform settings");
  const [feeBps, setFeeBps] = useState(200);
  const [minWith, setMinWith] = useState(100);
  const [autoMod, setAutoMod] = useState(true);
  const [allowReels, setAllowReels] = useState(true);
  const [allowMehfil, setAllowMehfil] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [tagline, setTagline] = useState("A quiet salon for Odia and Hindi voices.");
  const [welcome, setWelcome] = useState("Tea, tabla, a half-finished poem.");

  return (
    <AdminShell>
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="font-['Playfair_Display'] text-[28px]">Platform settings</div>
          <div className="text-[12px] text-[#A0A0A0]">Knobs that change the feel of the salon.</div>
        </div>
        <button onClick={() => toast.success("Settings saved")} className="px-4 py-2 rounded-xl bg-sage text-[#0F0A14] text-[12px] flex items-center gap-2"><Save size={13} /> Save changes</button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Section title="Money">
          <Field label="Platform fee" hint="Charged on tips received">
            <div className="flex items-center gap-2"><input type="number" value={feeBps / 100} onChange={(e) => setFeeBps(Number(e.target.value) * 100)} className="w-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" /><span className="text-[12px] text-[#A0A0A0]">%</span></div>
          </Field>
          <Field label="Minimum withdrawal">
            <div className="flex items-center gap-2"><span className="text-[13px] text-[#A0A0A0]">₹</span><input type="number" value={minWith} onChange={(e) => setMinWith(Number(e.target.value))} className="w-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" /></div>
          </Field>
        </Section>

        <Section title="Features">
          <Row label="Reels enabled" hint="Short vertical video posts" right={<Toggle on={allowReels} set={setAllowReels} />} />
          <Row label="Mehfil rooms enabled" hint="Live audio sessions" right={<Toggle on={allowMehfil} set={setAllowMehfil} />} />
          <Row label="Auto-moderation" hint="AI pre-screens new posts" right={<Toggle on={autoMod} set={setAutoMod} />} />
        </Section>

        <Section title="Brand voice">
          <Field label="Tagline"><input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" /></Field>
          <Field label="Welcome line"><input value={welcome} onChange={(e) => setWelcome(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] outline-none" /></Field>
        </Section>

        <Section title="Status">
          <Row label="Maintenance mode" hint="App shows a soft pause screen" right={<Toggle on={maintenance} set={setMaintenance} />} />
          <div className="px-4 py-3.5 text-[11px] text-[#A0A0A0]">Build 2026.04 · all systems normal</div>
        </Section>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#A0A0A0] mb-2">{title}</div>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A]">{children}</div>
    </div>
  );
}
function Field({ label, hint, children }: any) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-[12px] mb-1">{label}</div>
      {hint && <div className="text-[11px] text-[#A0A0A0] mb-2">{hint}</div>}
      {children}
    </div>
  );
}
function Row({ label, hint, right }: any) {
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
