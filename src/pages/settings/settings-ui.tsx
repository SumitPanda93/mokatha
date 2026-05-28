import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";

export const SETTINGS_BG = "#0A0806";
export const SETTINGS_GOLD = "#C9A84C";
export const SETTINGS_TEXT = "#F5F3EF";
export const SETTINGS_MUTED = "rgba(245,243,239,0.42)";
export const SETTINGS_CARD = "rgba(255,255,255,0.045)";
export const SETTINGS_BORDER = "rgba(255,255,255,0.08)";

export function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ background: SETTINGS_BG, color: SETTINGS_TEXT }}>
      <div
        className="fixed top-[-60px] right-[-40px] w-[240px] h-[240px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 70%)", filter: "blur(48px)" }}
      />
      <div
        className="fixed bottom-[120px] left-[-50px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(247,106,74,0.07) 0%, transparent 70%)", filter: "blur(52px)" }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-20 px-5 pt-3 pb-4" style={{ background: "rgba(10,8,6,0.88)", backdropFilter: "blur(16px)" }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ border: `1px solid ${SETTINGS_BORDER}`, background: SETTINGS_CARD }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="font-['Playfair_Display'] text-[26px] leading-none">{title}</div>
      </div>
      <div
        className="mt-3 h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.65) 35%, rgba(201,168,76,0.25) 65%, transparent)" }}
      />
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-['Inter'] uppercase tracking-[0.24em] mb-2.5 px-1"
      style={{ color: SETTINGS_GOLD }}
    >
      {children}
    </div>
  );
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-[rgba(255,255,255,0.08)]"
      style={{ background: SETTINGS_CARD, border: `1px solid ${SETTINGS_BORDER}` }}
    >
      {children}
    </div>
  );
}

export function GoldToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
      style={{ background: on ? "linear-gradient(90deg, #C9A84C, #E8B14A)" : "rgba(255,255,255,0.12)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

type SettingsLinkRowProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
};

export function SettingsLinkRow({ icon: Icon, label, hint, to, onClick, trailing, destructive }: SettingsLinkRowProps) {
  const inner = (
    <>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: destructive ? "rgba(239,68,68,0.12)" : "rgba(201,168,76,0.10)" }}
      >
        <Icon size={16} style={{ color: destructive ? "#f87171" : SETTINGS_GOLD }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-['Inter']" style={{ color: destructive ? "#f87171" : SETTINGS_TEXT }}>{label}</div>
        {hint && <div className="text-[11px] font-['Inter'] mt-0.5 truncate" style={{ color: SETTINGS_MUTED }}>{hint}</div>}
      </div>
      {trailing ?? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: SETTINGS_MUTED }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </>
  );

  const className = "flex items-center gap-3 px-4 py-3.5 w-full text-left transition-opacity hover:opacity-90 active:opacity-75";

  if (to) {
    return <Link href={to} className={className}>{inner}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function SettingsToggleRow({
  icon: Icon, label, hint, on, onChange,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.10)" }}>
        <Icon size={16} style={{ color: SETTINGS_GOLD }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-['Inter']">{label}</div>
        {hint && <div className="text-[11px] font-['Inter'] mt-0.5" style={{ color: SETTINGS_MUTED }}>{hint}</div>}
      </div>
      <GoldToggle on={on} onChange={onChange} />
    </div>
  );
}
