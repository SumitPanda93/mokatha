import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MehfilCreateDraft } from "@/lib/mehfilCreateDraft";

const mockGetCurrentUserId = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/store", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("mehfilDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockReturnValue("user-1");
  });

  it("saveMehfilDraft upserts payload with user id", async () => {
    const draft: MehfilCreateDraft = {
      title: "Test mehfil",
      entryType: "tip",
      highlights: ["Poetry night"],
    };
    const row = {
      id: "mdtest1",
      user_id: "user-1",
      title: "Test mehfil",
      payload: draft,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ upsert });

    const { saveMehfilDraft } = await import("@/lib/mehfilDrafts");
    const saved = await saveMehfilDraft(draft, "mdtest1");

    expect(mockFrom).toHaveBeenCalledWith("mehfil_drafts");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mdtest1",
        user_id: "user-1",
        payload: draft,
      }),
      { onConflict: "id" },
    );
    expect(saved.id).toBe("mdtest1");
    expect(saved.payload.entryType).toBe("tip");
  });

  it("getMehfilDraftById returns null when not found", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockFrom.mockReturnValue({ select });

    const { getMehfilDraftById } = await import("@/lib/mehfilDrafts");
    const result = await getMehfilDraftById("missing");
    expect(result).toBeNull();
  });
});
