import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useTitle } from "@/hooks/useTitle";
import {
  useConversations, useConversationMessages, useSendMessage, useUser,
  getCurrentUserId, getOrCreateConversationId, Conversation,
  supabase, QK,
} from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ConvItem({ conv, onClick, active }: { conv: Conversation; onClick: () => void; active: boolean }) {
  const me = getCurrentUserId() ?? "";
  const otherId = conv.participantIds.find((id) => id !== me) ?? "";
  const { data: other } = useUser(otherId);
  const { data: msgs = [] } = useConversationMessages(conv.id);
  const last = msgs[msgs.length - 1];

  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${active ? "bg-card border-r-2 border-terracotta" : "hover:bg-card/60"}`}>
      <img src={other?.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <div className="text-[14px] font-['Inter'] font-medium text-foreground truncate">{other?.displayName}</div>
          <div className="text-[10px] text-muted-foreground shrink-0 ml-2">{last ? timeLabel(last.createdAt) : ""}</div>
        </div>
        <div className="text-[12px] text-muted-foreground truncate">{last?.body ?? "New conversation"}</div>
      </div>
    </button>
  );
}

function ConversationView({ convId, onBack }: { convId: string; onBack: () => void }) {
  const me = getCurrentUserId() ?? "";
  const { data: msgs = [] } = useConversationMessages(convId);
  const send = useSendMessage();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Determine other user
  const { data: convs = [] } = useConversations();
  const conv = convs.find((c) => c.id === convId);
  const otherId = conv?.participantIds.find((id) => id !== me) ?? "";
  const { data: other } = useUser(otherId);

  // Real-time: listen for new messages in this conversation
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:messages:${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversationId=eq.${convId}` }, () => {
        qc.invalidateQueries({ queryKey: QK.messages(convId) });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const submit = () => {
    if (!draft.trim()) return;
    send.mutate({ conversationId: convId, body: draft.trim() });
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-background sticky top-0 z-10">
        <button onClick={onBack} className="w-8 h-8 rounded-full border border-border flex items-center justify-center"><ArrowLeft size={15} /></button>
        <img src={other?.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        <div>
          <div className="text-[14px] font-['Inter'] font-medium">{other?.displayName}</div>
          <div className="text-[10px] text-muted-foreground">@{other?.handle}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar">
        {msgs.map((m) => {
          const isMe = m.senderId === me;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-[13px] font-['Inter'] leading-relaxed ${isMe
                ? "bg-foreground text-background rounded-br-sm"
                : "bg-card border border-border text-foreground rounded-bl-sm"}`}>
                {m.body}
                <div className={`text-[9px] mt-0.5 ${isMe ? "text-background/60" : "text-muted-foreground"}`}>{timeLabel(m.createdAt)}</div>
              </div>
            </motion.div>
          );
        })}
        {msgs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground font-['Playfair_Display'] italic text-[13px]">
            Start the conversation.
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-background">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Write something..."
          className="flex-1 bg-card border border-border rounded-full px-4 py-2.5 text-[13px] font-['Inter'] outline-none focus:border-terracotta transition-colors placeholder:text-muted-foreground/50"
        />
        <motion.button whileTap={{ scale: 0.92 }} onClick={submit}
          disabled={!draft.trim() || send.isPending}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-foreground text-background disabled:opacity-40 transition-opacity">
          <Send size={14} />
        </motion.button>
      </div>
    </div>
  );
}

export default function Messages() {
  useTitle("Messages");
  const [, setLocation] = useLocation();
  const me = getCurrentUserId() ?? "";
  const { data: convs = [] } = useConversations(me);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = convs;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Show conversation view on mobile when one is selected */}
      {activeConvId ? (
        <div className="flex flex-col h-screen">
          <ConversationView convId={activeConvId} onBack={() => setActiveConvId(null)} />
        </div>
      ) : (
        <>
          <div className="px-5 py-3 flex items-center gap-3 sticky top-0 bg-background/90 backdrop-blur-md z-20">
            <button onClick={() => setLocation("/")} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1 font-['Playfair_Display'] text-[20px]">Messages</div>
          </div>

          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-2">
              <Search size={13} className="text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground font-['Playfair_Display'] italic text-[14px]">
                No conversations yet.
              </div>
            ) : (
              filtered.map((conv) => (
                <ConvItem key={conv.id} conv={conv} onClick={() => setActiveConvId(conv.id)} active={activeConvId === conv.id} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
