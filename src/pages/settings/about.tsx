import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Shield, FileText, MessageSquare, Heart, ExternalLink } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";

export default function About() {
  useTitle("About Mo Katha");
  const [, setLocation] = useLocation();

  const links = [
    { icon: BookOpen, label: "Community handbook", hint: "How a salon listens to itself" },
    { icon: Shield, label: "Safety guidelines", hint: "What we will not allow" },
    { icon: FileText, label: "Terms of use", hint: "The legal bit, kept short" },
    { icon: FileText, label: "Privacy policy", hint: "What we keep, what we don't" },
    { icon: MessageSquare, label: "Contact support", hint: "hello@mokatha.in" },
  ];

  return (
    <div className="min-h-screen w-full bg-background pb-12">
      <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/85 backdrop-blur-md z-20">
        <button onClick={() => setLocation("/settings")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={16} /></button>
        <div className="font-['Playfair_Display'] text-[18px]">About</div>
      </div>

      <div className="px-6 mt-4">
        <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--ochre)/0.18), hsl(var(--terracotta)/0.18))" }}>
          <div className="font-['Playfair_Display'] text-[36px] leading-none">Mo <span className="italic" style={{ background: "linear-gradient(90deg,hsl(var(--terracotta)),hsl(var(--plum)))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Katha</span></div>
          <div className="text-[12px] mt-2 text-muted-foreground italic font-['Playfair_Display']">A quiet salon for Odia and Hindi voices.</div>
          <div className="text-[10px] mt-3 text-muted-foreground">Version 1.0 · Build 2026.04</div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
          {links.map((l) => (
            <div key={l.label} className="flex items-center gap-3 px-4 py-3.5">
              <l.icon size={16} className="text-muted-foreground" />
              <div className="flex-1">
                <div className="text-[13.5px]">{l.label}</div>
                <div className="text-[11px] text-muted-foreground">{l.hint}</div>
              </div>
              <ExternalLink size={14} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 mt-8 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">Made with <Heart size={11} className="text-terracotta" fill="currentColor" /> in Bhubaneswar</div>
        <div className="text-[10px] text-muted-foreground mt-1">© 2026 Mo Katha · all words belong to their writers</div>
      </div>
    </div>
  );
}
