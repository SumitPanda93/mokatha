export type CreatePostType = "voice" | "live" | "video" | "text";

export type CreateVisibility = "public" | "followers" | "private";

export type CreateDraft = {
  postType: CreatePostType;
  title?: string;
  body?: string;
  accessType?: "free" | "tip";
  minTip?: number;
  visibility?: CreateVisibility;
  isPrivate?: boolean;
  coverUrl?: string;
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
