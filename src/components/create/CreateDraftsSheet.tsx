import { useState } from "react";
import { Trash2, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeletePostDraft, usePostDrafts } from "@/lib/postDrafts";
import type { CreateDraft } from "@/lib/createDraft";
import { FEED_BORDER, FEED_CARD, FEED_GOLD, FEED_MUTED, FEED_TEXT } from "@/components/feed/home-feed-ui";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (draft: CreateDraft, draftId: string) => void;
  onSaveCurrent: () => void;
  saving?: boolean;
};

export default function CreateDraftsSheet({ open, onOpenChange, onLoad, onSaveCurrent, saving }: Props) {
  const { data: drafts = [], isLoading } = usePostDrafts();
  const del = useDeletePostDraft();

  const handleDelete = (id: string) => {
    del.mutate(id, {
      onSuccess: () => toast.success("Draft deleted"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[75vh] overflow-y-auto" style={{ background: "#0A0806", color: FEED_TEXT, borderColor: FEED_BORDER }}>
        <SheetHeader>
          <SheetTitle className="font-['Playfair_Display'] text-left" style={{ color: FEED_TEXT }}>Drafts</SheetTitle>
        </SheetHeader>
        <button type="button" disabled={saving} onClick={onSaveCurrent}
          className="w-full mt-4 py-3 rounded-xl text-[13px] font-['Inter'] font-medium disabled:opacity-50"
          style={{ background: "rgba(201,168,76,0.12)", border: `1px solid rgba(201,168,76,0.35)`, color: FEED_GOLD }}>
          {saving ? "Saving…" : "Save current as draft"}
        </button>
        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-[12px]" style={{ color: FEED_MUTED }}>Loading…</p>}
          {!isLoading && drafts.length === 0 && (
            <p className="text-[12px] py-6 text-center" style={{ color: FEED_MUTED }}>No saved drafts yet</p>
          )}
          {drafts.map((d) => (
            <div key={d.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: FEED_CARD, border: `1px solid ${FEED_BORDER}` }}>
              <button type="button" className="flex-1 text-left min-w-0" onClick={() => { onLoad(d.payload, d.id); onOpenChange(false); }}>
                <div className="text-[13px] font-['Inter'] font-medium truncate">{d.title || "Untitled"}</div>
                <div className="text-[10px] mt-0.5 capitalize" style={{ color: FEED_MUTED }}>
                  {d.payload.postType} · {new Date(d.updatedAt).toLocaleDateString()}
                </div>
                {d.payload.scheduledAt && (
                  <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: FEED_GOLD }}>
                    <Clock size={10} /> Scheduled
                  </div>
                )}
              </button>
              <button type="button" onClick={() => handleDelete(d.id)} className="p-2 shrink-0" style={{ color: FEED_MUTED }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
