import { useCallback, useEffect, useState } from "react";
import type { FeedFilter } from "@/components/feed/home-feed-ui";

const STORAGE_KEY = "mk-feed-preferences";

export type FeedPreferences = {
  defaultFilter: FeedFilter;
  showVoice: boolean;
  showText: boolean;
  showReels: boolean;
  showMehfil: boolean;
  showLiveInStories: boolean;
  dataSaverFeed: boolean;
};

export const FEED_FILTER_DEFAULT: FeedFilter = "All";

const DEFAULTS: FeedPreferences = {
  defaultFilter: FEED_FILTER_DEFAULT,
  showVoice: true,
  showText: true,
  showReels: true,
  showMehfil: true,
  showLiveInStories: true,
  dataSaverFeed: false,
};

function readPrefs(): FeedPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: FeedPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function initFeedPreferences() {
  readPrefs();
}

/** Apply feed content toggles when filter is All */
export function applyFeedContentPrefs(posts: import("@/lib/store").Post[], prefs: FeedPreferences): import("@/lib/store").Post[] {
  return posts.filter((p) => {
    if (p.kind === "voice") return prefs.showVoice;
    if (p.kind === "reel") return prefs.showReels;
    if (p.kind === "text" || p.kind === "story") return prefs.showText;
    return true;
  });
}

export function useFeedPreferences() {
  const [prefs, setPrefs] = useState<FeedPreferences>(() => readPrefs());

  useEffect(() => {
    writePrefs(prefs);
  }, [prefs]);

  const setPref = useCallback(<K extends keyof FeedPreferences>(key: K, value: FeedPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetPrefs = useCallback(() => setPrefs(DEFAULTS), []);

  return { prefs, setPref, resetPrefs };
}
