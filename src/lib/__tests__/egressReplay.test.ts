import { describe, expect, it } from "vitest";
import { egressLooksFailed, firstOutputLocation, normalizeRecordingUrl } from "@/lib/egressReplay";

describe("egressReplay helpers", () => {
  it("reads deprecated result.file location when fileResults is empty", () => {
    const info = {
      fileResults: [],
      result: {
        case: "file",
        value: {
          location: "https://bucket.s3.amazonaws.com/mehfils/m1/replay.mp4",
        },
      },
    };
    expect(firstOutputLocation(info)).toBe("https://bucket.s3.amazonaws.com/mehfils/m1/replay.mp4");
  });

  it("builds https url from s3 key with public base", () => {
    expect(
      normalizeRecordingUrl("mehfils/m1/replay.mp4", "https://cdn.example.com"),
    ).toBe("https://cdn.example.com/mehfils/m1/replay.mp4");
  });

  it("does not mark failed when egress is still active without url", () => {
    expect(egressLooksFailed({ status: 1 }, false)).toBe(false);
  });

  it("marks failed when egress reports error without url", () => {
    expect(egressLooksFailed({ status: 4, error: "upload failed" }, false)).toBe(true);
  });
});
