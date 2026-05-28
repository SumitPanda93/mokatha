import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/store";
import type { CreateDraft } from "@/lib/createDraft";

export type PostDraftRow = {
  id: string;
  userId: string;
  title: string | null;
  payload: CreateDraft;
  createdAt: string;
  updatedAt: string;
};

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function mapDraftRow(r: Record<string, unknown>): PostDraftRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: (r.title as string | null) ?? null,
    payload: (r.payload ?? {}) as CreateDraft,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export const QK_POST_DRAFTS = ["postDrafts"] as const;

export async function listPostDrafts(): Promise<PostDraftRow[]> {
  const me = getCurrentUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("post_drafts")
    .select("*")
    .eq("user_id", me)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapDraftRow(r as Record<string, unknown>));
}

export async function savePostDraft(draft: CreateDraft, draftId?: string, title?: string): Promise<PostDraftRow> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const id = draftId ?? `pd${uid()}`;
  const row = {
    id,
    user_id: me,
    title: title ?? draft.title ?? draft.body?.slice(0, 60) ?? "Untitled draft",
    payload: draft,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("post_drafts")
    .upsert(row, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "save_failed");
  return mapDraftRow(data as Record<string, unknown>);
}

export async function deletePostDraft(draftId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { error } = await supabase.from("post_drafts").delete().eq("id", draftId).eq("user_id", me);
  if (error) throw new Error(error.message);
}

export function usePostDrafts() {
  const me = getCurrentUserId();
  return useQuery({
    queryKey: QK_POST_DRAFTS,
    queryFn: listPostDrafts,
    enabled: !!me,
    staleTime: 10_000,
  });
}

export function useSavePostDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { draft: CreateDraft; draftId?: string; title?: string }) =>
      savePostDraft(vars.draft, vars.draftId, vars.title),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_POST_DRAFTS }),
  });
}

export function useDeletePostDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePostDraft,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_POST_DRAFTS }),
  });
}
