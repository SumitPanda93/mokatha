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
function Row({ label, hint, on, set }: any) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1">
        <div className="text-[13.5px]">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <Toggle on={on} onChange={set} />
    </div>
  );
}

export default function NotifSettings() {
  useTitle("Notifications");
  const [, setLocation] = useLocation();
  const [pushAll, setPushAll] = useState(true);
  const [likes, setLikes] = useState(true);
  const [comments, setComments] = useState(true);
  const [follows, setFollows] = useState(true);
  const [tips, setTips] = useState(true);
  const [mehfilLive, setMehfilLive] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [emailWeekly, setEmailWeekly] = useState(true);
  const [emailEarnings, setEmailEarnings] = useState(true);

  return (
    <div className="min-h-screen w-full bg-background pb-12">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/settings")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[18px]">Notifications</div>
      </div>

      <div className="px-5 mt-4 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Push</div>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            <Row label="All push notifications" hint="Master switch" on={pushAll} set={setPushAll} />
            <Row label="Likes on my posts" on={likes && pushAll} set={setLikes} />
            <Row label="Comments and replies" on={comments && pushAll} set={setComments} />
            <Row label="New followers" on={follows && pushAll} set={setFollows} />
            <Row label="Tips received" on={tips && pushAll} set={setTips} />
            <Row label="Mehfil goes live" on={mehfilLive && pushAll} set={setMehfilLive} />
            <Row label="Mentions of @you" on={mentions && pushAll} set={setMentions} />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Email</div>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            <Row label="Weekly digest" hint="Sundays · best of your follows" on={emailWeekly} set={setEmailWeekly} />
            <Row label="Earnings statements" hint="Monthly summary" on={emailEarnings} set={setEmailEarnings} />
          </div>
        </div>

        <div className="text-center text-[10px] text-muted-foreground pt-2">A salon should hum, not shout. We send only what matters.</div>
      </div>
    </div>
  );
}
