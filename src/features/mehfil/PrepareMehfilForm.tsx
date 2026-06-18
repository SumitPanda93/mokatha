/**
 * Multi-step mehfil creation — UI from create-mehfil-ui; submits via useCreateMehfil.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { MehfilStudioPreflight } from "@/features/mehfil/MehfilStudioPreflight";
import { useMehfilMediaContext } from "@/features/mehfil/MehfilMediaContext";
import { useLocation } from "wouter";
import { useTitle } from "@/hooks/useTitle";
import { useCreateMehfil, getCurrentUserId, uploadPostCoverImage } from "@/lib/store";
import { consumeCreateDraft } from "@/lib/createDraft";
import {
  saveMehfilCreateDraft,
  readMehfilCreateDraft,
  clearMehfilCreateDraft,
  type MehfilCreateDraft,
  type MehfilEntryType,
} from "@/lib/mehfilCreateDraft";
import { deleteMehfilDraft, saveMehfilDraft } from "@/lib/mehfilDrafts";
import { validateMehfilCoverFile } from "@/lib/mehfilCoverValidation";
import type { Mehfil } from "@/lib/store";
import MehfilDraftsSheet from "@/components/mehfil/MehfilDraftsSheet";
import {
  CreateMehfilShell,
  CreateMehfilHeader,
  CreateMehfilHero,
  CreateMehfilStepper,
  CreateMehfilFooter,
  DetailsStep,
  DateTimeStep,
  SettingsStep,
  ReviewStep,
  MEHFIL_DEFAULT_COVER,
  MEHFIL_TITLE_MAX,
  MEHFIL_MAX_SPEAKERS_DEFAULT,
  type MehfilCategoryId,
} from "@/components/mehfil/create-mehfil-ui";
import { toast } from "sonner";

const STEPS = 4;

function defaultStartsAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function normalizeHighlights(highlights: string[]): string[] {
  return highlights.map((h) => h.trim()).filter(Boolean).slice(0, 3);
}

export function PrepareMehfilForm() {
  useTitle("Create Mehfil");
  const [, setLocation] = useLocation();
  const create = useCreateMehfil();
  const me = getCurrentUserId();
  const { setPreflightStream } = useMehfilMediaContext();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MehfilCategoryId>("music");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [entryType, setEntryType] = useState<MehfilEntryType>("free");
  const [ticketPrice, setTicketPrice] = useState(0);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [maxSpeakers, setMaxSpeakers] = useState(MEHFIL_MAX_SPEAKERS_DEFAULT);
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState<"voice" | "studio">("voice");
  const [startsNow, setStartsNow] = useState(true);
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [preflightMehfil, setPreflightMehfil] = useState<{ id: string; title: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [serverDraftId, setServerDraftId] = useState<string | undefined>();

  const applyDraft = useCallback((draft: MehfilCreateDraft | null) => {
    if (!draft) return;
    if (draft.step != null) setStep(Math.min(draft.step, STEPS - 1));
    if (draft.title) setTitle(draft.title);
    if (draft.description) setDescription(draft.description);
    if (draft.category) setCategory(draft.category);
    if (draft.coverUrl) setCoverUrl(draft.coverUrl);
    if (draft.coverPreview) setCoverPreview(draft.coverPreview);
    else if (draft.coverUrl) setCoverPreview(draft.coverUrl);
    if (draft.entryType) setEntryType(draft.entryType);
    if (draft.ticketPrice != null) setTicketPrice(draft.ticketPrice);
    if (draft.highlights) setHighlights(draft.highlights);
    if (draft.maxSpeakers != null) setMaxSpeakers(draft.maxSpeakers);
    if (draft.language) setLanguage(draft.language);
    if (draft.sessionMode) setSessionMode(draft.sessionMode);
    if (draft.selectedTags) setSelectedTags(draft.selectedTags);
    if (draft.startsNow != null) setStartsNow(draft.startsNow);
    if (draft.startsAt) setStartsAt(draft.startsAt);
    if (draft.serverDraftId) setServerDraftId(draft.serverDraftId);
  }, []);

  useEffect(() => {
    const hubDraft = consumeCreateDraft("live");
    if (hubDraft) {
      if (hubDraft.title) setTitle(hubDraft.title.slice(0, MEHFIL_TITLE_MAX));
      if (hubDraft.body) setDescription(hubDraft.body);
      if (hubDraft.coverUrl) {
        setCoverUrl(hubDraft.coverUrl);
        setCoverPreview(hubDraft.coverUrl);
      }
      return;
    }
    applyDraft(readMehfilCreateDraft());
  }, [applyDraft]);

  const snapshotDraft = useCallback(
    (): MehfilCreateDraft => ({
      step,
      title,
      description,
      category,
      coverUrl: coverUrl ?? undefined,
      coverPreview: coverPreview ?? undefined,
      entryType,
      ticketPrice,
      highlights,
      maxSpeakers,
      language,
      sessionMode,
      selectedTags,
      startsNow,
      startsAt,
      serverDraftId,
    }),
    [
      step,
      title,
      description,
      category,
      coverUrl,
      coverPreview,
      entryType,
      ticketPrice,
      highlights,
      maxSpeakers,
      language,
      sessionMode,
      selectedTags,
      startsNow,
      startsAt,
      serverDraftId,
    ],
  );

  const handleSaveDraft = async () => {
    if (!me) {
      toast.error("Sign in to save drafts");
      return;
    }
    setSavingDraft(true);
    const draft = snapshotDraft();
    saveMehfilCreateDraft(draft);
    try {
      const saved = await saveMehfilDraft(draft, serverDraftId, title.trim() || undefined);
      setServerDraftId(saved.id);
      toast.success("Draft saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save draft to server");
      toast.message("Draft kept locally for this session");
    } finally {
      setSavingDraft(false);
    }
  };

  const toggleMood = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) {
        toast.message("Choose up to three moods");
        return prev;
      }
      return [...prev, tag];
    });
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!me) {
      toast.error("Sign in to upload a cover");
      return;
    }

    const validation = await validateMehfilCoverFile(file);
    if (validation.ok === false) {
      toast.error(validation.message);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setCoverUploading(true);
    try {
      const url = await uploadPostCoverImage(me, file);
      setCoverUrl(url);
      setCoverPreview(url);
      toast.success("Cover added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
      setCoverPreview(null);
      setCoverUrl(null);
    } finally {
      setCoverUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const canContinue = (): boolean => {
    if (step === 0) {
      if (!title.trim()) return false;
      if (entryType === "ticket" && ticketPrice <= 0) return false;
      return true;
    }
    if (step === 1 && !startsNow) return !!startsAt;
    return true;
  };

  const handleContinue = () => {
    if (!canContinue()) {
      if (step === 0 && entryType === "ticket" && ticketPrice <= 0) {
        toast.error("Set a ticket price greater than ₹0");
      }
      return;
    }
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    submit();
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
    setLocation("/mehfil");
  };

  const submit = () => {
    if (!title.trim()) return;
    if (!me) {
      toast.error("Please sign in to host a Mehfil");
      setLocation("/auth/login");
      return;
    }
    if (entryType === "ticket" && ticketPrice <= 0) {
      toast.error("Set a ticket price greater than ₹0");
      return;
    }

    const isTicketed = entryType === "ticket";
    const payload: Omit<Mehfil, "id" | "listeners" | "isLive"> = {
      hostId: me,
      title: title.trim(),
      description,
      coverUrl: coverUrl || MEHFIL_DEFAULT_COVER,
      language,
      category,
      highlights: normalizeHighlights(highlights),
      entryType,
      tags: [...new Set(selectedTags)],
      startsAt: startsNow ? new Date().toISOString() : new Date(startsAt).toISOString(),
      sessionMode,
      isTicketed,
      ticketPrice: isTicketed ? ticketPrice : 0,
      maxSpeakers,
    };
    create.mutate(payload, {
      onSuccess: async (m) => {
        clearMehfilCreateDraft();
        if (serverDraftId) {
          try {
            await deleteMehfilDraft(serverDraftId);
          } catch {
            /* non-blocking */
          }
        }
        toast.success("Mehfil created");
        if (sessionMode === "studio") {
          setPreflightMehfil({ id: m.id, title: m.title });
        } else {
          setLocation(`/mehfil/${m.id}`);
        }
      },
      onError: (err: Error) => toast.error(`Could not create Mehfil: ${err.message}`),
    });
  };

  if (preflightMehfil) {
    return (
      <MehfilStudioPreflight
        mehfilTitle={preflightMehfil.title}
        onBack={() => setPreflightMehfil(null)}
        onEnter={(stream) => {
          setPreflightStream(stream);
          setLocation(`/mehfil/${preflightMehfil.id}`);
        }}
      />
    );
  }

  const footerLabel =
    step < STEPS - 1 ? "Continue →" : startsNow ? "Start the mehfil" : "Schedule the mehfil";

  return (
    <CreateMehfilShell>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        className="min-h-[100dvh] flex flex-col pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
        <CreateMehfilHeader
          onBack={handleBack}
          onSaveDraft={handleSaveDraft}
          onOpenDrafts={me ? () => setDraftsOpen(true) : undefined}
          savingDraft={savingDraft}
        />
        <CreateMehfilHero />
        <CreateMehfilStepper activeIndex={step} />

        <div className="flex-1 px-5 space-y-6 max-w-[480px] w-full mx-auto">
          {step === 0 && (
            <DetailsStep
              title={title}
              onTitleChange={setTitle}
              description={description}
              onDescriptionChange={setDescription}
              category={category}
              onCategoryChange={setCategory}
              coverPreview={coverPreview}
              coverUploading={coverUploading}
              onCoverSelect={() => coverInputRef.current?.click()}
              entryType={entryType}
              onEntryTypeChange={setEntryType}
              ticketPrice={ticketPrice}
              onTicketPriceChange={setTicketPrice}
              highlights={highlights}
              onHighlightsChange={setHighlights}
            />
          )}
          {step === 1 && (
            <DateTimeStep
              startsNow={startsNow}
              onStartsNowChange={setStartsNow}
              startsAt={startsAt}
              onStartsAtChange={setStartsAt}
            />
          )}
          {step === 2 && (
            <SettingsStep
              sessionMode={sessionMode}
              onSessionModeChange={setSessionMode}
              language={language}
              onLanguageChange={setLanguage}
              selectedTags={selectedTags}
              onToggleTag={toggleMood}
              maxSpeakers={maxSpeakers}
              onMaxSpeakersChange={setMaxSpeakers}
            />
          )}
          {step === 3 && (
            <ReviewStep
              title={title}
              description={description}
              category={category}
              coverPreview={coverPreview}
              entryType={entryType}
              ticketPrice={ticketPrice}
              highlights={highlights}
              startsNow={startsNow}
              startsAt={startsAt}
              sessionMode={sessionMode}
              language={language}
              selectedTags={selectedTags}
              maxSpeakers={maxSpeakers}
            />
          )}
        </div>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverSelect}
        />

        <CreateMehfilFooter
          type={step === STEPS - 1 ? "submit" : "button"}
          label={footerLabel}
          disabled={!canContinue()}
          loading={create.isPending}
          onClick={step < STEPS - 1 ? handleContinue : undefined}
        />
      </form>

      <MehfilDraftsSheet
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        onLoad={applyDraft}
        onSaveCurrent={handleSaveDraft}
        saving={savingDraft}
      />
    </CreateMehfilShell>
  );
}
