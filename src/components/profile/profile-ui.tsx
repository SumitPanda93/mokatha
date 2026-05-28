import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  SETTINGS_BG,
  SETTINGS_BORDER,
  SETTINGS_CARD,
  SETTINGS_GOLD,
  SETTINGS_MUTED,
  SETTINGS_TEXT,
} from "@/pages/settings/settings-ui";

export {
  SETTINGS_BG as PROFILE_BG,
  SETTINGS_GOLD as PROFILE_GOLD,
  SETTINGS_TEXT as PROFILE_TEXT,
  SETTINGS_MUTED as PROFILE_MUTED,
  SETTINGS_CARD as PROFILE_CARD,
  SETTINGS_BORDER as PROFILE_BORDER,
};

const PROFILE_VERIFIED_BLUE = "#3B82F6";

export function formatProfileStat(value: number): string {
  if (value >= 10_000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (value >= 1_000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full relative overflow-x-hidden pb-24" style={{ background: SETTINGS_BG, color: SETTINGS_TEXT }}>
      <ProfileParticleHeader />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function ProfileParticleHeader() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[280px] pointer-events-none overflow-hidden">
      {/* Deep black base */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #050403 0%, #0A0806 55%, transparent 100%)",
        }}
      />

      {/* Flowing gold wave ribbon */}
      <svg
        className="absolute top-0 left-0 w-full h-[180px] opacity-90"
        viewBox="0 0 390 180"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="profile-wave-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(201,168,76,0)" />
            <stop offset="35%" stopColor="rgba(201,168,76,0.22)" />
            <stop offset="55%" stopColor="rgba(232,177,74,0.38)" />
            <stop offset="75%" stopColor="rgba(201,168,76,0.14)" />
            <stop offset="100%" stopColor="rgba(201,168,76,0)" />
          </linearGradient>
          <linearGradient id="profile-wave-gold-soft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(232,177,74,0)" />
            <stop offset="50%" stopColor="rgba(201,168,76,0.12)" />
            <stop offset="100%" stopColor="rgba(232,177,74,0)" />
          </linearGradient>
          <filter id="profile-wave-blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <path
          d="M-20 42 C 80 8, 160 72, 260 38 S 420 18, 420 18 L 420 0 L -20 0 Z"
          fill="url(#profile-wave-gold)"
          filter="url(#profile-wave-blur)"
          opacity="0.85"
        />
        <path
          d="M-30 68 C 90 28, 200 88, 310 52 S 430 32, 430 32"
          fill="none"
          stroke="url(#profile-wave-gold-soft)"
          strokeWidth="1.5"
          opacity="0.7"
        />
      </svg>

      {/* Particle streaks */}
      {[...Array(14)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${1 + (i % 2)}px`,
            height: `${18 + (i % 5) * 10}px`,
            top: `${12 + (i * 13) % 120}px`,
            left: `${4 + (i * 17) % 92}%`,
            background: `linear-gradient(180deg, rgba(232,177,74,${0.35 + (i % 4) * 0.1}) 0%, rgba(201,168,76,0.05) 55%, transparent 100%)`,
            transform: `rotate(${-32 + (i % 7) * 11}deg)`,
            filter: "blur(0.4px)",
            opacity: 0.55 + (i % 3) * 0.15,
          }}
        />
      ))}

      {/* Ambient glow orbs */}
      <div
        className="absolute top-[-20px] right-[-10px] w-[240px] h-[200px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.22) 0%, transparent 68%)", filter: "blur(48px)" }}
      />
      <div
        className="absolute top-[40px] left-[-60px] w-[180px] h-[180px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(177,74,139,0.14) 0%, transparent 70%)", filter: "blur(52px)" }}
      />
      <div
        className="absolute top-[90px] right-[20%] w-[120px] h-[80px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,177,74,0.16) 0%, transparent 72%)", filter: "blur(36px)" }}
      />

      {/* Bottom fade into page */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{ background: "linear-gradient(to bottom, transparent, #0A0806)" }}
      />
    </div>
  );
}

export function ProfileTopBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky top-0 z-30 px-5 pb-2 flex items-center justify-between"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        background: "linear-gradient(180deg, rgba(5,4,3,0.92) 0%, rgba(10,8,6,0.72) 70%, transparent 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {children}
    </div>
  );
}

export function ProfileIconButton({
  children,
  onClick,
  label,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  variant?: "default" | "ghost";
}) {
  const ghost = variant === "ghost";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90 active:scale-95"
      style={
        ghost
          ? {
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }
          : { border: `1px solid ${SETTINGS_BORDER}`, background: SETTINGS_CARD }
      }
    >
      {children}
    </button>
  );
}

function HexVerifiedBadge() {
  return (
    <div
      className="absolute -top-0.5 -right-0.5 w-[26px] h-[26px] flex items-center justify-center"
      style={{
        filter: "drop-shadow(0 2px 6px rgba(201,168,76,0.55))",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <path
          d="M13 1.5L22.5 7v12L13 24.5 3.5 19V7L13 1.5z"
          fill="url(#hex-gold)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.75"
        />
        <defs>
          <linearGradient id="hex-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8B14A" />
            <stop offset="100%" stopColor="#C9A84C" />
          </linearGradient>
        </defs>
        <path
          d="M8.5 13.2l2.8 2.8 6.2-6.4"
          fill="none"
          stroke="#0A0806"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function ProfileAvatar({
  avatarUrl,
  displayName,
  verified,
  size = "lg",
}: {
  avatarUrl: string;
  displayName: string;
  verified?: boolean;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? 108 : 92;
  const ringInset = size === "lg" ? 4 : 3;

  return (
    <div className="relative shrink-0">
      {/* Outer glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: `-${ringInset + 6}px`,
          background: "radial-gradient(circle, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0.08) 45%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      {/* Gold ring */}
      <div
        className="absolute rounded-full"
        style={{
          inset: `-${ringInset}px`,
          background: "linear-gradient(135deg, #E8B14A 0%, #C9A84C 40%, #B8923A 70%, rgba(177,74,139,0.45) 100%)",
          boxShadow: "0 0 24px rgba(201,168,76,0.35), 0 0 48px rgba(201,168,76,0.12)",
        }}
      />
      <img
        src={avatarUrl}
        alt={displayName}
        className="relative rounded-full object-cover"
        style={{
          width: dim,
          height: dim,
          border: "3.5px solid #0A0806",
        }}
      />
      {verified && <HexVerifiedBadge />}
    </div>
  );
}

export function ProfileVerifiedCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verified" role="img">
      <circle cx="12" cy="12" r="10" fill={PROFILE_VERIFIED_BLUE} />
      <path
        d="M8 12.2l2.6 2.6 5.4-5.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileStat({ value, label, onClick }: { value: string | number; label: string; onClick?: () => void }) {
  const display = typeof value === "number" ? formatProfileStat(value) : value;
  const inner = (
    <>
      <span className="font-['Inter'] font-semibold text-[15px] text-white leading-none">{display}</span>
      <span className="text-[11px] font-['Inter'] ml-1" style={{ color: "rgba(245,243,239,0.42)" }}>
        {label}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="transition-opacity hover:opacity-85 active:opacity-70">
        {inner}
      </button>
    );
  }
  return <span>{inner}</span>;
}

export function ProfileStatsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 flex items-center gap-3 flex-wrap mb-4">
      {children}
    </div>
  );
}

export function ProfileStatDivider() {
  return <span className="text-[11px] select-none" style={{ color: "rgba(255,255,255,0.14)" }}>|</span>;
}

export function ProfileRolePill({ label }: { label: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-['Inter'] font-medium tracking-wide"
      style={{
        background: "linear-gradient(135deg, rgba(177,74,139,0.28) 0%, rgba(120,45,95,0.22) 100%)",
        border: "1px solid rgba(177,74,139,0.42)",
        color: "#E8B8DC",
        boxShadow: "0 2px 12px rgba(177,74,139,0.15)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 18v3M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      {label}
    </div>
  );
}

export function GoldGradientButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  className?: string;
}) {
  if (variant === "outline") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex-1 py-2.5 rounded-[14px] text-[13px] font-['Inter'] font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 ${className}`}
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          color: SETTINGS_TEXT,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 rounded-[14px] text-[13px] font-['Inter'] font-semibold disabled:opacity-50 ${className}`}
      style={{
        background: "linear-gradient(90deg, #C9A84C 0%, #E8B14A 50%, #D4A84A 100%)",
        color: "#0A0806",
        boxShadow: "0 4px 20px rgba(201,168,76,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      {children}
    </motion.button>
  );
}

export type ProfileTabId = "mehfils" | "about" | "highlights" | "photos" | "badges";

const TAB_LABELS: Record<ProfileTabId, string> = {
  mehfils: "Mehfils",
  about: "About",
  highlights: "Highlights",
  photos: "Photos",
  badges: "Badges",
};

export function ProfileTabs({ active, onChange }: { active: ProfileTabId; onChange: (t: ProfileTabId) => void }) {
  const tabs: ProfileTabId[] = ["mehfils", "about", "highlights", "photos", "badges"];
  return (
    <div
      className="border-b mx-0"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(10,8,6,0.4) 0%, transparent 100%)",
      }}
    >
      <div className="flex overflow-x-auto no-scrollbar px-3 gap-0.5">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="relative shrink-0 px-4 pb-3.5 pt-2 text-[12px] font-['Inter'] font-medium tracking-[0.04em] transition-colors whitespace-nowrap"
            style={{ color: active === t ? SETTINGS_GOLD : "rgba(245,243,239,0.38)" }}
          >
            {TAB_LABELS[t]}
            {active === t && (
              <motion.div
                layoutId="profile-tab-underline"
                className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full"
                style={{
                  background: "linear-gradient(90deg, #C9A84C, #E8B14A)",
                  boxShadow: "0 0 8px rgba(201,168,76,0.45)",
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WaveformBars({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  return (
    <div className={`flex items-end gap-[2px] h-4 ${className}`}>
      {[0.35, 0.7, 0.45, 1, 0.55, 0.85, 0.4, 0.65, 0.5, 0.75, 0.38, 0.6].map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${h * 100}%`,
            background: "rgba(201,168,76,0.55)",
            animation: animate ? `feed-bar ${0.7 + (i % 4) * 0.15}s ease-in-out infinite ${i * 0.06}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function ProfileSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-['Inter'] uppercase tracking-[0.22em] mb-3 px-1" style={{ color: SETTINGS_GOLD }}>
      {children}
    </div>
  );
}

export function ProfileCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: SETTINGS_CARD, border: `1px solid ${SETTINGS_BORDER}` }}
    >
      {children}
    </div>
  );
}

export function AboutRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor: SETTINGS_BORDER }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.10)" }}>
        <Icon size={16} style={{ color: SETTINGS_GOLD }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-['Inter']" style={{ color: SETTINGS_MUTED }}>{label}</div>
        <div className="text-[14px] font-['Inter'] mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}

export function EmptyTabState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center py-14 px-6 text-center gap-2">
      <div className="font-['Playfair_Display'] text-[17px] italic" style={{ color: SETTINGS_MUTED }}>{title}</div>
      <p className="text-[12px] font-['Inter'] leading-relaxed max-w-[280px]" style={{ color: "rgba(245,243,239,0.32)" }}>{hint}</p>
    </div>
  );
}
