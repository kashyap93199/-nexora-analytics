import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "nexora-theme";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });

  const theme = useMemo(() => resolveTheme(preference), [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPreferenceState("system"); // re-resolve via theme memo
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem(STORAGE_KEY, p);
  }, []);

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
