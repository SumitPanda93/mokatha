/** Session-scoped draft for multi-step mehfil creation; also stored in mehfil_drafts when saved. */
export type MehfilEntryType = "free" | "tip" | "ticket";

export type MehfilCategoryId = "music" | "spiritual" | "talks" | "open-mic";

export type MehfilCreateDraft = {
  step?: number;
  title?: string;
  description?: string;
  category?: MehfilCategoryId;
  coverUrl?: string;
  coverPreview?: string;
  entryType?: MehfilEntryType;
  ticketPrice?: number;
  highlights?: string[];
  maxSpeakers?: number;
  language?: "or" | "hi";
  sessionMode?: "voice" | "studio";
  selectedTags?: string[];
  startsNow?: boolean;
  startsAt?: string;
  /** Server draft row id when loaded from mehfil_drafts */
  serverDraftId?: string;
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
