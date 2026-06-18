export const MEHFIL_COVER_ASPECT = 16 / 9;
export const MEHFIL_COVER_ASPECT_TOLERANCE = 0.02;
export const MEHFIL_COVER_MAX_BYTES = 5 * 1024 * 1024;

export type MehfilCoverValidationError = {
  ok: false;
  reason: "not_image" | "too_large" | "bad_aspect" | "unreadable";
  message: string;
};

export type MehfilCoverValidationSuccess = {
  ok: true;
  width: number;
  height: number;
};

export type MehfilCoverValidationResult = MehfilCoverValidationSuccess | MehfilCoverValidationError;

export function validateMehfilCoverSize(
  file: File,
  maxBytes = MEHFIL_COVER_MAX_BYTES,
): MehfilCoverValidationError | null {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "not_image", message: "Please choose an image file (JPEG, PNG, or WebP)" };
  }
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, reason: "too_large", message: `Cover image must be under ${maxMb}MB` };
  }
  return null;
}

export function validateMehfilCoverAspect(
  width: number,
  height: number,
  tolerance = MEHFIL_COVER_ASPECT_TOLERANCE,
): MehfilCoverValidationResult {
  if (width <= 0 || height <= 0) {
    return { ok: false, reason: "unreadable", message: "Could not read image dimensions" };
  }
  const ratio = width / height;
  if (Math.abs(ratio - MEHFIL_COVER_ASPECT) > tolerance) {
    return {
      ok: false,
      reason: "bad_aspect",
      message: "Cover must be 16:9 aspect ratio (e.g. 1920×1080)",
    };
  }
  return { ok: true, width, height };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export async function validateMehfilCoverFile(file: File): Promise<MehfilCoverValidationResult> {
  const sizeError = validateMehfilCoverSize(file);
  if (sizeError) return sizeError;
  try {
    const img = await loadImageFromFile(file);
    return validateMehfilCoverAspect(img.naturalWidth, img.naturalHeight);
  } catch {
    return { ok: false, reason: "unreadable", message: "Could not read image" };
  }
}
