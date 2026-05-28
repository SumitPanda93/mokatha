import type { CSSProperties } from "react";
import type { PostBackgroundTheme } from "@/lib/postThemes";

export type CreatePostType = "voice" | "live" | "video" | "text";

export type CreateVisibility = "public" | "followers" | "private";

export type CreateLocation = {
  name: string;
  lat?: number;
  lng?: number;
};

export type CreatePollDraft = {
  question: string;
  options: string[];
};

export type CreateDraft = {
  postType: CreatePostType;
  title?: string;
  body?: string;
  accessType?: "free" | "tip";
  minTip?: number;
  visibility?: CreateVisibility;
  isPrivate?: boolean;
  coverUrl?: string;
  scheduledAt?: string;
  backgroundTheme?: PostBackgroundTheme;
  location?: CreateLocation;
  taggedUserIds?: string[];
  poll?: CreatePollDraft;
  /** In-hub voice recording URL */
  audioUrl?: string;
  audioDurationSec?: number;
  /** In-hub video recording URL */
  videoUrl?: string;
};

const DRAFT_KEY = "mk-create-draft";

export function saveCreateDraft(draft: CreateDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

export function readCreateDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CreateDraft;
  } catch {
    return null;
  }
}

export function clearCreateDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeCreateDraft(expected?: CreatePostType): CreateDraft | null {
  const draft = readCreateDraft();
  if (!draft) return null;
  if (expected && draft.postType !== expected) return null;
  clearCreateDraft();
  return draft;
}

/** Preview card background from theme key */
export function draftThemeStyle(theme?: PostBackgroundTheme): CSSProperties {
  const map: Record<string, CSSProperties> = {
    cream: { background: "#F5F3EF" },
    sand: { background: "linear-gradient(135deg,#EFE6D6,#E8DDC9)" },
    lavender: { background: "linear-gradient(135deg,#EDE7F6,#D6CDE8)" },
    wine: { background: "linear-gradient(135deg,#1A0F14,#3B1A1F)" },
    midnight: { background: "linear-gradient(135deg,#0E0717,#1A0F2E)" },
    gold: { background: "linear-gradient(135deg,#1C0F06,#2E1A0C)" },
    forest: { background: "linear-gradient(135deg,#0F1A12,#1A2E1F)" },
  };
  return map[theme ?? ""] ?? { background: "rgba(255,255,255,0.04)" };
}
