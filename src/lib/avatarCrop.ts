export type AvatarFrame = "original" | "square" | "portrait" | "landscape";

export const AVATAR_FRAME_LABELS: Record<AvatarFrame, string> = {
  original: "Original",
  square: "Square",
  portrait: "3:4",
  landscape: "4:3",
};

/** Crop aspect ratio (width / height). `null` = fit entire image inside viewport (contain). */
export function frameAspect(frame: AvatarFrame): number | null {
  switch (frame) {
    case "square":
      return 1;
    case "portrait":
      return 3 / 4;
    case "landscape":
      return 4 / 3;
    default:
      return null;
  }
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
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

export type CropTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

/** Fit image in viewport (contain) — used for Original frame initial placement. */
export function fitContain(
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number,
): CropTransform {
  const scale = Math.min(viewW / imgW, viewH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return {
    scale,
    offsetX: (viewW - drawW) / 2,
    offsetY: (viewH - drawH) / 2,
  };
}

/** Cover viewport with image — used for fixed-aspect frames. */
export function fitCover(
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number,
): CropTransform {
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return {
    scale,
    offsetX: (viewW - drawW) / 2,
    offsetY: (viewH - drawH) / 2,
  };
}

export function clampPan(
  transform: CropTransform,
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number,
): CropTransform {
  const drawW = imgW * transform.scale;
  const drawH = imgH * transform.scale;
  const minX = Math.min(0, viewW - drawW);
  const minY = Math.min(0, viewH - drawH);
  const maxX = Math.max(0, viewW - drawW);
  const maxY = Math.max(0, viewH - drawH);
  return {
    scale: transform.scale,
    offsetX: Math.min(maxX, Math.max(minX, transform.offsetX)),
    offsetY: Math.min(maxY, Math.max(minY, transform.offsetY)),
  };
}

export function viewportSize(
  frame: AvatarFrame,
  outer: number,
): { width: number; height: number } {
  const aspect = frameAspect(frame);
  if (aspect == null) return { width: outer, height: outer };
  if (aspect >= 1) {
    const w = outer;
    return { width: w, height: w / aspect };
  }
  const h = outer;
  return { width: h * aspect, height: h };
}

const OUTPUT_SIZE = 512;

/**
 * Renders the cropped avatar to a square JPEG blob (circular mask applied in UI only;
 * output is square for storage and `border-radius` display).
 */
export async function cropAvatarToBlob(
  image: HTMLImageElement,
  _frame: AvatarFrame,
  transform: CropTransform,
  viewW: number,
  viewH: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const fit = OUTPUT_SIZE / Math.max(viewW, viewH);
  const vpW = viewW * fit;
  const vpH = viewH * fit;
  const vpX = (OUTPUT_SIZE - vpW) / 2;
  const vpY = (OUTPUT_SIZE - vpH) / 2;

  ctx.fillStyle = "#0A0806";
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(vpX, vpY);
  const drawW = image.naturalWidth * transform.scale * fit;
  const drawH = image.naturalHeight * transform.scale * fit;
  ctx.drawImage(
    image,
    transform.offsetX * fit,
    transform.offsetY * fit,
    drawW,
    drawH,
  );
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/jpeg",
      0.92,
    );
  });
}
