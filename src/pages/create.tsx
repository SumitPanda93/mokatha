import { Link } from "wouter";
import { Mic, PenLine, BookOpen, Video } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";

const TYPES = [
  { id: "voice", label: "Voice", sub: "Record a poem or recitation", icon: Mic, to: "/create/voice", color: "hsl(var(--terracotta))", bg: "hsl(var(--terracotta)/0.08)" },
  { id: "text",  label: "Text",  sub: "Write a poem or short piece",  icon: PenLine, to: "/create/text",  color: "hsl(var(--ochre))",      bg: "hsl(var(--ochre)/0.08)" },
  { id: "story", label: "Story", sub: "Long-form prose with chapters", icon: BookOpen, to: "/create/story", color: "hsl(var(--plum))",       bg: "hsl(var(--plum)/0.08)" },
  { id: "reel",  label: "Reel",  sub: "Short visual + audio moment",   icon: Video,    to: "/create/reel",  color: "hsl(var(--sage))",       bg: "hsl(var(--sage)/0.08)" },
] as const;

export default function CreateHub() {
  useTitle("Create");

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <div className="px-5 py-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/40">
        <div className="font-['Playfair_Display'] text-[22px]">Create</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Choose a format to begin</div>
      </div>

      <div className="px-5 pt-5 pb-10 space-y-3">
        {TYPES.map(({ id, label, sub, icon: Icon, to, color, bg }) => (
          <Link key={id} href={to}>
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition-transform cursor-pointer">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-['Playfair_Display'] text-foreground">{label}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>
              </div>
              <div className="text-muted-foreground/40 text-[18px]">›</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
