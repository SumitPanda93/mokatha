import { Link } from "wouter";
import { BadgeCheck, Mic, Plus, SquarePen, VolumeX } from "lucide-react";
import type { Conversation, Mehfil, User } from "@/lib/store";
import {
  FEED_BG,
  FEED_BORDER,
  FEED_CARD,
  FEED_GOLD,
  FEED_MUTED,
  FEED_PURPLE,
  FEED_PURPLE_SOFT,
  FEED_TEXT,
  MoKathaWordmark,
  feedKeyframes,
  formatFeedTime,
} from "@/components/feed/home-feed-ui";

export const INBOX_FILTERS = ["All", "Primary", "Requests", "Groups"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

/** Placeholder until message-request API exists */
export const REQUESTS_TAB_BADGE = 2;

export function filterConversations(convs: Conversation[], filter: InboxFilter): Conversation[] {
  if (filter === "All" || filter === "Primary") return convs;
  if (filter === "Groups") return convs.filter((c) => c.participantIds.length > 2);
  return [];
}

function StoryRing({ live, children }: { live?: boolean; children: React.ReactNode }) {
  if (live) {
    return (
      <div
        className="relative p-[2.5px] rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #C9A84C, #E8B14A, #9B59B6, #C9A84C)",
          animation: "feed-spin 4s linear infinite",
        }}
      >
        <div className="rounded-full p-[2px]" style={{ background: FEED_BG }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative p-[2px] rounded-full"
      style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.5), rgba(155,89,182,0.45))" }}
    >
      {children}
    </div>
  );
}

export function InboxShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <style>{feedKeyframes}</style>
      <div
        className="fixed top-[-50px] right-[-30px] w-[200px] h-[200px] rounded-full pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)", filter: "blur(48px)" }}
      />
      <div
        className="fixed bottom-[180px] left-[-40px] w-[180px] h-[180px] rounded-full pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(155,89,182,0.08) 0%, transparent 70%)", filter: "blur(52px)" }}
      />
      <div className="relative z-10 flex flex-col flex-1">{children}</div>
    </div>
  );
}

export function InboxHeader({
  search,
  onSearchChange,
  avatarUrl,
  onCompose,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  avatarUrl?: string;
  onCompose?: () => void;
}) {
  return (
    <header
      className="px-4 pt-3 pb-3 sticky top-0 z-20"
      style={{ background: "rgba(10,8,6,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${FEED_BORDER}` }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <MoKathaWordmark compact />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCompose}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
            aria-label="Compose message"
          >
            <SquarePen size={16} style={{ color: FEED_GOLD }} />
          </button>
          <Link href="/me">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: FEED_BORDER }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px]" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
                ✦
              </div>
            )}
          </Link>
        </div>
      </div>
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-2.5"
        style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FEED_MUTED} strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search messages…"
          className="flex-1 bg-transparent text-[13px] font-['Inter'] outline-none placeholder:opacity-50"
          style={{ color: FEED_TEXT }}
        />
      </div>
    </header>
  );
}

export function InboxFilterTabs({
  active,
  onChange,
}: {
  active: InboxFilter;
  onChange: (f: InboxFilter) => void;
}) {
  return (
    <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
      {INBOX_FILTERS.map((f) => {
        const isActive = active === f;
        const badge = f === "Requests" ? REQUESTS_TAB_BADGE : 0;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-['Inter'] font-medium transition-colors relative"
            style={
              isActive
                ? { background: FEED_GOLD, color: FEED_BG }
                : { background: FEED_CARD, color: FEED_MUTED, border: `1px solid ${FEED_BORDER}` }
            }
          >
            {f}
            {badge > 0 && !isActive && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: FEED_PURPLE, color: "#fff" }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NotesRow({
  liveMehfils,
  children,
}: {
  liveMehfils: Mehfil[];
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 pb-3 flex gap-3 overflow-x-auto no-scrollbar">
      <Link href="/create/story" className="flex flex-col items-center gap-1 shrink-0 w-[58px]">
        <div
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center border-2 border-dashed"
          style={{ borderColor: FEED_BORDER, color: FEED_GOLD }}
        >
          <Plus size={20} strokeWidth={1.75} />
        </div>
        <span className="text-[9px] font-['Inter']" style={{ color: FEED_MUTED }}>
          Your note
        </span>
      </Link>

      {liveMehfils.slice(0, 4).map((m) => (
        <Link key={m.id} href={`/mehfil/${m.id}`} className="flex flex-col items-center gap-1 shrink-0 w-[58px] relative">
          <div className="relative">
            <StoryRing live>
              <img src={m.coverUrl} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
            </StoryRing>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-bold uppercase text-white bg-red-600 rounded px-1 py-px leading-none whitespace-nowrap">
              LIVE
            </span>
            <span
              className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: "#22C55E", borderColor: FEED_BG }}
            />
          </div>
          <span className="text-[9px] font-['Inter'] text-center line-clamp-1 w-full mt-2" style={{ color: FEED_TEXT }}>
            {m.title.split(" ")[0]}
          </span>
        </Link>
      ))}

      {children}
    </div>
  );
}

export function NotePartnerChip({ user, convId }: { user: User; convId: string }) {
  return (
    <Link href={`/messages?open=${convId}`} className="flex flex-col items-center gap-1 shrink-0 w-[58px] relative">
      <StoryRing>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
        ) : (
          <div
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[14px]"
            style={{ background: FEED_CARD }}
          >
            {(user.displayName || user.handle || "?")[0]}
          </div>
        )}
      </StoryRing>
      <span
        className="absolute top-1 right-2 w-2 h-2 rounded-full border"
        style={{ background: "#22C55E", borderColor: FEED_BG }}
      />
      <span className="text-[9px] font-['Inter'] text-center line-clamp-1 w-full" style={{ color: FEED_MUTED }}>
        {(user.displayName || user.handle).split(" ")[0]}
      </span>
    </Link>
  );
}

export function LiveJoinRow({ mehfil, hostName }: { mehfil: Mehfil; hostName: string }) {
  return (
    <Link
      href={`/mehfil/${mehfil.id}`}
      className="flex items-center gap-3 px-4 py-3 mx-4 mb-2 rounded-2xl"
      style={{ background: "rgba(155,89,182,0.12)", border: `1px solid ${FEED_PURPLE_SOFT}` }}
    >
      <div className="relative shrink-0">
        <img src={mehfil.coverUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5 text-[6px] font-bold uppercase bg-red-600 text-white rounded px-1">
          LIVE
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-['Inter'] font-semibold truncate">
          {hostName}
          <span className="text-[10px] font-normal ml-1.5 uppercase tracking-wide text-red-400">LIVE now</span>
        </div>
        <div className="text-[11px] truncate" style={{ color: FEED_MUTED }}>
          {mehfil.title}
        </div>
      </div>
      <span
        className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-['Inter'] font-semibold"
        style={{ background: FEED_PURPLE, color: "#fff" }}
      >
        Join
      </span>
    </Link>
  );
}

export function VoiceMessagePreview({ durationSec }: { durationSec?: number }) {
  const label = durationSec != null ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}` : "0:24";
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: FEED_MUTED }}>
      <span className="inline-flex items-end gap-[2px] h-3">
        {[0.4, 0.9, 0.5, 1, 0.6, 0.85, 0.45].map((h, i) => (
          <span
            key={i}
            className="w-[2px] rounded-full"
            style={{ height: `${h * 100}%`, background: FEED_PURPLE, opacity: 0.75 }}
          />
        ))}
      </span>
      <Mic size={11} style={{ color: FEED_PURPLE }} />
      <span className="text-[12px]">{label}</span>
    </span>
  );
}

export function isVoicePreviewText(body: string): boolean {
  return /^(🎙|🎤|\[voice\]|voice message)/i.test(body.trim()) || body.trim().startsWith("▶");
}

export function parseVoiceDuration(body: string): number | undefined {
  const m = body.match(/(\d+):(\d{2})/);
  if (!m) return undefined;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function GroupCollageAvatar({ urls }: { urls: string[] }) {
  const slots = urls.slice(0, 4);
  while (slots.length < 4) slots.push("");
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0" style={{ background: FEED_CARD }}>
      {slots.map((url, i) => (
        <div key={i} className="overflow-hidden">
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "rgba(255,255,255,0.06)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ConversationListCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden flex flex-col"
      style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
    >
      {children}
    </div>
  );
}

export function ConversationRow({
  name,
  handle,
  avatarUrl,
  verified,
  preview,
  time,
  unread,
  isVoice,
  voiceDurationSec,
  isGroup,
  groupAvatars,
  muted,
  onClick,
}: {
  name: string;
  handle?: string;
  avatarUrl?: string;
  verified?: boolean;
  preview: React.ReactNode;
  time: string;
  unread: number;
  isVoice?: boolean;
  voiceDurationSec?: number;
  isGroup?: boolean;
  groupAvatars?: string[];
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:opacity-90"
      style={{ borderBottom: `1px solid ${FEED_BORDER}` }}
    >
      {isGroup && groupAvatars ? (
        <GroupCollageAvatar urls={groupAvatars} />
      ) : avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[14px] font-['Inter']"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {(name || "?")[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[14px] font-['Inter'] font-semibold truncate">{name}</span>
            {verified && <BadgeCheck size={14} className="text-[#3B82F6] shrink-0" fill="#3B82F6" stroke={FEED_BG} />}
            {muted && <VolumeX size={12} style={{ color: FEED_MUTED }} className="shrink-0" />}
          </div>
          <span className="text-[10px] shrink-0 font-['Inter']" style={{ color: FEED_MUTED }}>
            {time}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <div className="text-[12px] truncate min-w-0 font-['Inter']" style={{ color: FEED_MUTED }}>
            {isVoice ? <VoiceMessagePreview durationSec={voiceDurationSec} /> : preview}
          </div>
          {unread > 0 && (
            <span
              className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold font-['Inter'] flex items-center justify-center"
              style={{ background: FEED_PURPLE, color: "#fff" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        {handle && !isVoice && (
          <div className="text-[10px] mt-0.5 truncate opacity-0 h-0 overflow-hidden">@{handle}</div>
        )}
      </div>
    </button>
  );
}

export { formatFeedTime as formatInboxTime, FEED_BG, FEED_GOLD, FEED_BORDER, FEED_CARD, FEED_MUTED, FEED_TEXT, FEED_PURPLE };
