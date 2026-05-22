import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  MehfilMediaProvider,
  useMehfilMediaContext,
  useMehfilMediaContextOptional,
} from "@/features/mehfil/MehfilMediaContext";

function Probe() {
  const ctx = useMehfilMediaContext();
  return (
    <div>
      <span data-testid="has-preflight">{ctx.preflight ? "yes" : "no"}</span>
      <button type="button" onClick={() => ctx.setPreflightStream(makeMockStream())}>
        set
      </button>
      <button type="button" onClick={() => ctx.clearPreflightMedia()}>
        clear
      </button>
      <span data-testid="ref-live">
        {ctx.getPreflightMedia()?.videoTrack?.readyState ?? "none"}
      </span>
    </div>
  );
}

function makeMockStream() {
  const videoTrack = { kind: "video", readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
  const audioTrack = { kind: "audio", readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => [audioTrack],
    getTracks: () => [videoTrack, audioTrack],
  } as unknown as MediaStream;
}

describe("MehfilMediaContext", () => {
  it("throws when used outside provider", () => {
    expect(() => renderHookProbe()).toThrow(/MehfilMediaProvider/);
  });

  it("stores preflight stream and exposes via getPreflightMedia ref", () => {
    render(
      <MehfilMediaProvider>
        <Probe />
      </MehfilMediaProvider>,
    );

    expect(screen.getByTestId("has-preflight").textContent).toBe("no");

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });

    expect(screen.getByTestId("has-preflight").textContent).toBe("yes");
    expect(screen.getByTestId("ref-live").textContent).toBe("live");
  });

  it("clearPreflightMedia stops tracks and clears state", () => {
    render(
      <MehfilMediaProvider>
        <Probe />
      </MehfilMediaProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });
    act(() => {
      screen.getByRole("button", { name: "clear" }).click();
    });

    expect(screen.getByTestId("has-preflight").textContent).toBe("no");
    expect(screen.getByTestId("ref-live").textContent).toBe("none");
  });

  it("useMehfilMediaContextOptional returns null outside provider", () => {
    function OptionalProbe() {
      const ctx = useMehfilMediaContextOptional();
      return <span data-testid="optional">{ctx === null ? "null" : "present"}</span>;
    }
    render(<OptionalProbe />);
    expect(screen.getByTestId("optional").textContent).toBe("null");
  });
});

function renderHookProbe() {
  function Bad() {
    useMehfilMediaContext();
    return null;
  }
  render(<Bad />);
}

describe("cleanup / unmount patterns", () => {
  it("clears preflight state on clear and survives unmount", () => {
    const stopped: string[] = [];
    const videoTrack = {
      kind: "video",
      readyState: "live",
      stop: vi.fn(() => stopped.push("video")),
    } as unknown as MediaStreamTrack;
    const audioTrack = {
      kind: "audio",
      readyState: "live",
      stop: vi.fn(() => stopped.push("audio")),
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack],
      getTracks: () => [videoTrack, audioTrack],
    } as unknown as MediaStream;

    function StreamProbe() {
      const ctx = useMehfilMediaContext();
      return (
        <div>
          <span data-testid="has-preflight">{ctx.preflight ? "yes" : "no"}</span>
          <button type="button" onClick={() => ctx.setPreflightStream(stream)}>
            set
          </button>
          <button type="button" onClick={() => ctx.clearPreflightMedia()}>
            clear
          </button>
        </div>
      );
    }

    const { unmount } = render(
      <MehfilMediaProvider>
        <StreamProbe />
      </MehfilMediaProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });
    expect(screen.getByTestId("has-preflight").textContent).toBe("yes");

    act(() => {
      screen.getByRole("button", { name: "clear" }).click();
    });
    expect(screen.getByTestId("has-preflight").textContent).toBe("no");
    expect(stopped).toEqual(["video", "audio"]);

    unmount();
  });
});
