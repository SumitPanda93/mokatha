import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-terracotta" : "bg-border"}`}>
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function Privacy() {
  useTitle("Privacy & safety");
  const [, setLocation] = useLocation();
  const [privateAcc, setPrivateAcc] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowMentions, setAllowMentions] = useState(true);
  const [hideOdiaOnly, setHideOdiaOnly] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background pb-12">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/settings")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[18px]">Privacy & safety</div>
      </div>

      <div className="px-5 mt-4 space-y-5">
        <Section title="Visibility">
          <Row label="Private account" hint="Only approved followers can see your posts" right={<Toggle on={privateAcc} onChange={setPrivateAcc} />} />
          <Row label="Show wallet balance on profile" right={<Toggle on={showBalance} onChange={setShowBalance} />} />
        </Section>

        <Section title="Interactions">
          <Row label="Allow direct messages" right={<Toggle on={allowMessages} onChange={setAllowMessages} />} />
          <Row label="Allow @mentions" right={<Toggle on={allowMentions} onChange={setAllowMentions} />} />
        </Section>

        <Section title="Content">
          <Row label="Hide content not in my language" hint="Filter feed to only Odia or Hindi as set in profile" right={<Toggle on={hideOdiaOnly} onChange={setHideOdiaOnly} />} />
        </Section>

        <Section title="Blocked accounts">
          <div className="px-4 py-4 text-[12px] text-muted-foreground">No blocked accounts. Tap the (...) menu on a profile to block.</div>
        </Section>

        <button className="w-full text-center py-3.5 rounded-2xl border border-border text-destructive text-[13px]">Deactivate account</button>
      </div>
    </div>
  );
}
function Section({ title, children }: any) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{title}</div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">{children}</div>
    </div>
  );
}
function Row({ label, hint, right }: any) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1">
        <div className="text-[13.5px]">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      {right}
    </div>
  );
}
