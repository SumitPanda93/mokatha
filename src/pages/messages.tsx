import { useState, useRef, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
  useUser,
  useCurrentUser,
  useMehfils,
  useMehfilRealtime,
  useNotifications,
  getCurrentUserId,
  Conversation,
  Mehfil,
  supabase,
  QK,
} from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConversationListCard,
  ConversationRow,
  FEED_BG,
  FEED_BORDER,
  FEED_CARD,
  FEED_GOLD,
  FEED_MUTED,
  FEED_TEXT,
  filterConversations,
  formatInboxTime,
  InboxFilterTabs,
  InboxHeader,
  InboxShell,
  isVoicePreviewText,
  LiveJoinRow,
  NotePartnerChip,
  NotesRow,
  parseVoiceDuration,
  type InboxFilter,
} from "@/components/messages/inbox-ui";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ConvListItem({
  conv,
  onClick,
  search,
  unread,
}: {
  conv: Conversation;
  onClick: () => void;
  search: string;
  unread: number;
}) {
  const me = getCurrentUserId() ?? "";
  const isGroup = conv.participantIds.length > 2;
  const otherId = conv.participantIds.find((id) => id !== me) ?? "";
  const { data: other } = useUser(otherId);
  const { data: msgs = [] } = useConversationMessages(conv.id);
  const last = msgs[msgs.length - 1];

  const name = isGroup
    ? `Group (${conv.participantIds.length})`
    : (other?.displayName ?? "Unknown");
  const q = search.trim().toLowerCase();
  if (q && !name.toLowerCase().includes(q) && !(other?.handle ?? "").toLowerCase().includes(q)) {
    return null;
  }

  const previewBody = last?.body ?? "New conversation";
  const isVoice = !!last && isVoicePreviewText(last.body);

  return (
    <ConversationRow
      name={name}
      handle={other?.handle}
      avatarUrl={other?.avatarUrl}
      verified={other?.verified}
      preview={previewBody}
      time={last ? formatInboxTime(last.createdAt) : conv.lastMessageAt ? formatInboxTime(conv.lastMessageAt) : ""}
      unread={unread}
      isVoice={isVoice}
      voiceDurationSec={isVoice ? parseVoiceDuration(last!.body) : undefined}
      isGroup={isGroup}
      muted={isGroup}
      onClick={onClick}
    />
  );
}

function ConversationView({ convId, onBack }: { convId: string; onBack: () => void }) {
  const me = getCurrentUserId() ?? "";
  const { data: msgs = [] } = useConversationMessages(convId);
  const send = useSendMessage();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);

  const { data: convs = [] } = useConversations();
  const conv = convs.find((c) => c.id === convId);
  const otherId = conv?.participantIds.find((id) => id !== me) ?? "";
  const { data: other } = useUser(otherId);

  useEffect(() => {
    const msgChannel = supabase
      .channel(`realtime:messages:${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` }, () => {
        qc.invalidateQueries({ queryKey: QK.messages(convId) });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${convId}`)
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: { user_id: string; name: string } }) => {
        if (payload.user_id === me) return;
        setTypingName(payload.name || "Someone");
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(null), 3000);
      })
      .subscribe();

    broadcastRef.current = typingChannel;

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [convId, me, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const onDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    const now = Date.now();
    if (broadcastRef.current && now - lastTypingSent.current > 1200) {
      lastTypingSent.current = now;
      broadcastRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: me, name: other?.displayName ?? "" },
      });
    }
  };

  const submit = () => {
    if (!draft.trim()) return;
    send.mutate({ conversationId: convId, body: draft.trim() });
    setDraft("");
    setTypingName(null);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: FEED_BG, color: FEED_TEXT }}>
      <div
        className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: "rgba(10,8,6,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${FEED_BORDER}` }}
      >
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ border: `1px solid ${FEED_BORDER}`, background: FEED_CARD }}
        >
          <ArrowLeft size={15} />
        </button>
        <img src={other?.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        <div>
          <div className="text-[14px] font-['Inter'] font-medium">{other?.displayName}</div>
          <AnimatePresence mode="wait">
            {typingName ? (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1"
              >
                <TypingDots />
                <span className="text-[10px] font-['Inter'] italic" style={{ color: FEED_GOLD }}>
                  typing…
                </span>
              </motion.div>
            ) : (
              <motion.div key="handle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-[10px]" style={{ color: FEED_MUTED }}>
                  @{other?.handle}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar">
        {msgs.map((m) => {
          const isMe = m.senderId === me;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-[13px] font-['Inter'] leading-relaxed ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`}
                style={
                  isMe
                    ? { background: FEED_GOLD, color: FEED_BG }
                    : { background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }
                }
              >
                {m.body}
                <div className={`text-[9px] mt-0.5 ${isMe ? "opacity-60" : ""}`} style={{ color: isMe ? FEED_BG : FEED_MUTED }}>
                  {timeLabel(m.createdAt)}
                </div>
              </div>
            </motion.div>
          );
        })}
        {msgs.length === 0 && (
          <div className="text-center py-10 font-['Playfair_Display'] italic text-[13px]" style={{ color: FEED_MUTED }}>
            Start the conversation.
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderTop: `1px solid ${FEED_BORDER}`, background: "rgba(10,8,6,0.96)" }}
      >
        <input
          value={draft}
          onChange={onDraftChange}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Write something..."
          className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-['Inter'] outline-none transition-colors placeholder:opacity-40"
          style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}`, color: FEED_TEXT }}
        />
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={submit}
          disabled={!draft.trim() || send.isPending}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
          style={{ background: FEED_GOLD, color: FEED_BG }}
        >
          <Send size={14} />
        </motion.button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[4px] h-[4px] rounded-full"
          style={{ background: FEED_GOLD }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function NotePartnerLoader({ userId, convId }: { userId: string; convId: string }) {
  const { data: user } = useUser(userId);
  if (!user) return null;
  return <NotePartnerChip user={user} convId={convId} />;
}

function InboxListView({
  convs,
  search,
  setSearch,
  setActiveConvId,
  filter,
  setFilter,
}: {
  convs: Conversation[];
  search: string;
  setSearch: (s: string) => void;
  setActiveConvId: (id: string | null) => void;
  filter: InboxFilter;
  setFilter: (f: InboxFilter) => void;
}) {
  const me = getCurrentUserId() ?? "";
  const { data: user } = useCurrentUser();
  const { data: mehfils = [] } = useMehfils();
  const { data: notifications = [] } = useNotifications();
  useMehfilRealtime();

  const unreadByConv = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifications) {
      if (!n.read && n.kind === "message") {
        map.set(n.targetId, (map.get(n.targetId) ?? 0) + 1);
      }
    }
    return map;
  }, [notifications]);

  const filteredConvs = useMemo(() => filterConversations(convs, filter), [convs, filter]);

  const partnerEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: { userId: string; convId: string }[] = [];
    for (const c of convs) {
      const oid = c.participantIds.find((id) => id !== me && !seen.has(id));
      if (!oid) continue;
      seen.add(oid);
      entries.push({ userId: oid, convId: c.id });
      if (entries.length >= 5) break;
    }
    return entries;
  }, [convs, me]);

  const liveMehfils = mehfils.filter((m) => m.isLive);
  const contactHostIds = new Set(partnerEntries.map((e) => e.userId));
  const liveFromContacts = liveMehfils.filter((m) => contactHostIds.has(m.hostId));
  const featuredLive = liveFromContacts[0] ?? liveMehfils[0];
  const { data: liveHost } = useUser(featuredLive?.hostId ?? "");

  return (
    <InboxShell>
      <InboxHeader
        search={search}
        onSearchChange={setSearch}
        avatarUrl={user?.avatarUrl}
        onCompose={() => setSearch("")}
      />
      <InboxFilterTabs active={filter} onChange={setFilter} />
      <NotesRow liveMehfils={liveMehfils}>
        {partnerEntries.map((e) => (
          <NotePartnerLoader key={e.userId} userId={e.userId} convId={e.convId} />
        ))}
      </NotesRow>

      {featuredLive?.isLive && (
        <LiveJoinRow mehfil={featuredLive} hostName={liveHost?.displayName ?? featuredLive.title} />
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
        {filter === "Requests" ? (
          <InboxEmptyState
            title="No pending requests"
            subtitle="Message requests from people you do not follow will appear here."
          />
        ) : filter === "Groups" && filteredConvs.length === 0 ? (
          <InboxEmptyState
            title="No group chats yet"
            subtitle="Group conversations will show here when available."
          />
        ) : filteredConvs.length === 0 ? (
          <InboxEmptyState
            title="No conversations yet"
            subtitle="Write to a creator you love. Every story begins with a hello."
          />
        ) : (
          <ConversationListCard>
            {filteredConvs.map((conv, idx) => (
              <div key={conv.id} className={idx === filteredConvs.length - 1 ? "[&_button]:border-b-0" : ""}>
                <ConvListItem
                  conv={conv}
                  search={search}
                  unread={unreadByConv.get(conv.id) ?? 0}
                  onClick={() => setActiveConvId(conv.id)}
                />
              </div>
            ))}
          </ConversationListCard>
        )}
      </div>
    </InboxShell>
  );
}

function InboxEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}
      >
        <MessageCircle size={24} style={{ color: FEED_MUTED }} />
      </div>
      <div className="font-['Playfair_Display'] text-[18px] mb-2">{title}</div>
      <div className="text-[13px] leading-relaxed" style={{ color: FEED_MUTED }}>
        {subtitle}
      </div>
    </div>
  );
}

export default function Messages() {
  useTitle("Inbox");
  const search_ = useSearch();
  const openParam = new URLSearchParams(search_).get("open");
  const [activeConvId, setActiveConvId] = useState<string | null>(openParam ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("All");
  const me = getCurrentUserId() ?? "";
  const { data: convs = [] } = useConversations(me);

  useEffect(() => {
    if (openParam) setActiveConvId(openParam);
  }, [openParam]);

  if (activeConvId) {
    return (
      <div className="flex flex-col" style={{ height: "100dvh", background: FEED_BG }}>
        <ConversationView convId={activeConvId} onBack={() => setActiveConvId(null)} />
      </div>
    );
  }

  return (
    <InboxListView
      convs={convs}
      search={search}
      setSearch={setSearch}
      setActiveConvId={setActiveConvId}
      filter={filter}
      setFilter={setFilter}
    />
  );
}
