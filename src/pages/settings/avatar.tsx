import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, Loader2, Move } from "lucide-react";
import { useTitle } from "@/hooks/useTitle";
import {
  useCurrentUser,
  uploadAvatar,
  updateUser,
  getCurrentUserId,
} from "@/lib/store";
import {
  type AvatarFrame,
  AVATAR_FRAME_LABELS,
  cropAvatarToBlob,
  clampPan,
  fitContain,
  fitCover,
  frameAspect,
  loadImageFromFile,
  loadImageFromUrl,
  viewportSize,
  type CropTransform,
} from "@/lib/avatarCrop";
import {
  SettingsShell,
  SETTINGS_BG,
  SETTINGS_GOLD,
  SETTINGS_MUTED,
  SETTINGS_BORDER,
  SETTINGS_CARD,
} from "./settings-ui";
import { toast } from "sonner";

const PREVIEW_OUTER = 280;
const GRADIENT_RING =
  "linear-gradient(135deg, #A855F7 0%, #EC4899 35%, #F97316 70%, #EAB308 100%)";

function parseReturnPath(search: string): string {
  const q = new URLSearchParams(search);
  const ret = q.get("return");
  if (ret && ret.startsWith("/settings")) return ret;
  return "/settings";
}

export default function AvatarEditor() {
  useTitle("Profile");
  const [pathname, setLocation] = useLocation();
  const returnTo = useMemo(
    () => parseReturnPath(typeof window !== "undefined" ? window.location.search : ""),
    [pathname],
  );
  const { data: user, refetch } = useCurrentUser();

  const [frame, setFrame] = useState<AvatarFrame>("original");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [transform, setTransform] = useState<CropTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const view = viewportSize(frame, PREVIEW_OUTER - 8);
  const applyFrameFit = useCallback(
    (img: HTMLImageElement, nextFrame: AvatarFrame) => {
      const v = viewportSize(nextFrame, PREVIEW_OUTER - 8);
      const aspect = frameAspect(nextFrame);
      const t =
        aspect == null
          ? fitContain(img.naturalWidth, img.naturalHeight, v.width, v.height)
          : fitCover(img.naturalWidth, img.naturalHeight, v.width, v.height);
      setTransform(t);
    },
    [],
  );

  useEffect(() => {
    if (!user?.avatarUrl || image) return;
    let cancelled = false;
    setLoadingImage(true);
    loadImageFromUrl(user.avatarUrl)
      .then((img) => {
        if (cancelled) return;
        setImage(img);
        setImageSrc(user.avatarUrl);
        applyFrameFit(img, "original");
      })
      .catch(() => {
        /* no existing avatar or CORS — user picks a new photo */
      })
      .finally(() => {
        if (!cancelled) setLoadingImage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.avatarUrl, image, applyFrameFit]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const onFrameChange = (next: AvatarFrame) => {
    setFrame(next);
    if (image) applyFrameFit(image, next);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setLoadingImage(true);
    try {
      const img = await loadImageFromFile(file);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(file);
      blobUrlRef.current = url;
      setImage(img);
      setImageSrc(url);
      applyFrameFit(img, frame);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load image");
    } finally {
      setLoadingImage(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: transform.offsetX,
      oy: transform.offsetY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current || !image) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const v = viewportSize(frame, PREVIEW_OUTER - 8);
    setTransform((prev) =>
      clampPan(
        {
          ...prev,
          offsetX: dragStart.current!.ox + dx,
          offsetY: dragStart.current!.oy + dy,
        },
        image.naturalWidth,
        image.naturalHeight,
        v.width,
        v.height,
      ),
    );
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    dragStart.current = null;
  };

  const save = async () => {
    const me = getCurrentUserId();
    if (!me) {
      toast.error("Sign in to save your photo");
      return;
    }
    if (!image) {
      toast.error("Choose a photo first");
      fileInputRef.current?.click();
      return;
    }
    const v = viewportSize(frame, PREVIEW_OUTER - 8);
    setSaving(true);
    try {
      const blob = await cropAvatarToBlob(image, frame, transform, v.width, v.height);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(me, file);
      await updateUser(me, { avatarUrl: url });
      await refetch();
      toast.success("Photo updated");
      setLocation(returnTo);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SettingsShell>
        <div className="p-10 text-center font-['Inter']" style={{ color: SETTINGS_MUTED }}>
          Sign in to edit your profile photo.
        </div>
      </SettingsShell>
    );
  }

  const drawW = image ? image.naturalWidth * transform.scale : 0;
  const drawH = image ? image.naturalHeight * transform.scale : 0;

  return (
    <SettingsShell>
      <div className="min-h-screen flex flex-col pb-8" style={{ background: SETTINGS_BG }}>
        {/* Header */}
        <div
          className="sticky top-0 z-20 px-5 py-3 flex items-center justify-between"
          style={{ background: "rgba(10,8,6,0.9)", backdropFilter: "blur(16px)" }}
        >
          <button
            type="button"
            onClick={() => setLocation(returnTo)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ border: `1px solid ${SETTINGS_BORDER}`, background: SETTINGS_CARD }}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="font-['Playfair_Display'] text-[20px]">Profile</div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !image}
            className="text-[12px] font-['Inter'] font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 disabled:opacity-45"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8B14A)",
              color: "#0A0806",
            }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={2.5} />}
            Save
          </button>
        </div>

        {/* Crop preview */}
        <div className="flex-1 flex flex-col items-center px-5 pt-6">
          <div
            className="relative rounded-full p-[3px] shrink-0"
            style={{
              width: PREVIEW_OUTER,
              height: PREVIEW_OUTER,
              background: GRADIENT_RING,
              boxShadow: "0 0 48px rgba(168,85,247,0.22), 0 0 32px rgba(249,115,22,0.12)",
            }}
          >
            <div
              className="w-full h-full rounded-full overflow-hidden relative flex items-center justify-center"
              style={{ background: SETTINGS_BG }}
            >
              <div
                className="absolute overflow-hidden rounded-full"
                style={{
                  width: PREVIEW_OUTER - 8,
                  height: PREVIEW_OUTER - 8,
                  touchAction: "none",
                  cursor: image ? (dragging ? "grabbing" : "grab") : "default",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {loadingImage && !image && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={28} className="animate-spin" style={{ color: SETTINGS_GOLD }} />
                  </div>
                )}
                {!loadingImage && !image && (
                  <div className="absolute inset-0 flex items-center justify-center text-[13px] font-['Inter'] text-center px-6" style={{ color: SETTINGS_MUTED }}>
                    Tap the camera to choose a photo
                  </div>
                )}
                {image && imageSrc && (
                  <div
                    className="absolute overflow-hidden"
                    style={{
                      width: view.width,
                      height: view.height,
                      left: (PREVIEW_OUTER - 8 - view.width) / 2,
                      top: (PREVIEW_OUTER - 8 - view.height) / 2,
                    }}
                  >
                    <img
                      src={imageSrc}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none select-none pointer-events-none"
                      style={{
                        width: drawW,
                        height: drawH,
                        left: transform.offsetX,
                        top: transform.offsetY,
                      }}
                    />
                  </div>
                )}
                {image && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ opacity: dragging ? 0.3 : 0.5 }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: view.width,
                        height: view.height,
                        border: "1px dashed rgba(245,243,239,0.28)",
                        borderRadius: frame === "original" ? "50%" : 6,
                      }}
                    >
                      <Move size={22} style={{ color: "rgba(245,243,239,0.5)" }} strokeWidth={1.5} />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #C9A84C, #E8B14A)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                }}
                aria-label="Change photo"
              >
                <Camera size={16} className="text-[#0A0806]" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <p
            className="text-[11px] font-['Inter'] text-center mt-4 max-w-[280px] leading-relaxed"
            style={{ color: SETTINGS_MUTED }}
          >
            Drag to adjust • Tap camera to change photo
          </p>
        </div>

        {/* Frame picker */}
        <div
          className="mx-5 mt-auto rounded-2xl px-4 py-4"
          style={{ background: SETTINGS_CARD, border: `1px solid ${SETTINGS_BORDER}` }}
        >
          <div
            className="text-[10px] font-['Inter'] uppercase tracking-[0.2em] mb-3"
            style={{ color: SETTINGS_GOLD }}
          >
            Choose frame
          </div>
          <div className="flex gap-2">
            {(Object.keys(AVATAR_FRAME_LABELS) as AvatarFrame[]).map((key) => {
              const selected = frame === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFrameChange(key)}
                  className="flex-1 py-2.5 rounded-xl text-[11px] font-['Inter'] font-medium transition-colors"
                  style={
                    selected
                      ? {
                          background: "rgba(201,168,76,0.18)",
                          color: SETTINGS_GOLD,
                          border: "1px solid rgba(201,168,76,0.45)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: SETTINGS_MUTED,
                          border: `1px solid ${SETTINGS_BORDER}`,
                        }
                  }
                >
                  {AVATAR_FRAME_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </SettingsShell>
  );
}
