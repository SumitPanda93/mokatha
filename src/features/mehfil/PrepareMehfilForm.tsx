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
  type MehfilEntryType,
} from "@/lib/mehfilCreateDraft";
import type { Mehfil } from "@/lib/store";
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
  MEHFIL_COVER_MAX_MB,
  MEHFIL_TITLE_MAX,
  CATEGORY_TO_TAG,
  type MehfilCategoryId,
} from "@/components/mehfil/create-mehfil-ui";
import { toast } from "sonner";

const STEPS = 4;

function defaultStartsAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function buildTags(category: MehfilCategoryId, selectedTags: string[]): string[] {
  const catTag = CATEGORY_TO_TAG[category];
  const merged = [catTag, ...selectedTags.filter((t) => t !== catTag)];
  return [...new Set(merged)];
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
  const [highlights, setHighlights] = useState<string[]>([]);
  const [language, setLanguage] = useState<"or" | "hi">("or");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState<"voice" | "studio">("voice");
  const [startsNow, setStartsNow] = useState(true);
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [preflightMehfil, setPreflightMehfil] = useState<{ id: string; title: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const applyDraft = useCallback((draft: ReturnType<typeof readMehfilCreateDraft>) => {
    if (!draft) return;
    if (draft.step != null) setStep(Math.min(draft.step, STEPS - 1));
    if (draft.title) setTitle(draft.title);
    if (draft.description) setDescription(draft.description);
    if (draft.category) setCategory(draft.category);
    if (draft.coverUrl) setCoverUrl(draft.coverUrl);
    if (draft.coverPreview) setCoverPreview(draft.coverPreview);
    else if (draft.coverUrl) setCoverPreview(draft.coverUrl);
    if (draft.entryType) setEntryType(draft.entryType);
    if (draft.highlights) setHighlights(draft.highlights);
    if (draft.language) setLanguage(draft.language);
    if (draft.sessionMode) setSessionMode(draft.sessionMode);
    if (draft.selectedTags) setSelectedTags(draft.selectedTags);
    if (draft.startsNow != null) setStartsNow(draft.startsNow);
    if (draft.startsAt) setStartsAt(draft.startsAt);
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
    () => ({
      step,
      title,
      description,
      category,
      coverUrl: coverUrl ?? undefined,
      coverPreview: coverPreview ?? undefined,
      entryType,
      highlights,
      language,
      sessionMode,
      selectedTags,
      startsNow,
      startsAt,
    }),
    [
      step,
      title,
      description,
      category,
      coverUrl,
      coverPreview,
      entryType,
      highlights,
      language,
      sessionMode,
      selectedTags,
      startsNow,
      startsAt,
    ],
  );

  const handleSaveDraft = () => {
    if (!me) {
      toast.error("Sign in to save drafts");
      return;
    }
    setSavingDraft(true);
    saveMehfilCreateDraft(snapshotDraft());
    setSavingDraft(false);
    toast.success("Draft saved");
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MEHFIL_COVER_MAX_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MEHFIL_COVER_MAX_MB}MB`);
      return;
    }
    if (!me) {
      toast.error("Sign in to upload a cover");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setCoverUploading(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not read image"));
        el.src = localUrl;
      });
      const ratio = img.naturalWidth / img.naturalHeight;
      const target = 16 / 9;
      if (Math.abs(ratio - target) > 0.08) {
        toast.message("Tip: 16:9 images look best as cover art");
      }
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
    if (step === 0) return title.trim().length > 0;
    if (step === 1 && !startsNow) return !!startsAt;
    return true;
  };

  const handleContinue = () => {
    if (!canContinue()) return;
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
    const payload: Omit<Mehfil, "id" | "listeners" | "isLive"> = {
      hostId: me,
      title: title.trim(),
      description,
      coverUrl: coverUrl || MEHFIL_DEFAULT_COVER,
      language,
      tags: buildTags(category, selectedTags),
      startsAt: startsNow ? new Date().toISOString() : new Date(startsAt).toISOString(),
      sessionMode,
      isTicketed: false,
      ticketPrice: 0,
    };
    create.mutate(payload, {
      onSuccess: (m) => {
        clearMehfilCreateDraft();
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
        <CreateMehfilHeader onBack={handleBack} onSaveDraft={handleSaveDraft} savingDraft={savingDraft} />
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
            />
          )}
          {step === 3 && (
            <ReviewStep
              title={title}
              description={description}
              category={category}
              coverPreview={coverPreview}
              entryType={entryType}
              highlights={highlights}
              startsNow={startsNow}
              startsAt={startsAt}
              sessionMode={sessionMode}
              language={language}
              selectedTags={selectedTags}
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
    </CreateMehfilShell>
  );
}
