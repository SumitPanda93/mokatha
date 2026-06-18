import { describe, expect, it } from "vitest";
import {
  MEHFIL_COVER_ASPECT,
  MEHFIL_COVER_ASPECT_TOLERANCE,
  validateMehfilCoverAspect,
  validateMehfilCoverSize,
} from "@/lib/mehfilCoverValidation";

describe("validateMehfilCoverSize", () => {
  it("rejects non-image files", () => {
    const file = new File(["x"], "doc.txt", { type: "text/plain" });
    const result = validateMehfilCoverSize(file);
    expect(result?.reason).toBe("not_image");
  });

  it("rejects files over 5MB", () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    const result = validateMehfilCoverSize(file);
    expect(result?.reason).toBe("too_large");
  });

  it("accepts valid image under limit", () => {
    const file = new File([new Uint8Array(1024)], "ok.jpg", { type: "image/jpeg" });
    expect(validateMehfilCoverSize(file)).toBeNull();
  });
});

describe("validateMehfilCoverAspect", () => {
  it("accepts exact 16:9", () => {
    const result = validateMehfilCoverAspect(1920, 1080);
    expect(result.ok).toBe(true);
  });

  it("accepts within tolerance", () => {
    const w = 1600;
    const h = Math.round(w / MEHFIL_COVER_ASPECT);
    const result = validateMehfilCoverAspect(w, h);
    expect(result.ok).toBe(true);
  });

  it("rejects 4:3 aspect", () => {
    const result = validateMehfilCoverAspect(1600, 1200);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe("bad_aspect");
  });

  it("uses configured tolerance", () => {
    const ratio = MEHFIL_COVER_ASPECT + MEHFIL_COVER_ASPECT_TOLERANCE + 0.01;
    const result = validateMehfilCoverAspect(Math.round(1000 * ratio), 1000);
    expect(result.ok).toBe(false);
  });
});

describe("MehfilCreateDraft serialization", () => {
  it("round-trips draft fields through JSON", () => {
    const draft = {
      step: 2,
      title: "Evening ghazal",
      category: "music" as const,
      entryType: "ticket" as const,
      ticketPrice: 149,
      highlights: ["Live tabla", "Open requests"],
      maxSpeakers: 8,
      serverDraftId: "mdabc123",
    };
    const parsed = JSON.parse(JSON.stringify(draft));
    expect(parsed).toEqual(draft);
  });
});
