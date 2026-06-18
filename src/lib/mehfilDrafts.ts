import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/store";
import type { MehfilCreateDraft } from "@/lib/mehfilCreateDraft";

export type MehfilDraftRow = {
  id: string;
  userId: string;
  title: string | null;
  payload: MehfilCreateDraft;
  createdAt: string;
  updatedAt: string;
};

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function mapDraftRow(r: Record<string, unknown>): MehfilDraftRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: (r.title as string | null) ?? null,
    payload: (r.payload ?? {}) as MehfilCreateDraft,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export const QK_MEHFIL_DRAFTS = ["mehfilDrafts"] as const;

export async function getMehfilDrafts(): Promise<MehfilDraftRow[]> {
  const me = getCurrentUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("mehfil_drafts")
    .select("*")
    .eq("user_id", me)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapDraftRow(r as Record<string, unknown>));
}

export async function getMehfilDraftById(draftId: string): Promise<MehfilDraftRow | null> {
  const me = getCurrentUserId();
  if (!me) return null;
  const { data, error } = await supabase
    .from("mehfil_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", me)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDraftRow(data as Record<string, unknown>) : null;
}

export async function saveMehfilDraft(
  draft: MehfilCreateDraft,
  draftId?: string,
  title?: string,
): Promise<MehfilDraftRow> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const id = draftId ?? `md${uid()}`;
  const row = {
    id,
    user_id: me,
    title: title ?? draft.title?.slice(0, 60) ?? "Untitled mehfil draft",
    payload: draft,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("mehfil_drafts")
    .upsert(row, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "save_failed");
  return mapDraftRow(data as Record<string, unknown>);
}

export async function deleteMehfilDraft(draftId: string): Promise<void> {
  const me = getCurrentUserId();
  if (!me) throw new Error("not_authenticated");
  const { error } = await supabase.from("mehfil_drafts").delete().eq("id", draftId).eq("user_id", me);
  if (error) throw new Error(error.message);
}

export function useMehfilDrafts() {
  const me = getCurrentUserId();
  return useQuery({
    queryKey: QK_MEHFIL_DRAFTS,
    queryFn: getMehfilDrafts,
    enabled: !!me,
    staleTime: 10_000,
  });
}

export function useSaveMehfilDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { draft: MehfilCreateDraft; draftId?: string; title?: string }) =>
      saveMehfilDraft(vars.draft, vars.draftId, vars.title),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_MEHFIL_DRAFTS }),
  });
}

export function useDeleteMehfilDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMehfilDraft,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_MEHFIL_DRAFTS }),
  });
}
