import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getAuthUserId } from "@/lib/auth";
import { logOpsEvent } from "@/lib/observability";

export { supabase };

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location?: string;
  language: "or" | "hi";
  verified: boolean;
  followers: number;
  following: number;
  isAdmin: boolean;
  suspended?: boolean;
};

export type PostKind = "voice" | "text" | "story" | "reel";

export type Post = {
  id: string;
  kind: PostKind;
  authorId: string;
  title: string;
  body: string;
  /** Vertical reel video (primary immersive media when present) */
  videoUrl?: string;
  audioUrl?: string;
  coverUrl?: string;
  durationSec?: number;
  language: "or" | "hi";
  createdAt: string;
  likes: number;
  comments: number;
  tipsTotal: number;
  tags: string[];
  liked?: boolean;
  saved?: boolean;
  accessType?: "free" | "tip" | "premium";
  minTip?: number;
  hidden?: boolean;
  isPrivate?: boolean;
  /** Originating Mehfil when this post is a replay or derived session */
  sourceMehfilId?: string;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likes: number;
};

export type Mehfil = {
  id: string;
  hostId: string;
  title: string;
  description: string;
  isLive: boolean;
  listeners: number;
  startsAt: string;
  coverUrl: string;
  language: "or" | "hi";
  tags: string[];
  archived?: boolean;
  /** When the live session ended (public discovery hides ~24h after this). */
  endedAt?: string;
  isTicketed?: boolean;
  ticketPrice?: number;
  maxSpeakers?: number;
  /** voice = audio-first; studio = host may publish camera (LiveKit video). */
  sessionMode?: "voice" | "studio";
};

export type Tip = {
  id: string;
  fromUserId: string;
  toUserId: string;
  postId?: string;
  mehfilId?: string;
  amount: number;
  createdAt: string;
};

export type TransactionKind = "earning" | "withdraw" | "tip-sent" | "tip-received";

export type Transaction = {
  id: string;
  userId: string;
  kind: TransactionKind;
  amount: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  counterpartyId?: string;
  note?: string;
};

export type NotificationKind =
  | "reaction" | "follow" | "tip" | "mention" | "mehfil-start"
  | "comment" | "like" | "message" | "withdrawal-approved"
  | "support" | "audio-letter";

export type Notification = {
  id: string;
  kind: NotificationKind;
  actorId: string;
  targetId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type ReportKind = "post" | "user" | "mehfil";

export type Report = {
  id: string;
  kind: ReportKind;
  targetId: string;
  reason: string;
  reporterId: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
};

export type AdminLog = {
  id: string;
  actorId: string;
  action: string;
  target: string;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amount: number;
  method: "upi" | "bank";
  accountDetails: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Follow = { followerId: string; followeeId: string; createdAt: string };

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  participantIds: string[];
  lastMessageAt: string;
};

export type AuthorPlan = {
  authorId: string;
  enabled: boolean;
  priceMonthly: number;
  benefits: string[];
};

export type Subscription = {
  id: string;
  authorId: string;
  userId: string;
  startDate: string;
  expiryDate: string;
  status: "active" | "expired" | "cancelled";
};

export type InkReward = {
  userId: string;
  points: number;
  streakDays: number;
  lastClaimDate: string;
  badges: string[];
  unlockedPostIds: string[];
};

export type SearchResult = { users: User[]; posts: Post[]; mehfils: Mehfil[]; tags: string[] };

export function getCurrentUserId(): string {
  return getAuthUserId();
}

// ─── Row mappers (DB snake_case → TS camelCase) ───────────────────────────────

function mapUser(u: any): User {
  return {
    id: u.id,
    handle: u.handle ?? "",
    displayName: u.display_name ?? u.handle ?? "",
    avatarUrl: u.avatar_url ?? "",
    bio: u.bio ?? "",
    location: u.location,
    language: u.language ?? "or",
    verified: u.verified ?? false,
    followers: u.followers ?? 0,
    following: u.following ?? 0,
    isAdmin: u.is_admin ?? false,
    suspended: u.suspended ?? false,
  };
}

function mapPost(p: any): Post {
  return {
    id: p.id,
    kind: p.kind,
    authorId: p.author_id,
    title: p.title,
    body: p.body ?? "",
    videoUrl: p.video_url ?? undefined,
    audioUrl: p.audio_url,
    coverUrl: p.cover_url,
    durationSec: p.duration_sec,
    language: p.language ?? "or",
    createdAt: p.created_at,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    tipsTotal: p.tips_total ?? 0,
    tags: p.tags ?? [],
    accessType: p.access_type,
    minTip: p.min_tip,
    hidden: p.hidden ?? false,
    isPrivate: p.is_private ?? false,
    liked: p.liked,
    saved: p.saved,
    sourceMehfilId: p.source_mehfil_id ?? undefined,
  };
}

function mapComment(c: any): Comment {
  return {
    id: c.id,
    postId: c.post_id,
    authorId: c.author_id,
    body: c.body,
    createdAt: c.created_at,
    likes: c.likes ?? 0,
  };
}

function mapMehfil(m: any): Mehfil {
  const mode = m.session_mode === "studio" ? "studio" : "voice";
  return {
    id: m.id,
    hostId: m.host_id,
    title: m.title,
    description: m.description ?? "",
    isLive: m.is_live ?? false,
    listeners: m.listeners ?? 0,
    startsAt: m.starts_at,
    coverUrl: m.cover_url ?? "",
    language: m.language ?? "or",
    tags: m.tags ?? [],
    archived: m.archived ?? false,
    endedAt: m.ended_at ?? undefined,
    isTicketed: m.is_ticketed ?? false,
    ticketPrice: m.ticket_price ?? 0,
    maxSpeakers: m.max_speakers ?? 3,
    sessionMode: mode,
  };
}

function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    userId: t.user_id,
    kind: t.kind,
    amount: t.amount,
    status: t.status,
    createdAt: t.created_at,
    counterpartyId: t.counterparty_id,
    note: t.note,
  };
}

function mapNotification(n: any): Notification {
  return {
    id: n.id,
    kind: n.kind,
    actorId: n.actor_id,
    targetId: n.target_id,
    recipientId: n.recipient_id,
    body: n.body,
    createdAt: n.created_at,
    read: n.read ?? false,
  };
}

/** Fire-and-forget notification insert. Never throws — only logs on failure. */
async function insertNotif(
  kind: NotificationKind,
  actorId: string,
  targetId: string,
  recipientId: string,
  body: string,
): Promise<void> {
  if (!actorId || !recipientId || actorId === recipientId) return; // never self-notify
  const { error } = await supabase.from("notifications").insert({
    id: `n${uid()}`,
    kind,
    actor_id: actorId,
    target_id: targetId,
    recipient_id: recipientId,
    body,
    created_at: new Date().toISOString(),
    read: false,
  });
  if (error) console.warn("[mk:notif] insert failed", error.message);
}

function mapReport(r: any): Report {
  return {
    id: r.id,
    kind: r.kind,
    targetId: r.target_id,
    reason: r.reason,
    reporterId: r.reporter_id,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapAdminLog(l: any): AdminLog {
  return {
    id: l.id,
    actorId: l.actor_id,
    action: l.action,
    target: l.target,
    createdAt: l.created_at,
  };
}

function mapWithdrawalRequest(r: any): WithdrawalRequest {
  return {
    id: r.id,
    userId: r.user_id,
    amount: r.amount,
    method: r.method,
    accountDetails: r.account_details,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAuthorPlan(p: any): AuthorPlan {
  return {
    authorId: p.author_id,
    enabled: p.enabled ?? false,
    priceMonthly: p.price_monthly ?? 99,
    benefits: p.benefits ?? [],
  };
}

function mapSubscription(s: any): Subscription {
  return {
    id: s.id,
    authorId: s.author_id,
    userId: s.user_id,
    startDate: s.start_date,
    expiryDate: s.expiry_date,
    status: s.status,
  };
}

function mapConversation(c: any): Conversation {
  return {
    id: c.id,
    participantIds: c.participant_ids ?? [],
    lastMessageAt: c.last_message_at,
  };
}

function mapMessage(m: any): Message {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  };
}

function mapInkReward(r: any): InkReward {
  return {
    userId: r.user_id,
    points: r.points ?? 0,
    streakDays: r.streak_days ?? 0,
    lastClaimDate: r.last_claim_date ?? "",
    badges: r.badges ?? [],
    unlockedPostIds: r.unlocked_post_ids ?? [],
  };
}

// ─── Badge helper ─────────────────────────────────────────────────────────────

function computeBadges(points: number, existing: string[]): string[] {
  const b = new Set(existing);
  if (points >= 100) b.add("supporter");
  if (points >= 200) b.add("top-reader");
  if (points >= 500) b.add("soul-listener");
  return Array.from(b);
}

// ─── ID generator ─────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Pre-flight: ensure profile row exists before insert (FK guard) ──────────
async function ensureProfileExists(userId: string): Promise<void> {
  if (!userId) throw new Error("not_authenticated");
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) return;
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  console.log("[mk:ensureProfile] creating profile for", userId);
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[mk:ensureProfile] FAILED", { code: error.code, message: error.message, details: error.details, hint: error.hint, userId });
    throw new Error(`profile_create_failed: ${error.message}`);
  }
  console.log("[mk:ensureProfile] profile created");
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function getPosts(): Promise<Post[]> {
  const me = getCurrentUserId();
  // Filter: not hidden AND (not private OR authored by current user)
  const postsQuery = me
    ? supabase.from("posts").select("*").eq("hidden", false).or(`is_private.eq.false,author_id.eq.${me}`).order("created_at", { ascending: false })
    : supabase.from("posts").select("*").eq("hidden", false).eq("is_private", false).order("created_at", { ascending: false });
  const [{ data: posts }, { data: likes }, { data: saves }] = await Promise.all([
    postsQuery,
    me ? supabase.from("post_likes").select("post_id").eq("user_id", me) : Promise.resolve({ data: [] as any[] } as any),
    me ? supabase.from("saved_posts").select("post_id").eq("user_id", me) : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const likedIds = new Set((likes ?? []).map((l: any) => l.post_id));
  const savedIds = new Set((saves ?? []).map((s: any) => s.post_id));
  return (posts ?? []).map((p: any) => mapPost({ ...p, liked: likedIds.has(p.id), saved: savedIds.has(p.id) }));
}

export async function getPost(id: string): Promise<Post | null> {
  const me = getCurrentUserId();
  const [{ data: post }, { data: like }, { data: save }] = await Promise.all([
    supabase.from("posts").select("*").eq("id", id).maybeSingle(),
    me ? supabase.from("post_likes").select("post_id").eq("user_id", me).eq("post_id", id).maybeSingle() : Promise.resolve({ data: null } as any),
    me ? supabase.from("saved_posts").select("post_id").eq("user_id", me).eq("post_id", id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  if (!post) return null;
  return mapPost({ ...post, liked: !!like, saved: !!save });
}

export async function getUser(id: string): Promise<User | null> {
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return data ? mapUser(data) : null;
}

export async function getUsers(): Promise<User[]> {
  const { data } = await supabase.from("profiles").select("*").order("followers", { ascending: false });
  return (data ?? []).map(mapUser);
}

export async function getUserByHandle(handle: string): Promise<User | null> {
  const { data } = await supabase.from("profiles").select("*").eq("handle", handle).maybeSingle();
  return data ? mapUser(data) : null;
}

export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  const me = getCurrentUserId();
  // Show private posts only to the author themselves
  const q = supabase.from("posts").select("*").eq("author_id", authorId);
  const filteredQ = me === authorId ? q : q.eq("is_private", false);
  const [{ data: posts }, { data: likes }, { data: saves }] = await Promise.all([
    filteredQ.order("created_at", { ascending: false }),
    me ? supabase.from("post_likes").select("post_id").eq("user_id", me) : Promise.resolve({ data: [] as any[] } as any),
    me ? supabase.from("saved_posts").select("post_id").eq("user_id", me) : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const likedIds = new Set((likes ?? []).map((l: any) => l.post_id));
  const savedIds = new Set((saves ?? []).map((s: any) => s.post_id));
  return (posts ?? []).map((p: any) => mapPost({ ...p, liked: likedIds.has(p.id), saved: savedIds.has(p.id) }));
}

export async function getPostComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
  return (data ?? []).map(mapComment);
}

/** Public Mehfil surfaces hide ended sessions after this duration. */
export const MEHFIL_DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;

export function isMehfilDiscoveryExpired(m: Mehfil): boolean {
  if (m.isLive || m.archived) return false;
  if (!m.endedAt) return false;
  return Date.now() - new Date(m.endedAt).getTime() > MEHFIL_DISCOVERY_TTL_MS;
}

export async function getMehfils(): Promise<Mehfil[]> {
  const { data } = await supabase.from("mehfils").select("*").eq("archived", false).order("starts_at", { ascending: false });
  const rows = data ?? [];
  const cutoff = Date.now() - MEHFIL_DISCOVERY_TTL_MS;
  const filtered = rows.filter((m: any) => {
    if (m.is_live) return true;
    if (!m.ended_at) return true;
    return new Date(m.ended_at).getTime() >= cutoff;
  });
  return filtered.map(mapMehfil);
}

/** Full history for host profile (includes discovery-expired rows). */
export async function getMehfilsForHost(hostId: string): Promise<Mehfil[]> {
  if (!hostId) return [];
  const { data } = await supabase.from("mehfils").select("*").eq("host_id", hostId).order("starts_at", { ascending: false });
  return (data ?? []).map(mapMehfil);
}

export async function getMehfil(id: string): Promise<Mehfil | null> {
  const { data } = await supabase.from("mehfils").select("*").eq("id", id).maybeSingle();
  return data ? mapMehfil(data) : null;
}

export async function getTransactionsForUser(userId: string): Promise<Transaction[]> {
  if (!userId) return [];
  const { data } = await supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map(mapTransaction);
}

export async function getNotifications(): Promise<Notification[]> {
  const me = getCurrentUserId();
  if (!me) return [];
  const { data } = await supabase.from("notifications").select("*").eq("recipient_id", me).order("created_at", { ascending: false });
  return (data ?? []).map(mapNotification);
}

export async function getUnreadCount(): Promise<number> {
  const me = getCurrentUserId();
  if (!me) return 0;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", me).eq("read", false);
  return count ?? 0;
}

export async function getReports(): Promise<Report[]> {
  const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(mapReport);
}

export async function getAdminLogs(): Promise<AdminLog[]> {
  const { data } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(mapAdminLog);
}

export async function getTopCreators(): Promise<User[]> {
  const { data } = await supabase.from("profiles").select("*").eq("is_admin", false).order("followers", { ascending: false });
  return (data ?? []).map(mapUser);
}

export async function getTrendingPosts(): Promise<Post[]> {
  const { data: posts } = await supabase.from("posts").select("*");
  return (posts ?? []).map(mapPost).sort((a, b) => (b.likes + b.tipsTotal) - (a.likes + a.tipsTotal));
}

export async function getFollowers(userId: string): Promise<User[]> {
  const { data: follows } = await supabase.from("follows").select("follower_id").eq("followee_id", userId);
  if (!follows?.length) return [];
  const ids = follows.map((f: any) => f.follower_id);
  const { data: users } = await supabase.from("profiles").select("*").in("id", ids);
  return (users ?? []).map(mapUser);
}

export async function getFollowing(userId: string): Promise<User[]> {
  const { data: follows } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  if (!follows?.length) return [];
  const ids = follows.map((f: any) => f.followee_id);
  const { data: users } = await supabase.from("profiles").select("*").in("id", ids);
  return (users ?? []).map(mapUser);
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", followerId).eq("followee_id", followeeId).maybeSingle();
  return !!data;
}

export async function getWalletBalance(userId: string): Promise<number> {
  if (!userId) return 0;
  const { data } = await supabase.from("wallet_balances").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

export async function getCurrentUser(): Promise<User | null> {
  return getUser(getCurrentUserId());
}

export async function getSavedPosts(userId: string): Promise<Post[]> {
  if (!userId) return [];
  const { data: saves } = await supabase.from("saved_posts").select("post_id").eq("user_id", userId);
  if (!saves?.length) return [];
  const ids = saves.map((s: any) => s.post_id);
  const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
  const savedIds = new Set(ids);
  return (posts ?? []).map((p: any) => mapPost({ ...p, saved: savedIds.has(p.id) }));
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];
  const { data } = await supabase.from("conversations").select("*").contains("participant_ids", [userId]).order("last_message_at", { ascending: false });
  return (data ?? []).map(mapConversation);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  return (data ?? []).map(mapMessage);
}

export async function getOrCreateConversationId(userId1: string, userId2: string): Promise<string> {
  const { data: existing } = await supabase.from("conversations").select("id").contains("participant_ids", [userId1, userId2]).maybeSingle();
  if (existing) return existing.id;
  const id = `cv${uid()}`;
  await supabase.from("conversations").insert({ id, participant_ids: [userId1, userId2], last_message_at: new Date().toISOString() });
  return id;
}

export async function searchEverything(q: string): Promise<SearchResult> {
  if (!q.trim()) return { users: [], posts: [], mehfils: [], tags: [] };
  const s = q.trim();
  const [{ data: users }, { data: posts }, { data: mehfils }] = await Promise.all([
    supabase.from("profiles").select("*").or(`handle.ilike.%${s}%,display_name.ilike.%${s}%`),
    supabase.from("posts").select("*").or(`title.ilike.%${s}%,body.ilike.%${s}%`),
    supabase.from("mehfils").select("*").or(`title.ilike.%${s}%,description.ilike.%${s}%`),
  ]);
  const allTags = (posts ?? []).flatMap((p: any) => p.tags ?? []);
  const tags = [...new Set(allTags)].filter((t: string) => t.toLowerCase().includes(s.toLowerCase()));
  return {
    users: (users ?? []).map(mapUser),
    posts: (posts ?? []).map(mapPost),
    mehfils: (mehfils ?? []).map(mapMehfil),
    tags,
  };
}

export async function getWeeklyEarnings(userId: string): Promise<number> {
  if (!userId) return 0;
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase.from("transactions").select("amount").eq("user_id", userId).in("kind", ["earning", "tip-received"]).gte("created_at", cutoff);
  return (data ?? []).reduce((sum: number, t: any) => sum + t.amount, 0);
}

export async function getAuthorPlan(authorId: string): Promise<AuthorPlan | null> {
  if (!authorId) return null;
  const { data } = await supabase.from("author_plans").select("*").eq("author_id", authorId).maybeSingle();
  return data ? mapAuthorPlan(data) : null;
}

export async function getActiveSubscription(userId: string, authorId: string): Promise<Subscription | null> {
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).eq("author_id", authorId).eq("status", "active").maybeSingle();
  return data ? mapSubscription(data) : null;
}

export async function isSubscribedTo(userId: string, authorId: string): Promise<boolean> {
  return !!(await getActiveSubscription(userId, authorId));
}

export async function getSubscribersOf(authorId: string): Promise<Subscription[]> {
  const { data } = await supabase.from("subscriptions").select("*").eq("author_id", authorId).eq("status", "active");
  return (data ?? []).map(mapSubscription);
}

export async function getInkReward(userId: string): Promise<InkReward> {
  if (!userId) return { userId: "", points: 0, streakDays: 0, lastClaimDate: "", badges: [], unlockedPostIds: [] };
  const { data } = await supabase.from("ink_rewards").select("*").eq("user_id", userId).maybeSingle();
  return data ? mapInkReward(data) : { userId, points: 0, streakDays: 0, lastClaimDate: "", badges: [], unlockedPostIds: [] };
}

export async function getTopReaders(): Promise<InkReward[]> {
  const { data } = await supabase.from("ink_rewards").select("*").order("points", { ascending: false }).limit(10);
  return (data ?? []).map(mapInkReward);
}

export async function isPostUnlocked(userId: string, postId: string): Promise<boolean> {
  const [post, reward] = await Promise.all([getPost(postId), getInkReward(userId)]);
  if (!post || !post.accessType || post.accessType === "free") return true;
  if (post.authorId === userId) return true;
  if (post.accessType === "premium") return isSubscribedTo(userId, post.authorId);
  if (post.accessType === "tip") return reward.unlockedPostIds.includes(postId);
  return false;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function likePost(postId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: existing } = await supabase.from("post_likes").select("post_id").eq("user_id", me).eq("post_id", postId).maybeSingle();
  const { data: post } = await supabase.from("posts").select("likes,author_id,title").eq("id", postId).maybeSingle();
  const current = post?.likes ?? 0;
  if (existing) {
    await supabase.from("post_likes").delete().eq("user_id", me).eq("post_id", postId);
    await supabase.from("posts").update({ likes: Math.max(0, current - 1) }).eq("id", postId);
  } else {
    await Promise.all([
      supabase.from("post_likes").insert({ user_id: me, post_id: postId }),
      supabase.from("posts").update({ likes: current + 1 }).eq("id", postId),
    ]);
    // Notify author (fire-and-forget)
    if (post?.author_id) {
      insertNotif("like", me, postId, post.author_id, `liked "${post.title ?? "your post"}"`);
    }
  }
}

export async function addComment(postId: string, body: string): Promise<Comment> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const now = new Date().toISOString();
  const row = { id: `c${uid()}`, post_id: postId, author_id: me, body, created_at: now, likes: 0 };
  const { data: post } = await supabase.from("posts").select("author_id,title").eq("id", postId).maybeSingle();
  await supabase.from("comments").insert(row);
  if (post?.author_id) {
    insertNotif("comment", me, postId, post.author_id, `commented: "${body.slice(0, 60)}"`);
  }
  const { data: postRow } = await supabase.from("posts").select("comments").eq("id", postId).maybeSingle();
  await supabase.from("posts").update({ comments: (postRow?.comments ?? 0) + 1 }).eq("id", postId);
  return mapComment(row);
}

export async function follow(userId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  if (me === userId) return;
  const { data: existing } = await supabase.from("follows").select("follower_id").eq("follower_id", me).eq("followee_id", userId).maybeSingle();
  if (existing) return;
  await supabase.from("follows").insert({ follower_id: me, followee_id: userId, created_at: new Date().toISOString() });
  const [{ data: target }, { data: meUser }] = await Promise.all([
    supabase.from("profiles").select("followers").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("following").eq("id", me).maybeSingle(),
  ]);
  await Promise.all([
    supabase.from("profiles").update({ followers: (target?.followers ?? 0) + 1 }).eq("id", userId),
    supabase.from("profiles").update({ following: (meUser?.following ?? 0) + 1 }).eq("id", me),
  ]);
  await supabase.from("notifications").insert({
    id: `n${uid()}`, kind: "follow", actor_id: me, target_id: userId,
    recipient_id: userId, body: "started following you", created_at: new Date().toISOString(), read: false,
  });
}

export async function unfollow(userId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", userId);
  const [{ data: target }, { data: meUser }] = await Promise.all([
    supabase.from("profiles").select("followers").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("following").eq("id", me).maybeSingle(),
  ]);
  await Promise.all([
    supabase.from("profiles").update({ followers: Math.max(0, (target?.followers ?? 1) - 1) }).eq("id", userId),
    supabase.from("profiles").update({ following: Math.max(0, (meUser?.following ?? 1) - 1) }).eq("id", me),
  ]);
}

export async function tipPost(postId: string, amount: number): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const [{ data: post }, { data: myWallet }] = await Promise.all([
    supabase.from("posts").select("author_id,tips_total,title").eq("id", postId).maybeSingle(),
    supabase.from("wallet_balances").select("balance").eq("user_id", me).maybeSingle(),
  ]);
  if (!post || (myWallet?.balance ?? 0) < amount) throw new Error("insufficient");
  const authorId = post.author_id;
  const { data: authorWallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", authorId).maybeSingle();
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("posts").update({ tips_total: (post.tips_total ?? 0) + amount }).eq("id", postId),
    supabase.from("wallet_balances").update({ balance: (myWallet?.balance ?? 0) - amount }).eq("user_id", me),
    supabase.from("wallet_balances").upsert({ user_id: authorId, balance: (authorWallet?.balance ?? 0) + amount }),
    supabase.from("transactions").insert([
      { id: `tx${uid()}`, user_id: me, kind: "tip-sent", amount, status: "completed", created_at: now, counterparty_id: authorId, note: `Tip on ${post.title}` },
      { id: `txr${uid()}`, user_id: authorId, kind: "tip-received", amount, status: "completed", created_at: now, counterparty_id: me, note: `Tip on ${post.title}` },
    ]),
    supabase.from("notifications").insert({ id: `n${uid()}`, kind: "tip", actor_id: me, target_id: postId, recipient_id: authorId, body: `tipped ₹${amount} on ${post.title}`, created_at: now, read: false }),
  ]);
}

export async function tipMehfil(mehfilId: string, amount: number): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const [{ data: mehfil }, { data: myWallet }] = await Promise.all([
    supabase.from("mehfils").select("host_id,title").eq("id", mehfilId).maybeSingle(),
    supabase.from("wallet_balances").select("balance").eq("user_id", me).maybeSingle(),
  ]);
  if (!mehfil || (myWallet?.balance ?? 0) < amount) throw new Error("insufficient");
  const hostId = mehfil.host_id;
  const { data: hostWallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", hostId).maybeSingle();
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("wallet_balances").update({ balance: (myWallet?.balance ?? 0) - amount }).eq("user_id", me),
    supabase.from("wallet_balances").upsert({ user_id: hostId, balance: (hostWallet?.balance ?? 0) + amount }),
    supabase.from("transactions").insert([
      { id: `tx${uid()}`, user_id: me, kind: "tip-sent", amount, status: "completed", created_at: now, counterparty_id: hostId, note: `Tip in ${mehfil.title}` },
      { id: `txr${uid()}`, user_id: hostId, kind: "tip-received", amount, status: "completed", created_at: now, counterparty_id: me, note: `Tip in ${mehfil.title}` },
    ]),
  ]);
}

export async function withdraw(amount: number, method: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: wallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", me).maybeSingle();
  if ((wallet?.balance ?? 0) < amount) throw new Error("insufficient");
  await Promise.all([
    supabase.from("wallet_balances").update({ balance: (wallet?.balance ?? 0) - amount }).eq("user_id", me),
    supabase.from("transactions").insert({ id: `tx${uid()}`, user_id: me, kind: "withdraw", amount, status: "pending", created_at: new Date().toISOString(), note: method }),
  ]);
}

// ─── Creator controls ─────────────────────────────────────────────────────────

export async function updatePost(
  postId: string,
  patch: { title?: string; body?: string; tags?: string[]; accessType?: string; isPrivate?: boolean; coverUrl?: string },
): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const dbPatch: Record<string, unknown> = {};
  if (patch.title     !== undefined) dbPatch.title       = patch.title;
  if (patch.body      !== undefined) dbPatch.body        = patch.body;
  if (patch.tags      !== undefined) dbPatch.tags        = patch.tags;
  if (patch.accessType !== undefined) dbPatch.access_type = patch.accessType;
  if (patch.isPrivate !== undefined) dbPatch.is_private  = patch.isPrivate;
  if (patch.coverUrl  !== undefined) dbPatch.cover_url   = patch.coverUrl;
  const { error } = await supabase.from("posts").update(dbPatch).eq("id", postId).eq("author_id", me);
  if (error) throw new Error(error.message);
}

export async function deletePost(postId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", me);
  if (error) throw new Error(error.message);
}

// ─── Withdrawal requests ──────────────────────────────────────────────────────

export async function requestWithdrawal(amount: number, method: string, accountDetails: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: wallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", me).maybeSingle();
  if ((wallet?.balance ?? 0) < amount) throw new Error("insufficient_balance");
  const { error } = await supabase.from("withdrawal_requests").insert({
    id: `wr${uid()}`,
    user_id: me,
    amount,
    method,
    account_details: accountDetails,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function approveWithdrawal(requestId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: req } = await supabase.from("withdrawal_requests").select("*").eq("id", requestId).maybeSingle();
  if (!req || req.status !== "pending") throw new Error("invalid_request");
  const { data: wallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", req.user_id).maybeSingle();
  if ((wallet?.balance ?? 0) < req.amount) throw new Error("insufficient_balance");
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("withdrawal_requests").update({ status: "approved", updated_at: now }).eq("id", requestId),
    supabase.from("wallet_balances").update({ balance: (wallet?.balance ?? 0) - req.amount }).eq("user_id", req.user_id),
    supabase.from("transactions").insert({ id: `tx${uid()}`, user_id: req.user_id, kind: "withdraw", amount: req.amount, status: "completed", created_at: now, note: `${req.method} withdrawal` }),
    supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: "approved_withdrawal", target: requestId, created_at: now }),
  ]);
  // Notify creator their payout was approved
  insertNotif("withdrawal-approved", me, requestId, req.user_id, `Your withdrawal of ₹${req.amount.toLocaleString()} was approved`);
}

export async function rejectWithdrawal(requestId: string, reason = ""): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("withdrawal_requests").update({ status: "rejected", note: reason, updated_at: now }).eq("id", requestId),
    supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: "rejected_withdrawal", target: requestId, created_at: now }),
  ]);
}

export async function getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const { data } = await supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(mapWithdrawalRequest);
}

export async function getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
  if (!userId) return [];
  const { data } = await supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map(mapWithdrawalRequest);
}

export async function savePost(postId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("saved_posts").upsert({ user_id: me, post_id: postId });
}

export async function unsavePost(postId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("saved_posts").delete().eq("user_id", me).eq("post_id", postId);
}

export async function joinMehfil(id: string): Promise<void> {
  const { data } = await supabase.from("mehfils").select("listeners").eq("id", id).maybeSingle();
  await supabase.from("mehfils").update({ listeners: (data?.listeners ?? 0) + 1 }).eq("id", id);
}

export async function leaveMehfil(id: string): Promise<void> {
  const { data } = await supabase.from("mehfils").select("listeners").eq("id", id).maybeSingle();
  await supabase.from("mehfils").update({ listeners: Math.max(0, (data?.listeners ?? 1) - 1) }).eq("id", id);
}

/** Notify followers when host opens a live Mehfil (actor must be host — RLS). */
export async function notifyFollowersMehfilLive(mehfilId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) return;
  const { data: mf } = await supabase.from("mehfils").select("host_id").eq("id", mehfilId).maybeSingle();
  if (!mf || mf.host_id !== me) return;
  const { data: prof } = await supabase.from("profiles").select("display_name,handle").eq("id", me).maybeSingle();
  const name = (prof?.display_name || prof?.handle || "Someone").trim() || "Someone";
  const { data: follows } = await supabase.from("follows").select("follower_id").eq("followee_id", me);
  if (!follows?.length) return;
  const body = `${name} just opened a Mehfil`;
  const now = new Date().toISOString();
  const rows = follows.map((f: { follower_id: string }) => ({
    id: `n${uid()}`,
    kind: "mehfil-start" as NotificationKind,
    actor_id: me,
    target_id: mehfilId,
    recipient_id: f.follower_id,
    body,
    created_at: now,
    read: false,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.warn("[mk:notif] mehfil live bulk insert failed", error.message);
}

const FUNCTIONS_ORIGIN = import.meta.env.VITE_SUPABASE_URL as string;

export async function startMehfilRecording(mehfilId: string): Promise<{ ok: boolean; error?: string }> {
  if (import.meta.env.DEV) console.info("[replay:egress] start_request", { mehfil_id: mehfilId });
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/functions/v1/mehfil-recording-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ mehfilId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof json?.error === "string" ? json.error : `recording_start_${res.status}`;
      if (import.meta.env.DEV) console.warn("[replay:egress] start_failed", { mehfil_id: mehfilId, error: err });
      return { ok: false, error: err };
    }
    if (import.meta.env.DEV) console.info("[replay:egress] start_ok", { mehfil_id: mehfilId, egress_id: json?.egressId ?? "" });
    return { ok: true };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : "recording_start_failed";
    if (import.meta.env.DEV) console.warn("[replay:egress] start_error", { mehfil_id: mehfilId, error: err });
    return { ok: false, error: err };
  }
}

/** Re-queue replay finalization after stop (host-only, idempotent). */
export async function retryMehfilReplayProcessing(mehfilId: string): Promise<{ ok: boolean; error?: string }> {
  if (import.meta.env.DEV) console.info("[Mehfil]", { event: "replay_processing_retry", mehfil_id: mehfilId });
  try {
    const me = getCurrentUserId();
    if (!me) return { ok: false, error: "not_authenticated" };
    await supabase
      .from("mehfil_replays")
      .update({ replay_processing_status: "processing", recording_error: null })
      .eq("mehfil_id", mehfilId)
      .eq("host_id", me)
      .eq("published", false);
    await stopMehfilRecording(mehfilId);
    const res = await reconcileMehfilReplayProcessing(mehfilId);
    if (!res.ok) return { ok: false, error: res.error ?? "reconcile_failed" };
    return { ok: true };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : "retry_failed";
    if (import.meta.env.DEV) console.warn("[Mehfil]", { event: "replay_processing_retry_failed", mehfil_id: mehfilId, error: err });
    return { ok: false, error: err };
  }
}

export async function stopMehfilRecording(mehfilId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (import.meta.env.DEV) console.info("[replay:egress] stop_request", { mehfil_id: mehfilId });
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/functions/v1/mehfil-recording-stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ mehfilId }),
    });
    const json = await res.json().catch(() => ({}));
    if (import.meta.env.DEV) {
      if (!res.ok) console.warn("[replay:egress] stop_failed", { mehfil_id: mehfilId, status: res.status, error: json?.error ?? "" });
      else console.info("[replay:egress] stop_ok", { mehfil_id: mehfilId, stopped: json?.stopped ?? false, status: json?.status ?? "" });
    }
    if (!res.ok) {
      return { ok: false, error: typeof json?.error === "string" ? json.error : `recording_stop_${res.status}` };
    }
    return { ok: true, status: typeof json?.status === "string" ? json.status : undefined };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) console.warn("[replay:egress] stop_error", { mehfil_id: mehfilId, error: err });
    else console.warn("[mk:recording] stop failed", e);
    return { ok: false, error: err };
  }
}

/** Poll LiveKit egress and finalize replay row when webhook is delayed or missing. */
export async function reconcileMehfilReplayProcessing(mehfilId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (import.meta.env.DEV) console.info("[Mehfil]", { event: "replay_processing_reconcile", mehfil_id: mehfilId });
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/functions/v1/mehfil-recording-reconcile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ mehfilId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof json?.error === "string" ? json.error : `reconcile_${res.status}`;
      return { ok: false, error: err };
    }
    return { ok: true, status: typeof json?.status === "string" ? json.status : undefined };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "reconcile_failed" };
  }
}

/** Host end: stop egress then reconcile so replay sheet opens with truthful status. */
export async function finalizeMehfilRecordingOnEnd(mehfilId: string): Promise<void> {
  await stopMehfilRecording(mehfilId);
  await reconcileMehfilReplayProcessing(mehfilId);
}

export async function startMehfil(id: string): Promise<void> {
  await supabase.from("mehfils").update({
    is_live: true,
    starts_at: new Date().toISOString(),
    ended_at: null,
  } as Record<string, unknown>).eq("id", id);
}

export async function endMehfil(id: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("mehfils").update({ is_live: false, listeners: 0, ended_at: now }).eq("id", id);
}

/** Host-only: bumps discovery window so this gathering appears on public lists again (~24h). */
export async function restoreMehfilFeedVisibility(id: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: row } = await supabase.from("mehfils").select("host_id").eq("id", id).maybeSingle();
  if (row?.host_id !== me) throw new Error("only_host");
  await supabase.from("mehfils").update({
    ended_at: new Date().toISOString(),
    archived: false,
  } as Record<string, unknown>).eq("id", id);
}

export async function createMehfil(payload: Omit<Mehfil, "id" | "listeners" | "isLive">): Promise<Mehfil> {
  const authId = getCurrentUserId();
  await ensureProfileExists(authId);
  const id = `m${uid()}`;
  const row = {
    id,
    host_id: payload.hostId,
    title: payload.title,
    description: payload.description,
    is_live: false,
    listeners: 0,
    starts_at: payload.startsAt,
    cover_url: payload.coverUrl,
    language: payload.language,
    tags: payload.tags ?? [],
    session_mode: payload.sessionMode ?? "voice",
  };
  console.log("[mk:createMehfil] inserting", { row, authId });
  const { data, error } = await supabase.from("mehfils").insert(row).select().maybeSingle();
  if (error) {
    console.error("[mk:createMehfil] FAILED", { code: error.code, message: error.message, details: error.details, hint: error.hint, row, authId });
    throw new Error(`${error.code}: ${error.message}${error.hint ? ` — ${error.hint}` : ""}${error.details ? ` | ${error.details}` : ""}`);
  }
  console.log("[mk:createMehfil] OK", data);
  return { ...payload, id, listeners: 0, isLive: false };
}

export async function addPost(post: Omit<Post, "id" | "createdAt" | "likes" | "comments" | "tipsTotal">): Promise<Post> {
  const authId = getCurrentUserId();
  await ensureProfileExists(authId);
  const id = `p${uid()}`;
  const created_at = new Date().toISOString();
  const row: Record<string, unknown> = {
    id,
    kind: post.kind,
    author_id: post.authorId,
    title: post.title,
    body: post.body,
    language: post.language,
    created_at,
    likes: 0,
    comments: 0,
    tips_total: 0,
    tags: post.tags ?? [],
    access_type: post.accessType ?? "free",
  };
  if (post.videoUrl != null) row.video_url = post.videoUrl;
  if (post.audioUrl != null) row.audio_url = post.audioUrl;
  if (post.coverUrl != null) row.cover_url = post.coverUrl;
  if (post.durationSec != null) row.duration_sec = post.durationSec;
  if (post.minTip != null) row.min_tip = post.minTip;
  if (post.isPrivate === true) row.is_private = true;
  if (post.sourceMehfilId != null) row.source_mehfil_id = post.sourceMehfilId;
  console.log("[mk:addPost] inserting", { row, authId });
  const { data, error } = await supabase.from("posts").insert(row).select().maybeSingle();
  if (error) {
    console.error("[mk:addPost] FAILED", { code: error.code, message: error.message, details: error.details, hint: error.hint, row, authId });
    throw new Error(`${error.code}: ${error.message}${error.hint ? ` — ${error.hint}` : ""}${error.details ? ` | ${error.details}` : ""}`);
  }
  console.log("[mk:addPost] OK", data);
  return { ...post, id, createdAt: created_at, likes: 0, comments: 0, tipsTotal: 0 };
}

// ─── Mehfil replay (draft → publish as voice post + tag) ───────────────────────

export type MehfilReplayRow = {
  id: string;
  mehfilId: string;
  hostId: string;
  /** Present once egress webhook attaches replay media */
  audioUrl?: string | null;
  videoUrl?: string | null;
  title: string;
  coverUrl?: string;
  durationSec?: number;
  postId?: string;
  published: boolean;
  isPrivate: boolean;
  deleted: boolean;
  createdAt: string;
  replayProcessingStatus: "pending" | "recording" | "processing" | "ready" | "failed";
  recordingError?: string | null;
};

function mapMehfilReplayRow(r: Record<string, unknown>): MehfilReplayRow {
  const st = r.replay_processing_status as string | undefined;
  const allowed = ["pending", "recording", "processing", "ready", "failed"] as const;
  let replayProcessingStatus: MehfilReplayRow["replayProcessingStatus"] = "pending";
  if (st && (allowed as readonly string[]).includes(st)) {
    replayProcessingStatus = st as MehfilReplayRow["replayProcessingStatus"];
  }
  return {
    id: r.id as string,
    mehfilId: r.mehfil_id as string,
    hostId: r.host_id as string,
    audioUrl: (r.audio_url as string | null | undefined) ?? null,
    videoUrl: (r.video_url as string | null | undefined) ?? null,
    title: (r.title as string) ?? "",
    coverUrl: (r.cover_url as string) ?? undefined,
    durationSec: (r.duration_sec as number) ?? undefined,
    postId: (r.post_id as string) ?? undefined,
    published: Boolean(r.published),
    isPrivate: Boolean(r.is_private),
    deleted: Boolean(r.deleted),
    createdAt: r.created_at as string,
    replayProcessingStatus,
    recordingError: (r.recording_error as string | null | undefined) ?? null,
  };
}

export async function getMehfilReplayDraft(mehfilId: string): Promise<MehfilReplayRow | null> {
  const me = getCurrentUserId();
  if (!me) return null;
  const { data, error } = await supabase
    .from("mehfil_replays")
    .select("*")
    .eq("mehfil_id", mehfilId)
    .eq("host_id", me)
    .eq("published", false)
    .eq("deleted", false)
    .maybeSingle();
  if (error || !data) return null;
  return mapMehfilReplayRow(data as Record<string, unknown>);
}

export async function getPublishedMehfilReplay(mehfilId: string): Promise<MehfilReplayRow | null> {
  const { data, error } = await supabase
    .from("mehfil_replays")
    .select("*")
    .eq("mehfil_id", mehfilId)
    .eq("published", true)
    .eq("deleted", false)
    .maybeSingle();
  if (error || !data) return null;
  return mapMehfilReplayRow(data as Record<string, unknown>);
}

export async function upsertMehfilReplayDraft(vars: {
  mehfilId: string;
  /** Null when studio replay audio is not attached yet (live pipeline). */
  audioUrl: string | null;
  title: string;
  coverUrl?: string;
  durationSec?: number;
  isPrivate: boolean;
}): Promise<MehfilReplayRow> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: mf } = await supabase.from("mehfils").select("host_id").eq("id", vars.mehfilId).maybeSingle();
  if (!mf || mf.host_id !== me) throw new Error("not_host");

  const { data: existing } = await supabase
    .from("mehfil_replays")
    .select("*")
    .eq("mehfil_id", vars.mehfilId)
    .eq("host_id", me)
    .eq("published", false)
    .eq("deleted", false)
    .maybeSingle();

  const payload = {
    audio_url: vars.audioUrl,
    title: vars.title.trim() || "Mehfil replay",
    cover_url: vars.coverUrl ?? null,
    duration_sec: vars.durationSec ?? null,
    is_private: vars.isPrivate,
  };

  if (existing) {
    const { data, error } = await supabase.from("mehfil_replays").update(payload).eq("id", existing.id).select().maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "update_failed");
    return mapMehfilReplayRow(data as Record<string, unknown>);
  }

  const id = `mr${uid()}`;
  const { data, error } = await supabase
    .from("mehfil_replays")
    .insert({
      id,
      mehfil_id: vars.mehfilId,
      host_id: me,
      ...payload,
      published: false,
      deleted: false,
      post_id: null,
    })
    .select()
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "insert_failed");
  return mapMehfilReplayRow(data as Record<string, unknown>);
}

export async function publishMehfilReplay(replayId: string): Promise<Post> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: r, error: fetchErr } = await supabase.from("mehfil_replays").select("*").eq("id", replayId).maybeSingle();
  if (fetchErr || !r || r.host_id !== me) throw new Error("not_found");
  if (r.published && r.post_id) throw new Error("already_published");
  const audioUrl = r.audio_url as string | null;
  const videoUrl = r.video_url as string | null;
  const hasVideo = !!(videoUrl && String(videoUrl).trim());
  const hasAudio = !!(audioUrl && String(audioUrl).trim());
  if (!hasVideo && !hasAudio) throw new Error("replay_audio_pending");

  const post = await addPost({
    kind: hasVideo ? "reel" : "voice",
    authorId: me,
    title: r.title || "Mehfil replay",
    body: "",
    audioUrl: hasVideo ? (audioUrl?.trim() || undefined) : audioUrl!.trim(),
    videoUrl: hasVideo ? videoUrl!.trim() : undefined,
    coverUrl: r.cover_url ?? undefined,
    durationSec: r.duration_sec ?? undefined,
    language: "or",
    tags: ["mehfil-replay"],
    accessType: "free",
    isPrivate: Boolean(r.is_private),
    sourceMehfilId: r.mehfil_id,
  });

  const { error: upErr } = await supabase
    .from("mehfil_replays")
    .update({ published: true, post_id: post.id })
    .eq("id", replayId);
  if (upErr) throw new Error(upErr.message);
  return post;
}

export async function deleteMehfilReplay(replayId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: r } = await supabase.from("mehfil_replays").select("host_id,post_id").eq("id", replayId).maybeSingle();
  if (!r || r.host_id !== me) throw new Error("not_found");
  if (r.post_id) await supabase.from("posts").delete().eq("id", r.post_id);
  await supabase.from("mehfil_replays").delete().eq("id", replayId);
}

export function usePublishedMehfilReplay(mehfilId: string) {
  return useQuery({
    queryKey: ["mehfilReplayPublished", mehfilId] as const,
    queryFn: () => getPublishedMehfilReplay(mehfilId),
    enabled: !!mehfilId,
    staleTime: 15_000,
  });
}

export function useMehfilReplayDraftRow(mehfilId: string, enabled: boolean, pollWhileProcessing = false) {
  return useQuery({
    queryKey: QK.mehfilReplayDraft(mehfilId),
    queryFn: () => getMehfilReplayDraft(mehfilId),
    enabled: !!mehfilId && enabled,
    staleTime: 2500,
    refetchInterval: (query) => {
      if (!pollWhileProcessing) return false;
      const row = query.state.data;
      if (!row) return 4000;
      const st = row.replayProcessingStatus;
      const hasAsset = !!(row.audioUrl?.trim() || row.videoUrl?.trim());
      if (st === "failed" || st === "ready" || hasAsset) return false;
      return 12000;
    },
  });
}

export function useMehfilReplayDraftRealtime(mehfilId: string, enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !mehfilId) return;
    const channel = supabase
      .channel(`realtime:mehfil_replay:${mehfilId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mehfil_replays", filter: `mehfil_id=eq.${mehfilId}` },
        () => qc.invalidateQueries({ queryKey: QK.mehfilReplayDraft(mehfilId) }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mehfil_replays", filter: `mehfil_id=eq.${mehfilId}` },
        () => qc.invalidateQueries({ queryKey: QK.mehfilReplayDraft(mehfilId) }),
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logOpsEvent("realtime_channel_issue", {
            channel: `realtime:mehfil_replay:${mehfilId}`,
            status,
            message: err?.message ?? "",
          });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, mehfilId, enabled]);
}

export async function updateUser(userId: string, patch: Partial<User>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName;
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.bio !== undefined) dbPatch.bio = patch.bio;
  if (patch.language !== undefined) dbPatch.language = patch.language;
  if (patch.verified !== undefined) dbPatch.verified = patch.verified;
  if (patch.isAdmin !== undefined) dbPatch.is_admin = patch.isAdmin;
  if (patch.suspended !== undefined) dbPatch.suspended = patch.suspended;
  if (patch.followers !== undefined) dbPatch.followers = patch.followers;
  if (patch.following !== undefined) dbPatch.following = patch.following;
  if (patch.handle !== undefined) dbPatch.handle = patch.handle;
  const { error } = await supabase.from("profiles").update(dbPatch).eq("id", userId);
  if (error) throw new Error(error.message);
}

const COVER_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** Prefer browser-provided type; fall back from extension when Safari leaves `file.type` empty. */
function inferCoverImageContentType(file: File): string {
  const t = file.type?.trim().toLowerCase();
  if (t && COVER_IMAGE_CONTENT_TYPES.has(t)) return t === "image/jpg" ? "image/jpeg" : t;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

function friendlyCoverImageUploadMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("mime type") || m.includes("invalid mime") || m.includes("not supported")) {
    return "Couldn't upload image. Please try another file (JPEG, PNG, or WebP).";
  }
  if (m.includes("payload too large") || m.includes("too large") || m.includes("file size")) {
    return "File is too large. Try a smaller image.";
  }
  return "Couldn't upload image. Please try again.";
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const cfg = await getAdminConfig();
  assertUploadWithinMb(file.size, cfg.max_upload_avatar_mb, "Avatar photo");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `avatars/${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Story / voice post cover images — `audio` bucket, covers/ prefix */
export async function uploadPostCoverImage(userId: string, file: File): Promise<string> {
  if (import.meta.env.DEV) {
    console.info("[upload:cover] start", { name: file.name, type: file.type, size: file.size });
  }
  const cfg = await getAdminConfig();
  assertUploadWithinMb(file.size, cfg.max_upload_audio_mb, "Cover image");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const safeExt = ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg";
  const path = `covers/${userId}/${Date.now()}.${safeExt}`;
  const contentType = inferCoverImageContentType(file);
  const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true, contentType });
  if (error) {
    if (import.meta.env.DEV) console.warn("[upload:cover] failed", error.message);
    throw new Error(friendlyCoverImageUploadMessage(error.message));
  }
  if (import.meta.env.DEV) console.info("[upload:cover] ok", path);
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

/** Reel thumbnail JPEG from canvas — same bucket limit as other covers */
export async function uploadReelPosterJpeg(userId: string, blob: Blob): Promise<string> {
  const cfg = await getAdminConfig();
  assertUploadWithinMb(blob.size, cfg.max_upload_audio_mb, "Poster image");
  const path = `covers/${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("audio").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAudio(userId: string, blob: Blob, ext = "webm"): Promise<string> {
  const cfg = await getAdminConfig();
  assertUploadWithinMb(blob.size, cfg.max_upload_audio_mb, "Voice recording");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const path = `voices/${userId}/${filename}`;
  const contentType = blob.type || `audio/${ext}`;
  const { error } = await supabase.storage.from("audio").upload(path, blob, { upsert: false, contentType });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMediaFile(userId: string, file: File, bucket: "audio" | "video"): Promise<string> {
  const cfg = await getAdminConfig();
  const label = bucket === "video" ? "Reel video" : "Audio file";
  assertUploadWithinMb(file.size, cfg.max_upload_audio_mb, label);
  const ext = file.name.split(".").pop() ?? "mp4";
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const folder = bucket === "audio" ? "tracks" : "reels";
  const path = `${folder}/${userId}/${filename}`;
  const storageBucket = bucket === "video" ? "audio" : bucket;
  const { error } = await supabase.storage.from(storageBucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Reel vertical video — stored in public `audio` bucket (allows video/* MIME per bucket policy). */
export async function uploadReelVideoFile(userId: string, file: File): Promise<string> {
  return uploadMediaFile(userId, file, "video");
}

export async function registerUser(displayName: string, _phone: string): Promise<User> {
  const authId = getCurrentUserId();
  if (!authId) throw new Error("not_authenticated");
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/, "") || "user";
  const handle = `${slug}.${Math.floor(Math.random() * 900 + 100)}`;
  const user: User = {
    id: authId, handle, displayName, language: "or",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces",
    bio: "", verified: false, followers: 0, following: 0, isAdmin: false,
  };
  await Promise.allSettled([
    supabase.from("profiles").upsert({ id: authId, handle, display_name: displayName, avatar_url: user.avatarUrl, bio: "", language: "or", verified: false, is_admin: false }),
    supabase.from("wallet_balances").insert({ user_id: authId, balance: 0 }),
    supabase.from("ink_rewards").insert({ user_id: authId, points: 0, streak_days: 0, last_claim_date: "", badges: [], unlocked_post_ids: [] }),
  ]);
  return user;
}

// ─── Supabase Auth ────────────────────────────────────────────────────────────

export async function sendPhoneOtp(phone: string): Promise<void> {
  const intlPhone = `+91${phone.replace(/\D/g, "").slice(-10)}`;
  const { error } = await supabase.auth.signInWithOtp({ phone: intlPhone });
  if (error) throw new Error(error.message);
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<"existing" | "new"> {
  const intlPhone = `+91${phone.replace(/\D/g, "").slice(-10)}`;
  const { data, error } = await supabase.auth.verifyOtp({ phone: intlPhone, token, type: "sms" });
  if (error) throw new Error(error.message);
  const authId = data.user?.id;
  if (!authId) throw new Error("Authentication failed");
  return resolveAuthUser(authId);
}

export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyEmailOtp(email: string, token: string): Promise<"existing" | "new"> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(error.message);
  const authId = data.user?.id;
  if (!authId) throw new Error("Verification failed — please try again.");
  return resolveAuthUser(authId);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/** @deprecated stub kept for compat — admin auth now uses Supabase */
export function login(_userId: string): void {}

export async function signInWithGoogle(): Promise<void> {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${base}/auth/callback` },
  });
  if (error) throw new Error(error.message);
}

export async function handleOAuthCallback(): Promise<"existing" | "new" | null> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = async (userId: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub?.data?.subscription?.unsubscribe();
      resolve(await resolveAuthUser(userId));
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      sub?.data?.subscription?.unsubscribe();
      resolve(null);
    };

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        finish(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) finish(data.session.user.id);
    });

    const timer = setTimeout(fail, 15_000);
  });
}

async function resolveAuthUser(authId: string): Promise<"existing" | "new"> {
  const { data } = await supabase.from("profiles").select("id").eq("id", authId).maybeSingle();
  if (data?.id) return "existing";
  return "new";
}

export function getPendingAuthId(): string | null {
  return null;
}

export async function registerUserWithAuth(displayName: string, language: "or" | "hi" = "or"): Promise<User> {
  const authId = getCurrentUserId();
  if (!authId) throw new Error("not_authenticated");
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/, "") || "user";
  const handle = `${slug}.${Math.floor(Math.random() * 900 + 100)}`;
  const user: User = {
    id: authId, handle, displayName, language,
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces",
    bio: "", verified: false, followers: 0, following: 0, isAdmin: false,
  };
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    handle: user.handle,
    display_name: user.displayName,
    avatar_url: user.avatarUrl,
    bio: user.bio,
    language: user.language,
    verified: user.verified,
    is_admin: user.isAdmin,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await Promise.allSettled([
    supabase.from("wallet_balances").insert({ user_id: authId, balance: 100 }),
    supabase.from("ink_rewards").insert({ user_id: authId, points: 0, streak_days: 0, last_claim_date: new Date().toISOString(), badges: [], unlocked_post_ids: [] }),
  ]);
  return user;
}

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const now = new Date().toISOString();
  const row = { id: `msg${uid()}`, conversation_id: conversationId, sender_id: me, body, created_at: now };
  // Fetch conversation to find the other participant
  const { data: conv } = await supabase.from("conversations").select("participant_ids").eq("id", conversationId).maybeSingle();
  const otherId: string | undefined = conv?.participant_ids?.find((id: string) => id !== me);
  await Promise.all([
    supabase.from("messages").insert(row),
    supabase.from("conversations").update({ last_message_at: now }).eq("id", conversationId),
  ]);
  if (otherId) {
    // Remove previous unread message notification from this sender to avoid spam
    await supabase.from("notifications")
      .delete()
      .eq("kind", "message")
      .eq("actor_id", me)
      .eq("recipient_id", otherId)
      .eq("read", false);
    insertNotif("message", me, conversationId, otherId, body.slice(0, 80));
  }
  return mapMessage(row);
}

export async function markNotificationRead(id: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) return;
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("recipient_id", me);
}

export async function markAllNotificationsRead(): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("notifications").update({ read: true }).eq("recipient_id", me);
}

export async function addReport(kind: ReportKind, targetId: string, reason: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("reports").insert({
    id: `r${uid()}`, kind, target_id: targetId, reason,
    reporter_id: me, status: "pending", created_at: new Date().toISOString(),
  });
}

export async function resolveReport(id: string, action: "resolved" | "dismissed"): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await Promise.all([
    supabase.from("reports").update({ status: action }).eq("id", id),
    supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: `${action} report`, target: id, created_at: new Date().toISOString() }),
  ]);
}

export async function suspendUser(userId: string, on: boolean): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await Promise.all([
    supabase.from("profiles").update({ suspended: on }).eq("id", userId),
    supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: on ? "suspended user" : "reinstated user", target: userId, created_at: new Date().toISOString() }),
  ]);
}

export async function verifyUser(userId: string, on: boolean): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await Promise.all([
    supabase.from("profiles").update({ verified: on }).eq("id", userId),
    supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: on ? "verified user" : "removed verification", target: userId, created_at: new Date().toISOString() }),
  ]);
}

export async function moderatePost(postId: string, action: "approve" | "hide" | "reject"): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const now = new Date().toISOString();
  if (action === "hide") {
    const { error } = await supabase.from("posts").update({ hidden: true, moderated_at: now, moderated_by: me }).eq("id", postId);
    if (error) throw new Error(error.message);
  } else if (action === "reject") {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);
  }
  await supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action: action === "approve" ? "approved post" : action === "hide" ? "hid post" : "rejected post", target: postId, created_at: now });
}

export async function addAdminLog(action: string, target: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("admin_logs").insert({ id: `al${uid()}`, actor_id: me, action, target, created_at: new Date().toISOString() });
}

export async function earnInkPoints(userId: string, points: number): Promise<void> {
  if (!userId) return;
  const { data } = await supabase.from("ink_rewards").select("*").eq("user_id", userId).maybeSingle();
  if (data) {
    const newPoints = data.points + points;
    await supabase.from("ink_rewards").update({ points: newPoints, badges: computeBadges(newPoints, data.badges ?? []) }).eq("user_id", userId);
  } else {
    await supabase.from("ink_rewards").insert({ user_id: userId, points, streak_days: 0, last_claim_date: "", badges: computeBadges(points, []), unlocked_post_ids: [] });
  }
}

export async function claimDailyStreak(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.from("ink_rewards").select("*").eq("user_id", userId).maybeSingle();
  const today = new Date().toISOString().split("T")[0];
  const lastClaim = data?.last_claim_date ?? "";
  if (lastClaim === today) return false;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const streakDays = lastClaim === yesterday ? (data?.streak_days ?? 0) + 1 : 1;
  const newPoints = (data?.points ?? 0) + 3;
  if (data) {
    await supabase.from("ink_rewards").update({ points: newPoints, streak_days: streakDays, last_claim_date: today, badges: computeBadges(newPoints, data.badges ?? []) }).eq("user_id", userId);
  } else {
    await supabase.from("ink_rewards").insert({ user_id: userId, points: 3, streak_days: 1, last_claim_date: today, badges: computeBadges(3, []), unlocked_post_ids: [] });
  }
  return true;
}

export async function subscribeToAuthor(authorId: string): Promise<"ok" | "already" | "insufficient" | "no-plan"> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const [plan, existing, wallet] = await Promise.all([
    getAuthorPlan(authorId),
    getActiveSubscription(me, authorId),
    getWalletBalance(me),
  ]);
  if (!plan || !plan.enabled) return "no-plan";
  if (existing) return "already";
  if (wallet < plan.priceMonthly) return "insufficient";
  const { data: authorWallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", authorId).maybeSingle();
  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await Promise.all([
    supabase.from("wallet_balances").update({ balance: wallet - plan.priceMonthly }).eq("user_id", me),
    supabase.from("wallet_balances").upsert({ user_id: authorId, balance: (authorWallet?.balance ?? 0) + plan.priceMonthly }),
    supabase.from("subscriptions").insert({ id: `sub${uid()}`, author_id: authorId, user_id: me, start_date: now, expiry_date: expiry, status: "active" }),
    supabase.from("transactions").insert([
      { id: `tx${uid()}`, user_id: me, kind: "tip-sent", amount: plan.priceMonthly, status: "completed", created_at: now, counterparty_id: authorId, note: "Subscription" },
      { id: `txr${uid()}`, user_id: authorId, kind: "tip-received", amount: plan.priceMonthly, status: "completed", created_at: now, counterparty_id: me, note: "Subscription income" },
    ]),
    supabase.from("notifications").insert({ id: `n${uid()}`, kind: "follow", actor_id: me, target_id: authorId, recipient_id: authorId, body: "subscribed to your channel", created_at: now, read: false }),
    earnInkPoints(me, 20),
  ]);
  return "ok";
}

export async function unsubscribeFromAuthor(authorId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("user_id", me).eq("author_id", authorId).eq("status", "active");
}

export async function unlockPostWithTip(postId: string, amount: number): Promise<"ok" | "insufficient"> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const wallet = await getWalletBalance(me);
  if (wallet < amount) return "insufficient";
  const { data: post } = await supabase.from("posts").select("author_id,tips_total,title").eq("id", postId).maybeSingle();
  if (!post) return "insufficient";
  const authorId = post.author_id;
  const { data: authorWallet } = await supabase.from("wallet_balances").select("balance").eq("user_id", authorId).maybeSingle();
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("wallet_balances").update({ balance: wallet - amount }).eq("user_id", me),
    supabase.from("wallet_balances").upsert({ user_id: authorId, balance: (authorWallet?.balance ?? 0) + amount }),
    supabase.from("posts").update({ tips_total: (post.tips_total ?? 0) + amount }).eq("id", postId),
    supabase.from("transactions").insert({ id: `tx${uid()}`, user_id: me, kind: "tip-sent", amount, status: "completed", created_at: now, counterparty_id: authorId, note: `Unlock tip on ${post.title}` }),
    earnInkPoints(me, 10),
  ]);
  const reward = await getInkReward(me);
  if (!reward.unlockedPostIds.includes(postId)) {
    await supabase.from("ink_rewards").update({ unlocked_post_ids: [...reward.unlockedPostIds, postId] }).eq("user_id", me);
  }
  return "ok";
}

export async function unlockPostWithPoints(postId: string): Promise<"ok" | "insufficient"> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const reward = await getInkReward(me);
  if (reward.points < 50) return "insufficient";
  const newPoints = reward.points - 50;
  await supabase.from("ink_rewards").update({
    points: newPoints,
    badges: computeBadges(newPoints, reward.badges),
    unlocked_post_ids: [...reward.unlockedPostIds, postId],
  }).eq("user_id", me);
  return "ok";
}

export async function updateAuthorPlan(patch: Partial<AuthorPlan> & { authorId?: string }): Promise<void> {
  const authorId = patch.authorId ?? getCurrentUserId();
  if (!authorId) throw new Error("not_authenticated");
  const { data: existing } = await supabase.from("author_plans").select("*").eq("author_id", authorId).maybeSingle();
  const dbPatch: Record<string, unknown> = {};
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.priceMonthly !== undefined) dbPatch.price_monthly = patch.priceMonthly;
  if (patch.benefits !== undefined) dbPatch.benefits = patch.benefits;
  if (existing) {
    await supabase.from("author_plans").update(dbPatch).eq("author_id", authorId);
  } else {
    await supabase.from("author_plans").insert({ author_id: authorId, enabled: true, price_monthly: 99, benefits: [], ...dbPatch });
  }
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const QK = {
  posts: ["posts"] as const,
  post: (id: string) => ["post", id] as const,
  comments: (postId: string) => ["comments", postId] as const,
  user: (id: string) => ["user", id] as const,
  userByHandle: (h: string) => ["userByHandle", h] as const,
  postsByAuthor: (id: string) => ["postsByAuthor", id] as const,
  mehfils: ["mehfils"] as const,
  mehfilsByHost: (hostId: string) => ["mehfilsByHost", hostId] as const,
  mehfil: (id: string) => ["mehfil", id] as const,
  transactions: (userId: string) => ["transactions", userId] as const,
  notifications: ["notifications"] as const,
  reports: ["reports"] as const,
  adminLogs: ["adminLogs"] as const,
  topCreators: ["topCreators"] as const,
  trendingPosts: ["trendingPosts"] as const,
  followers: (id: string) => ["followers", id] as const,
  following: (id: string) => ["following", id] as const,
  walletBalance: (id: string) => ["walletBalance", id] as const,
  search: (q: string) => ["search", q] as const,
  currentUser: ["currentUser"] as const,
  savedPosts: (userId: string) => ["savedPosts", userId] as const,
  conversations: (userId: string) => ["conversations", userId] as const,
  messages: (convId: string) => ["messages", convId] as const,
  authorPlan: (id: string) => ["authorPlan", id] as const,
  subscriptions: (userId: string) => ["subscriptions", userId] as const,
  subscribersOf: (authorId: string) => ["subscribersOf", authorId] as const,
  inkReward: (userId: string) => ["inkReward", userId] as const,
  topReaders: ["topReaders"] as const,
  mehfilReplayDraft: (mehfilId: string) => ["mehfilReplayDraft", mehfilId] as const,
};

// ─── React Query hooks ────────────────────────────────────────────────────────

const useQ = <T,>(key: readonly unknown[], fn: () => Promise<T>) =>
  useQuery({ queryKey: key as readonly unknown[], queryFn: fn, staleTime: 30_000 });

export const useFeed = () => useQ(QK.posts, getPosts);
export const usePost = (id: string) => useQ(QK.post(id), () => getPost(id));
export const useComments = (postId: string) => useQ(QK.comments(postId), () => getPostComments(postId));
export const useUser = (id: string) => useQ(QK.user(id), () => getUser(id));
export const useUserByHandle = (h: string) => useQ(QK.userByHandle(h), () => getUserByHandle(h));
export const usePostsByAuthor = (id: string) => useQ(QK.postsByAuthor(id), () => getPostsByAuthor(id));
export const useMehfils = () => useQ(QK.mehfils, getMehfils);
export const useMehfilsForHost = (hostId: string) =>
  useQuery({
    queryKey: QK.mehfilsByHost(hostId),
    queryFn: () => getMehfilsForHost(hostId),
    enabled: !!hostId,
    staleTime: 30_000,
  });
export const useMehfil = (id: string) => useQ(QK.mehfil(id), () => getMehfil(id));

/** Aggressive Mehfil row refresh while inside the room (same cache key as {@link useMehfil}). */
export const useMehfilRoom = (id: string) =>
  useQuery({
    queryKey: QK.mehfil(id),
    queryFn: () => getMehfil(id),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.isLive ? 5_000 : false),
  });
export const useTransactions = (id?: string) => {
  const userId = id ?? getCurrentUserId() ?? "";
  // staleTime:0 ensures fresh data on every mount (wallet statements must be current)
  return useQuery({
    queryKey: QK.transactions(userId),
    queryFn: () => getTransactionsForUser(userId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
export const useNotifications = () => useQ(QK.notifications, getNotifications);
// Lightweight unread count — key is a child of QK.notifications so it gets
// invalidated for free whenever the realtime hook invalidates QK.notifications.
export const useUnreadCount = () =>
  useQuery({ queryKey: [...QK.notifications, "count"], queryFn: getUnreadCount, staleTime: 15_000 });
export const useReports = () => useQ(QK.reports, getReports);
export const useAdminLogs = () => useQ(QK.adminLogs, getAdminLogs);
export const useTopCreators = (_limit?: number) => {
  const q = useQ(QK.topCreators, getTopCreators);
  return { ...q, data: _limit ? q.data?.slice(0, _limit) : q.data };
};
export const useTrendingPosts = () => useQ(QK.trendingPosts, getTrendingPosts);
export const useFollowers = (id: string) => useQ(QK.followers(id), () => getFollowers(id));
export const useFollowing = (id: string) => useQ(QK.following(id), () => getFollowing(id));
export const useWalletBalance = (id?: string) => {
  const userId = id ?? getCurrentUserId();
  return useQ(QK.walletBalance(userId), () => getWalletBalance(userId));
};
export const useCurrentUser = () => useQ(QK.currentUser, getCurrentUser);
export const useSearch = (q: string) => useQ(QK.search(q), () => searchEverything(q));
export const useSavedPosts = (userId?: string) => {
  const id = userId ?? getCurrentUserId();
  return useQ(QK.savedPosts(id), () => getSavedPosts(id));
};
export const useConversations = (userId?: string) => {
  const id = userId ?? getCurrentUserId();
  return useQ(QK.conversations(id), () => getConversations(id));
};
export const useConversationMessages = (convId: string) => useQ(QK.messages(convId), () => getMessages(convId));

export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useLike(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => likePost(postId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.posts }); qc.invalidateQueries({ queryKey: QK.post(postId) }); qc.invalidateQueries({ queryKey: QK.trendingPosts }); },
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; on: boolean }) => vars.on ? follow(vars.userId) : unfollow(vars.userId),
    onSuccess: (_, vars) => {
      const me = getCurrentUserId() ?? "";
      qc.invalidateQueries({ queryKey: QK.followers(vars.userId) });
      qc.invalidateQueries({ queryKey: QK.followers(me) });
      qc.invalidateQueries({ queryKey: QK.following(me) });
      qc.invalidateQueries({ queryKey: QK.user(vars.userId) });
      qc.invalidateQueries({ queryKey: QK.user(me) });
      qc.invalidateQueries({ queryKey: ["isFollowing", me, vars.userId] });
      qc.invalidateQueries({ queryKey: QK.notifications });
      qc.invalidateQueries({ queryKey: [...QK.notifications, "count"] });
      qc.invalidateQueries({ queryKey: QK.currentUser });
      toast.success(vars.on ? "Following" : "Unfollowed");
    },
  });
}

export function invalidateWallet(qc: ReturnType<typeof useQueryClient>) {
  const me = getCurrentUserId() ?? "";
  if (!me) return;
  qc.invalidateQueries({ queryKey: QK.walletBalance(me) });
  qc.invalidateQueries({ queryKey: QK.transactions(me) });
}

function walletLog(event: string, detail: Record<string, unknown> = {}) {
  if (!import.meta.env.DEV) return;
  console.info("[wallet:support]", { event, ...detail });
}

export function useTip(scope: "post" | "mehfil") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; amount: number }) =>
      scope === "post" ? tipPost(vars.id, vars.amount) : tipMehfil(vars.id, vars.amount),
    onSuccess: () => {
      invalidateWallet(qc);
      qc.invalidateQueries({ queryKey: QK.posts });
      toast.success("Tip sent");
    },
    onError: () => toast.error("Insufficient balance"),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => addComment(postId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.comments(postId) }); qc.invalidateQueries({ queryKey: QK.post(postId) }); },
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { amount: number; method: string }) => withdraw(vars.amount, vars.method),
    onSuccess: () => {
      invalidateWallet(qc);
      toast.success("Withdrawal requested");
    },
    onError: (e: Error) => toast.error(e.message ?? "Withdrawal failed"),
  });
}

// ─── Creator-control hooks ─────────────────────────────────────────────────────

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { postId: string; patch: Parameters<typeof updatePost>[1] }) => updatePost(vars.postId, vars.patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK.post(vars.postId) });
      qc.invalidateQueries({ queryKey: QK.posts });
      toast.success("Post updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update post"),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => deletePost(postId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.posts }); toast.success("Post deleted"); },
    onError: (e: any) => toast.error(e.message ?? "Could not delete post"),
  });
}

// ─── Withdrawal-request hooks ──────────────────────────────────────────────────

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { amount: number; method: string; accountDetails: string }) =>
      requestWithdrawal(vars.amount, vars.method, vars.accountDetails),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Withdrawal request submitted"); },
    onError: (e: any) => toast.error(e.message === "insufficient_balance" ? "Insufficient balance" : (e.message ?? "Request failed")),
  });
}

export function useWithdrawalRequests() {
  return useQuery({ queryKey: ["withdrawal_requests"], queryFn: getWithdrawalRequests });
}

export function useUserWithdrawalRequests(userId: string) {
  return useQuery({ queryKey: ["withdrawal_requests", userId], queryFn: () => getUserWithdrawalRequests(userId), enabled: !!userId });
}

export function useApproveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveWithdrawal(requestId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["withdrawal_requests"] }); qc.invalidateQueries(); toast.success("Withdrawal approved"); },
    onError: (e: any) => toast.error(e.message ?? "Approval failed"),
  });
}

export function useRejectWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { requestId: string; reason?: string }) => rejectWithdrawal(vars.requestId, vars.reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["withdrawal_requests"] }); toast.success("Request rejected"); },
    onError: (e: any) => toast.error(e.message ?? "Rejection failed"),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.notifications }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => markAllNotificationsRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.notifications }); toast.success("All caught up"); },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; action: "resolved" | "dismissed" }) => resolveReport(vars.id, vars.action),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Updated"); },
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; on: boolean }) => suspendUser(vars.id, vars.on),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Updated"); },
  });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; on: boolean }) => verifyUser(vars.id, vars.on),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Updated"); },
  });
}

export function useModeratePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; action: "approve" | "hide" | "reject" }) =>
      moderatePost(vars.id, vars.action),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Action recorded"); },
    onError: (e: Error) => { toast.error(`Moderation failed: ${e.message}`); },
  });
}

export function useEndMehfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => endMehfil(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: QK.mehfils });
      qc.invalidateQueries({ queryKey: QK.mehfil(id) });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "mehfilsByHost" });
    },
  });
}

export async function deleteMehfil(id: string): Promise<void> {
  await supabase.from("mehfils").delete().eq("id", id);
}

export async function archiveMehfil(id: string, archived: boolean): Promise<void> {
  // archived column added by migration 008; falls back to no-op if column absent
  await supabase.from("mehfils").update({ is_live: false, archived } as Record<string, unknown>).eq("id", id);
}

export function useDeleteMehfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteMehfil(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.mehfils }); qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "mehfilsByHost" }); toast.success("Mehfil deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveMehfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => archiveMehfil(id, archived),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: QK.mehfils });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "mehfilsByHost" });
      toast.success(v.archived ? "Mehfil archived" : "Mehfil restored");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreMehfilFeedVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => restoreMehfilFeedVisibility(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.mehfils });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "mehfilsByHost" });
      toast.success("Back on the Mehfil feed for 24 hours");
    },
    onError: (e: Error) => toast.error(e.message === "only_host" ? "Only the host can update this" : e.message),
  });
}

export function useStartMehfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await startMehfil(id);
      await notifyFollowersMehfilLive(id);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Mehfil started");
    },
  });
}

export function useAddPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Omit<Post, "id" | "createdAt" | "likes" | "comments" | "tipsTotal">) => addPost(post),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Published!"); },
    onError: (e: Error) => { toast.error(`Could not publish: ${e.message}`); },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { postId: string; on: boolean }) => vars.on ? savePost(vars.postId) : unsavePost(vars.postId),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<User> & { id?: string }) => updateUser(patch.id ?? getCurrentUserId(), patch),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Profile saved"); },
  });
}

export function useCreateMehfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Mehfil, "id" | "listeners" | "isLive">) => createMehfil(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.mehfils });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "mehfilsByHost" });
      toast.success("Mehfil created!");
    },
    onError: (e: Error) => { toast.error(`Could not create mehfil: ${e.message}`); },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { conversationId: string; body: string }) => sendMessage(vars.conversationId, vars.body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: QK.messages(vars.conversationId) }); qc.invalidateQueries({ queryKey: ["conversations"] }); },
  });
}

export function useRegisterUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { displayName: string; phone: string }) => registerUser(vars.displayName, vars.phone),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

export function useRegisterUserWithAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { displayName: string; language?: "or" | "hi" }) =>
      registerUserWithAuth(vars.displayName, vars.language),
    onSuccess: () => { qc.invalidateQueries(); },
    onError: (e: Error) => { toast.error(e.message); },
  });
}

// ─── Monetization & Rewards hooks ─────────────────────────────────────────────

export const useAuthorPlan = (authorId: string) => useQ(QK.authorPlan(authorId), () => getAuthorPlan(authorId));
export const useSubscriptionsOf = (userId?: string) => {
  const id = userId ?? getCurrentUserId();
  return useQ(QK.subscriptions(id), async () => {
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", id);
    return (data ?? []).map(mapSubscription);
  });
};
export const useSubscribersOf = (authorId: string) => useQ(QK.subscribersOf(authorId), () => getSubscribersOf(authorId));
export const useInkReward = (userId?: string) => {
  const id = userId ?? getCurrentUserId();
  return useQ(QK.inkReward(id), () => getInkReward(id));
};
export const useTopReaders = () => useQ(QK.topReaders, getTopReaders);

export function useSubscribeToAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (authorId: string) => subscribeToAuthor(authorId),
    onSuccess: (result) => {
      qc.invalidateQueries();
      if (result === "ok") toast.success("Subscribed! +20 Ink Points earned");
      else if (result === "already") toast.info("Already subscribed");
      else if (result === "insufficient") toast.error("Insufficient wallet balance");
      else if (result === "no-plan") toast.error("Author has no subscription plan");
    },
  });
}

export function useUnsubscribeFromAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (authorId: string) => unsubscribeFromAuthor(authorId),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Unsubscribed"); },
  });
}

export function useClaimDailyStreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => claimDailyStreak(userId),
    onSuccess: (claimed) => { qc.invalidateQueries(); if (claimed) toast.success("Daily streak claimed! +3 Ink Points"); else toast.info("Already claimed today"); },
  });
}

export function useUnlockPostWithTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { postId: string; amount: number }) => unlockPostWithTip(vars.postId, vars.amount),
    onSuccess: (result, vars) => {
      const me = getCurrentUserId() ?? "";
      if (result === "ok") {
        qc.invalidateQueries({ queryKey: ["isPostUnlocked", me, vars.postId] });
        qc.invalidateQueries({ queryKey: QK.inkReward(me) });
        qc.invalidateQueries({ queryKey: QK.post(vars.postId) });
        qc.invalidateQueries({ queryKey: QK.posts });
        qc.invalidateQueries({ queryKey: QK.trendingPosts });
        invalidateWallet(qc);
        toast.success("Post unlocked! +10 Ink Points earned");
      } else toast.error("Insufficient balance");
    },
  });
}

export function useUnlockPostWithPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => unlockPostWithPoints(postId),
    onSuccess: (result, postId) => {
      const me = getCurrentUserId() ?? "";
      if (result === "ok") {
        qc.invalidateQueries({ queryKey: ["isPostUnlocked", me, postId] });
        qc.invalidateQueries({ queryKey: QK.inkReward(me) });
        qc.invalidateQueries({ queryKey: QK.post(postId) });
        qc.invalidateQueries({ queryKey: QK.posts });
        qc.invalidateQueries({ queryKey: QK.trendingPosts });
        toast.success("Unlocked with 50 Ink Points!");
      } else toast.error("You need 50 Ink Points to unlock");
    },
  });
}

export function useUpdateAuthorPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AuthorPlan> & { authorId?: string }) => updateAuthorPlan(patch),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Subscription plan saved"); },
  });
}

export function useEarnInkPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; points: number }) => earnInkPoints(vars.userId, vars.points),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

export function useClaimDailyStreakAuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => claimDailyStreak(userId),
    onSuccess: (claimed) => { if (claimed) { qc.invalidateQueries(); toast.success("+3 Ink Points — daily streak!"); } },
  });
}

// ─── Realtime hooks ───────────────────────────────────────────────────────────

let postsRealtimeRefCount = 0;
let postsRealtimeChannel: RealtimeChannel | null = null;
const qcPostsRealtimeRef: { current: QueryClient | null } = { current: null };

export function usePostsRealtime() {
  const qc = useQueryClient();
  qcPostsRealtimeRef.current = qc;
  useEffect(() => {
    postsRealtimeRefCount++;
    if (!postsRealtimeChannel) {
      postsRealtimeChannel = supabase
        .channel("realtime:posts")
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
          qcPostsRealtimeRef.current?.invalidateQueries({ queryKey: QK.posts });
          qcPostsRealtimeRef.current?.invalidateQueries({ queryKey: QK.trendingPosts });
        })
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logOpsEvent("realtime_channel_issue", {
              channel: "realtime:posts",
              status,
              message: err?.message ?? "",
            });
          }
        });
    }
    return () => {
      postsRealtimeRefCount--;
      if (postsRealtimeRefCount <= 0 && postsRealtimeChannel) {
        supabase.removeChannel(postsRealtimeChannel);
        postsRealtimeChannel = null;
      }
    };
  }, []);
}

export function useMehfilRealtime(mehfilId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const filter = mehfilId ? `id=eq.${mehfilId}` : undefined;
    const channel = supabase
      .channel(`realtime:mehfils:${mehfilId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mehfils", filter }, () => {
        qc.invalidateQueries({ queryKey: QK.mehfils });
        if (mehfilId) qc.invalidateQueries({ queryKey: QK.mehfil(mehfilId) });
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logOpsEvent("realtime_channel_issue", {
            channel: `realtime:mehfils:${mehfilId ?? "all"}`,
            status,
            message: err?.message ?? "",
          });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [qc, mehfilId]);
}

let notifRealtimeRefCount = 0;
let notifRealtimeChannel: RealtimeChannel | null = null;
let notifRealtimeUserId: string | null = null;
const qcNotifRealtimeRef: { current: QueryClient | null } = { current: null };

export function useNotificationsRealtime() {
  const qc = useQueryClient();
  const me = getCurrentUserId();
  qcNotifRealtimeRef.current = qc;
  useEffect(() => {
    if (!me) return;
    notifRealtimeRefCount++;
    if (!notifRealtimeChannel || notifRealtimeUserId !== me) {
      if (notifRealtimeChannel) {
        supabase.removeChannel(notifRealtimeChannel);
        notifRealtimeChannel = null;
      }
      notifRealtimeUserId = me;
      notifRealtimeChannel = supabase
        .channel("realtime:notifications")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${me}` }, (payload) => {
          qcNotifRealtimeRef.current?.invalidateQueries({ queryKey: QK.notifications });
          qcNotifRealtimeRef.current?.invalidateQueries({ queryKey: [...QK.notifications, "count"] });
          const row = payload.new as { kind?: string; body?: string; target_id?: string };
          if (row?.kind === "mehfil-start" && row.body && row.target_id) {
            toast.message(row.body, {
              duration: 7200,
              action: {
                label: "Open",
                onClick: () => {
                  window.location.assign(`/mehfil/${encodeURIComponent(row.target_id!)}`);
                },
              },
            });
          }
        })
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logOpsEvent("realtime_channel_issue", {
              channel: "realtime:notifications",
              status,
              message: err?.message ?? "",
            });
          }
        });
    }
    return () => {
      notifRealtimeRefCount--;
      if (notifRealtimeRefCount <= 0 && notifRealtimeChannel) {
        supabase.removeChannel(notifRealtimeChannel);
        notifRealtimeChannel = null;
        notifRealtimeUserId = null;
      }
    };
  }, [me]);
}

let accountSyncRefCount = 0;
let accountSyncChannel: RealtimeChannel | null = null;
let accountSyncUserId: string | null = null;
const qcAccountSyncRef: { current: QueryClient | null } = { current: null };

function invalidateFollowGraphFromFollowRow(qc: QueryClient, me: string, row: Record<string, unknown>) {
  const fid = row.follower_id as string | undefined;
  const fed = row.followee_id as string | undefined;
  const other = fid === me ? fed : fed === me ? fid : undefined;
  qc.invalidateQueries({ queryKey: QK.following(me) });
  qc.invalidateQueries({ queryKey: QK.followers(me) });
  qc.invalidateQueries({ queryKey: QK.user(me) });
  if (other) {
    qc.invalidateQueries({ queryKey: QK.user(other) });
    qc.invalidateQueries({ queryKey: QK.followers(other) });
  }
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "isFollowing" && q.queryKey[1] === me });
  qc.invalidateQueries({ queryKey: QK.notifications });
  qc.invalidateQueries({ queryKey: [...QK.notifications, "count"] });
}

/** Single Supabase channel for follow edges + ink rewards affecting unlock state (deduped across mounts). */
export function useAccountSyncRealtime() {
  const qc = useQueryClient();
  const me = getCurrentUserId();
  qcAccountSyncRef.current = qc;
  useEffect(() => {
    if (!me) return;
    accountSyncRefCount++;
    if (!accountSyncChannel || accountSyncUserId !== me) {
      if (accountSyncChannel) {
        supabase.removeChannel(accountSyncChannel);
        accountSyncChannel = null;
      }
      accountSyncUserId = me;
      accountSyncChannel = supabase
        .channel(`realtime:account-sync:${me}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows", filter: `follower_id=eq.${me}` }, (payload) => {
          const qcNow = qcAccountSyncRef.current;
          if (qcNow) invalidateFollowGraphFromFollowRow(qcNow, me, (payload.new ?? {}) as Record<string, unknown>);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "follows", filter: `follower_id=eq.${me}` }, (payload) => {
          const qcNow = qcAccountSyncRef.current;
          if (qcNow) invalidateFollowGraphFromFollowRow(qcNow, me, (payload.old ?? {}) as Record<string, unknown>);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows", filter: `followee_id=eq.${me}` }, (payload) => {
          const qcNow = qcAccountSyncRef.current;
          if (qcNow) invalidateFollowGraphFromFollowRow(qcNow, me, (payload.new ?? {}) as Record<string, unknown>);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "follows", filter: `followee_id=eq.${me}` }, (payload) => {
          const qcNow = qcAccountSyncRef.current;
          if (qcNow) invalidateFollowGraphFromFollowRow(qcNow, me, (payload.old ?? {}) as Record<string, unknown>);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ink_rewards", filter: `user_id=eq.${me}` }, () => {
          qcAccountSyncRef.current?.invalidateQueries({ queryKey: QK.inkReward(me) });
          qcAccountSyncRef.current?.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "isPostUnlocked" && q.queryKey[1] === me,
          });
        })
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logOpsEvent("realtime_channel_issue", {
              channel: `realtime:account-sync:${me}`,
              status,
              message: err?.message ?? "",
            });
          }
        });
    }
    return () => {
      accountSyncRefCount--;
      if (accountSyncRefCount <= 0 && accountSyncChannel) {
        supabase.removeChannel(accountSyncChannel);
        accountSyncChannel = null;
        accountSyncUserId = null;
      }
    };
  }, [me]);
}

// ─── Admin convenience hooks ─────────────────────────────────────────────────

export const useAllUsers = () => useQ(["allUsers"] as const, getUsers);

export const useAllTransactions = () =>
  useQuery({
    queryKey: ["allTransactions"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
      return (data ?? []).map(mapTransaction);
    },
    staleTime: 30_000,
  });

export const useAllWalletBalances = () =>
  useQuery({
    queryKey: ["allWalletBalances"] as const,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase.from("wallet_balances").select("user_id, balance");
      const map: Record<string, number> = {};
      (data ?? []).forEach((row: any) => { map[row.user_id] = row.balance ?? 0; });
      return map;
    },
    staleTime: 30_000,
  });

export const useAdminPosts = () =>
  useQuery({
    queryKey: ["adminPosts"] as const,
    queryFn: async (): Promise<Post[]> => {
      const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      return (data ?? []).map(mapPost);
    },
    staleTime: 30_000,
  });

export const usePostCountsByAuthor = () =>
  useQuery({
    queryKey: ["postCountsByAuthor"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("author_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { counts[p.author_id] = (counts[p.author_id] ?? 0) + 1; });
      return counts;
    },
    staleTime: 30_000,
  });

export const useIsFollowing = (followerId: string, followeeId: string) =>
  useQ(["isFollowing", followerId, followeeId] as const, () => isFollowing(followerId, followeeId));

export const useIsSubscribedTo = (userId: string, authorId: string) =>
  useQ(["isSubscribedTo", userId, authorId] as const, () => isSubscribedTo(userId, authorId));

export const useIsPostUnlocked = (userId: string, postId: string) =>
  useQ(["isPostUnlocked", userId, postId] as const, () => isPostUnlocked(userId, postId));

// ─── Phase 1 Creator Economy ─────────────────────────────────────────────────

export type SupportActionKind = "chai" | "rose" | "applaud" | "support" | "ticket";

export type SupportAction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  postId?: string;
  mehfilId?: string;
  actionType: SupportActionKind;
  amount: number;
  createdAt: string;
};

export type QueueEntry = {
  id: string;
  mehfilId: string;
  userId: string;
  status: "pending" | "speaking" | "done" | "rejected";
  requestedAt: string;
};

export type AudioLetter = {
  id: string;
  fromUserId: string;
  toUserId: string;
  audioUrl: string;
  durationSec: number;
  body?: string;
  read: boolean;
  createdAt: string;
};

export type AdminConfig = {
  max_support_amount: number;
  daily_support_limit: number;
  max_withdrawal_limit: number;
  reader_rewards_enabled: boolean;
  mehfil_ticket_cap: number;
  /** Voice, reel video, post covers, reel posters — `audio` storage bucket */
  max_upload_audio_mb: number;
  /** Profile avatar — `avatars` storage bucket */
  max_upload_avatar_mb: number;
  /** JPEG width when generating reel cover from video frame */
  reel_poster_width_px: number;
  /** Maximum published reel clip length (trim end − start), seconds */
  reel_max_duration_sec: number;
};

const ADMIN_CONFIG_DEFAULTS: AdminConfig = {
  max_support_amount: 5,
  daily_support_limit: 25,
  max_withdrawal_limit: 500,
  reader_rewards_enabled: true,
  mehfil_ticket_cap: 5,
  max_upload_audio_mb: 100,
  max_upload_avatar_mb: 5,
  reel_poster_width_px: 720,
  reel_max_duration_sec: 120,
};

function clampAdminInt(raw: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Client-side guard before Storage upload; bucket limits must be ≥ these sizes (Supabase Dashboard). */
export function assertUploadWithinMb(byteLength: number, maxMb: number, label: string): void {
  const lim = maxMb * 1024 * 1024;
  if (byteLength <= lim) return;
  const mb = Math.round((byteLength / (1024 * 1024)) * 10) / 10;
  throw new Error(`${label} must be ${maxMb} MB or smaller (this file is ~${mb} MB)`);
}

function mapQueueEntry(r: any): QueueEntry {
  return {
    id: r.id,
    mehfilId: r.mehfil_id,
    userId: r.user_id,
    status: r.status,
    requestedAt: r.requested_at,
  };
}

function mapAudioLetter(r: any): AudioLetter {
  return {
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    audioUrl: r.audio_url,
    durationSec: r.duration_sec ?? 0,
    body: r.body ?? undefined,
    read: r.read ?? false,
    createdAt: r.created_at,
  };
}

// ── Support Actions ───────────────────────────────────────────────────────────

export async function sendSupportAction(
  toUserId: string,
  actionType: SupportActionKind,
  amount: number,
  postId?: string,
  mehfilId?: string,
): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  if (me === toUserId) throw new Error("cannot_support_yourself");
  walletLog("send_start", { to_user_id: toUserId, action_type: actionType, amount, post_id: postId ?? "", mehfil_id: mehfilId ?? "" });
  const { error } = await supabase.rpc("send_support_action", {
    p_to_user_id: toUserId,
    p_action_type: actionType,
    p_amount: amount,
    p_post_id: postId ?? null,
    p_mehfil_id: mehfilId ?? null,
  });
  if (error) {
    const msg = error.message ?? "";
    walletLog("send_failed", { message: msg });
    if (/insufficient_balance/i.test(msg)) throw new Error("insufficient_balance");
    if (/not_authenticated/i.test(msg)) throw new Error("not_authenticated");
    if (/cannot_support_yourself/i.test(msg)) throw new Error("cannot_support_yourself");
    throw new Error(msg || "support_failed");
  }
  walletLog("send_ok", { to_user_id: toUserId, action_type: actionType, amount });
  const label =
    actionType === "chai"    ? "☕ a chai"  :
    actionType === "rose"    ? "🌹 a rose"  :
    actionType === "applaud" ? "👏 applause" : "📖 support";
  insertNotif("support", me, postId ?? toUserId, toUserId, `sent you ${label} (₹${amount})`);
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const { data } = await supabase.from("admin_config").select("key, value");
  if (!data?.length) return ADMIN_CONFIG_DEFAULTS;
  const m: Record<string, string> = {};
  data.forEach((r: any) => { m[r.key] = r.value; });
  return {
    max_support_amount: Number(m.max_support_amount ?? 5),
    daily_support_limit: Number(m.daily_support_limit ?? 25),
    max_withdrawal_limit: Number(m.max_withdrawal_limit ?? 500),
    reader_rewards_enabled: m.reader_rewards_enabled !== "false",
    mehfil_ticket_cap: Number(m.mehfil_ticket_cap ?? 5),
    max_upload_audio_mb: clampAdminInt(m.max_upload_audio_mb, 1, 512, ADMIN_CONFIG_DEFAULTS.max_upload_audio_mb),
    max_upload_avatar_mb: clampAdminInt(m.max_upload_avatar_mb, 1, 50, ADMIN_CONFIG_DEFAULTS.max_upload_avatar_mb),
    reel_poster_width_px: clampAdminInt(m.reel_poster_width_px, 320, 4096, ADMIN_CONFIG_DEFAULTS.reel_poster_width_px),
    reel_max_duration_sec: clampAdminInt(m.reel_max_duration_sec, 5, 600, ADMIN_CONFIG_DEFAULTS.reel_max_duration_sec),
  };
}

export async function setAdminConfig(key: string, value: string): Promise<void> {
  const { error } = await supabase.from("admin_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ── Mehfil queue ──────────────────────────────────────────────────────────────

export async function getMehfilQueue(mehfilId: string): Promise<QueueEntry[]> {
  const { data } = await supabase.from("mehfil_queue").select("*")
    .eq("mehfil_id", mehfilId)
    .in("status", ["pending", "speaking"])
    .order("requested_at", { ascending: true });
  return (data ?? []).map(mapQueueEntry);
}

export async function raiseHand(mehfilId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("mehfil_queue")
    .delete().eq("mehfil_id", mehfilId).eq("user_id", me).eq("status", "pending");
  const { error } = await supabase.from("mehfil_queue").insert({
    id: `q${uid()}`, mehfil_id: mehfilId, user_id: me,
    status: "pending", requested_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function lowerHand(mehfilId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  await supabase.from("mehfil_queue")
    .delete().eq("mehfil_id", mehfilId).eq("user_id", me).eq("status", "pending");
}

export async function approveQueueEntry(entryId: string): Promise<void> {
  const { data: entry } = await supabase.from("mehfil_queue")
    .select("mehfil_id").eq("id", entryId).maybeSingle();
  if (entry?.mehfil_id) {
    await supabase.from("mehfil_queue")
      .update({ status: "done" }).eq("mehfil_id", entry.mehfil_id).eq("status", "speaking");
  }
  const { error } = await supabase.from("mehfil_queue")
    .update({ status: "speaking" }).eq("id", entryId);
  if (error) throw new Error(error.message);
}

export async function rejectQueueEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from("mehfil_queue")
    .update({ status: "rejected" }).eq("id", entryId);
  if (error) throw new Error(error.message);
}

export async function endSpeakerTurn(mehfilId: string): Promise<void> {
  await supabase.from("mehfil_queue")
    .update({ status: "done" }).eq("mehfil_id", mehfilId).eq("status", "speaking");
}

/** Host pulls a listener onto stage immediately (clears any prior speaker slot). */
export async function hostInviteSpeaker(mehfilId: string, targetUserId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: mf } = await supabase.from("mehfils").select("host_id").eq("id", mehfilId).maybeSingle();
  if (!mf || mf.host_id !== me) throw new Error("only_host");
  await supabase.from("mehfil_queue").delete().eq("mehfil_id", mehfilId).eq("user_id", targetUserId);
  await supabase.from("mehfil_queue")
    .update({ status: "done" }).eq("mehfil_id", mehfilId).eq("status", "speaking");
  const { error } = await supabase.from("mehfil_queue").insert({
    id: `q${uid()}`, mehfil_id: mehfilId, user_id: targetUserId,
    status: "speaking", requested_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Host removes a guest from stage / queue entirely. */
export async function hostRemoveFromStage(mehfilId: string, targetUserId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { data: mf } = await supabase.from("mehfils").select("host_id").eq("id", mehfilId).maybeSingle();
  if (!mf || mf.host_id !== me) throw new Error("only_host");
  await supabase.from("mehfil_queue").delete().eq("mehfil_id", mehfilId).eq("user_id", targetUserId);
}

// ── Audio letters ─────────────────────────────────────────────────────────────

export async function getAudioLetters(): Promise<AudioLetter[]> {
  const me = getCurrentUserId();
  if (!me) return [];
  const { data } = await supabase.from("audio_letters").select("*")
    .eq("to_user_id", me).order("created_at", { ascending: false });
  return (data ?? []).map(mapAudioLetter);
}

export async function sendAudioLetter(
  toUserId: string, audioUrl: string, durationSec: number, body?: string,
): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const now = new Date().toISOString();
  const { error } = await supabase.from("audio_letters").insert({
    id: `al${uid()}`, from_user_id: me, to_user_id: toUserId,
    audio_url: audioUrl, duration_sec: durationSec, body: body ?? null,
    read: false, created_at: now,
  });
  if (error) throw new Error(error.message);
  insertNotif("audio-letter", me, toUserId, toUserId,
    body ? `sent you a voice letter: "${body.slice(0, 50)}"` : "sent you a voice letter");
}

export async function uploadAudioLetter(userId: string, blob: Blob): Promise<string> {
  const cfg = await getAdminConfig();
  assertUploadWithinMb(blob.size, cfg.max_upload_audio_mb, "Voice letter");
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webm`;
  const path = `letters/${userId}/${filename}`;
  const { error } = await supabase.storage.from("audio")
    .upload(path, blob, { upsert: false, contentType: blob.type || "audio/webm" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}

// ── New Query hooks ───────────────────────────────────────────────────────────

export const useAdminConfig = () =>
  useQuery({ queryKey: ["adminConfig"] as const, queryFn: getAdminConfig, staleTime: 60_000 });

export const useMehfilQueue = (mehfilId: string) =>
  useQuery({
    queryKey: ["mehfilQueue", mehfilId] as const,
    queryFn: () => getMehfilQueue(mehfilId),
    enabled: !!mehfilId,
    staleTime: 0,
  });

export const useAudioLetters = () =>
  useQuery({ queryKey: ["audioLetters"] as const, queryFn: getAudioLetters, staleTime: 30_000 });

// ── New Mutation hooks ────────────────────────────────────────────────────────

export function useSendSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      toUserId: string; actionType: SupportActionKind; amount: number;
      postId?: string; mehfilId?: string;
    }) => sendSupportAction(vars.toUserId, vars.actionType, vars.amount, vars.postId, vars.mehfilId),
    onSuccess: (_d, vars) => {
      invalidateWallet(qc);
      qc.invalidateQueries({ queryKey: ["adminConfig"] }); // refresh limits
      // Earn ink for appreciating a creator
      const me = getCurrentUserId();
      if (me) earnInkPoints(me, 5).catch(console.warn);
      const label =
        vars.actionType === "chai"    ? "☕ Chai sent"     :
        vars.actionType === "rose"    ? "🌹 Rose delivered" :
        vars.actionType === "applaud" ? "👏 Applause sent"  : "📖 Support delivered";
      toast.success(`${label} · +5 ✦ Ink`, { duration: 3000 });
    },
    onError: (e: Error) => toast.error(
      e.message === "insufficient_balance" ? "Not enough balance" : (e.message ?? "Could not send")),
  });
}

export function useSetAdminConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { key: string; value: string }) => setAdminConfig(vars.key, vars.value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminConfig"] }); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRaiseHand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mehfilId: string) => raiseHand(mehfilId),
    onSuccess: (_d, mehfilId) => {
      qc.invalidateQueries({ queryKey: ["mehfilQueue", mehfilId] });
      toast.success("🙋 Hand raised — the host will invite you");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLowerHand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mehfilId: string) => lowerHand(mehfilId),
    onSuccess: (_d, mehfilId) => { qc.invalidateQueries({ queryKey: ["mehfilQueue", mehfilId] }); },
  });
}

export function useApproveQueueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => approveQueueEntry(entryId),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Speaker invited"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectQueueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => rejectQueueEntry(entryId),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

export function useEndSpeakerTurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mehfilId: string) => endSpeakerTurn(mehfilId),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Speaker turn ended"); },
  });
}

export function useHostInviteSpeaker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { mehfilId: string; userId: string }) => hostInviteSpeaker(vars.mehfilId, vars.userId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["mehfilQueue", vars.mehfilId] });
      qc.invalidateQueries({ queryKey: QK.mehfil(vars.mehfilId) });
      toast.success("On stage");
    },
    onError: (e: Error) => toast.error(e.message === "only_host" ? "Only the host can invite" : e.message),
  });
}

export function useHostRemoveFromStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { mehfilId: string; userId: string }) => hostRemoveFromStage(vars.mehfilId, vars.userId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["mehfilQueue", vars.mehfilId] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message === "only_host" ? "Only the host can remove" : e.message),
  });
}

export function useSendAudioLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { toUserId: string; audioUrl: string; durationSec: number; body?: string }) =>
      sendAudioLetter(vars.toUserId, vars.audioUrl, vars.durationSec, vars.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audioLetters"] }); toast.success("Voice letter sent"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMehfilQueueRealtime(mehfilId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!mehfilId) return;
    const channel = supabase
      .channel(`queue:${mehfilId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "mehfil_queue",
        filter: `mehfil_id=eq.${mehfilId}`,
      }, () => { qc.invalidateQueries({ queryKey: ["mehfilQueue", mehfilId] }); })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logOpsEvent("realtime_channel_issue", {
            channel: `queue:${mehfilId}`,
            status,
            message: err?.message ?? "",
          });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [qc, mehfilId]);
}

// ─── Account deactivation ─────────────────────────────────────────────────────

export async function deactivateAccount(): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ suspended: true } as Record<string, unknown>)
    .eq("id", me);
  if (error) throw error;
  await supabase.auth.signOut();
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: deactivateAccount,
    onError: (e: Error) => toast.error(e.message ?? "Could not deactivate account"),
  });
}

// ─── Handle uniqueness check ──────────────────────────────────────────────────

/** Returns true if the handle is available (no other user has it). */
export async function checkHandleAvailable(handle: string, excludeUserId: string): Promise<boolean> {
  if (!handle || handle.length < 2) return false;
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("handle", handle.toLowerCase())
    .neq("id", excludeUserId);
  return (count ?? 1) === 0;
}

// ─── Legacy stubs ─────────────────────────────────────────────────────────────

export function isSaved(_userId: string, _postId: string): boolean { return false; }
export function getFollowingIds(_userId: string): string[] { return []; }
export function getFollowerIds(_userId: string): string[] { return []; }

/** @deprecated */
function setCurrentUserId(_id: string): void {}
export const getStore = () => ({ currentUserId: getCurrentUserId() } as any);
export const initStore = () => {};
export const resetStore = () => {};
