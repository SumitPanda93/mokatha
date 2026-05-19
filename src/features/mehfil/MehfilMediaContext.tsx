/**
 * Session-scoped preflight media — one getUserMedia from studio check through LiveKit publish.
 * Cleared only on leaveRoom / fullMediaReset.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type MehfilPreflightMedia = {
  stream: MediaStream;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
};

type MehfilMediaContextValue = {
  preflight: MehfilPreflightMedia | null;
  setPreflightStream: (stream: MediaStream) => void;
  getPreflightMedia: () => MehfilPreflightMedia | null;
  clearPreflightMedia: () => void;
};

const MehfilMediaContext = createContext<MehfilMediaContextValue | null>(null);

export function MehfilMediaProvider({ children }: { children: ReactNode }) {
  const preflightRef = useRef<MehfilPreflightMedia | null>(null);
  const [preflight, setPreflight] = useState<MehfilPreflightMedia | null>(null);

  const setPreflightStream = useCallback((stream: MediaStream) => {
    const payload: MehfilPreflightMedia = {
      stream,
      videoTrack: stream.getVideoTracks()[0] ?? null,
      audioTrack: stream.getAudioTracks()[0] ?? null,
    };
    preflightRef.current = payload;
    setPreflight(payload);
    if (import.meta.env.DEV) {
      console.info("[mehfil:media] preflight_stream_set", {
        video: Boolean(payload.videoTrack),
        audio: Boolean(payload.audioTrack),
      });
    }
  }, []);

  const getPreflightMedia = useCallback(() => preflightRef.current, []);

  const clearPreflightMedia = useCallback(() => {
    const p = preflightRef.current;
    if (p) {
      p.stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      if (import.meta.env.DEV) console.info("[mehfil:media] preflight_stream_cleared");
    }
    preflightRef.current = null;
    setPreflight(null);
  }, []);

  const value = useMemo(
    () => ({
      preflight,
      setPreflightStream,
      getPreflightMedia,
      clearPreflightMedia,
    }),
    [preflight, setPreflightStream, getPreflightMedia, clearPreflightMedia],
  );

  return <MehfilMediaContext.Provider value={value}>{children}</MehfilMediaContext.Provider>;
}

export function useMehfilMediaContext(): MehfilMediaContextValue {
  const ctx = useContext(MehfilMediaContext);
  if (!ctx) {
    throw new Error("useMehfilMediaContext must be used within MehfilMediaProvider");
  }
  return ctx;
}

/** Safe when provider may be absent (tests). */
export function useMehfilMediaContextOptional(): MehfilMediaContextValue | null {
  return useContext(MehfilMediaContext);
}
