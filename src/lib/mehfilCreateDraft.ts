/** Session-scoped draft for multi-step mehfil creation (not persisted to Supabase). */
export type MehfilEntryType = "free" | "tip";

export type MehfilCreateDraft = {
  step?: number;
  title?: string;
  description?: string;
  category?: "music" | "spiritual" | "talks" | "open-mic";
  coverUrl?: string;
  coverPreview?: string;
  entryType?: MehfilEntryType;
  highlights?: string[];
  language?: "or" | "hi";
  sessionMode?: "voice" | "studio";
  selectedTags?: string[];
  startsNow?: boolean;
  startsAt?: string;
};

const DRAFT_KEY = "mk-mehfil-create-draft";

export function saveMehfilCreateDraft(draft: MehfilCreateDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

export function readMehfilCreateDraft(): MehfilCreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MehfilCreateDraft;
  } catch {
    return null;
  }
}

export function clearMehfilCreateDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
