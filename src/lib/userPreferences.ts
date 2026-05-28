import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mk-user-preferences";

export type UserPreferences = {
  darkMode: boolean;
  soundEffects: boolean;
  dataSaver: boolean;
};

const DEFAULTS: UserPreferences = {
  darkMode: true,
  soundEffects: true,
  dataSaver: false,
};

function readPrefs(): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: UserPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function applyDarkMode(enabled: boolean) {
  document.documentElement.classList.toggle("dark", enabled);
}

export function initUserPreferences() {
  applyDarkMode(readPrefs().darkMode);
}

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => readPrefs());

  useEffect(() => {
    applyDarkMode(prefs.darkMode);
    writePrefs(prefs);
  }, [prefs]);

  const setPref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { prefs, setPref };
}
