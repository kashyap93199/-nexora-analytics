import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

/** Accent palettes — each maps to a set of `--primary-*` CSS variables in index.css. */
export const ACCENTS = ["indigo", "violet", "emerald", "rose", "amber", "ocean"] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_META: Record<Accent, { label: string; swatch: string; glow: string }> = {
  indigo: { label: "Indigo", swatch: "#2648e9", glow: "#8b5cf6" },
  violet: { label: "Violet", swatch: "#7c3aed", glow: "#d946ef" },
  emerald: { label: "Emerald", swatch: "#059669", glow: "#2dd4bf" },
  rose: { label: "Rose", swatch: "#e11d48", glow: "#fb923c" },
  amber: { label: "Sunset", swatch: "#ea580c", glow: "#fbbf24" },
  ocean: { label: "Ocean", swatch: "#0891b2", glow: "#3b82f6" },
};

interface ThemeContextValue {
  theme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Accent colour palette applied via `data-accent` on <html>. */
  accent: Accent;
  setAccent: (a: Accent) => void;
  /** "Depth" mode: layered shadows, gradients and subtle 3D motion. */
  depth: boolean;
  setDepth: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "nexora-theme";
export const ACCENT_STORAGE_KEY = "nexora-accent";
export const DEPTH_STORAGE_KEY = "nexora-depth";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveTheme(pref: ThemePreference, systemDark: boolean): "light" | "dark" {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode / quota) — preferences are best-effort.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = readStorage(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [accent, setAccentState] = useState<Accent>(() => {
    const saved = readStorage(ACCENT_STORAGE_KEY);
    return isAccent(saved) ? saved : "indigo";
  });
  // Depth is on by default — it is the "attractive" look; users can switch it off in Settings.
  const [depth, setDepthState] = useState<boolean>(() => readStorage(DEPTH_STORAGE_KEY) !== "off");

  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  const theme = useMemo(() => resolveTheme(preference, systemDark), [preference, systemDark]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.depth = depth ? "on" : "off";
  }, [depth]);

  // Follow OS changes while in "system" mode. (Tracked as its own state: setting the
  // preference to the same "system" value would bail out and never re-resolve.)
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media?.addEventListener) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    setSystemDark(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    writeStorage(STORAGE_KEY, p);
  }, []);

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
    writeStorage(ACCENT_STORAGE_KEY, a);
  }, []);

  const setDepth = useCallback((on: boolean) => {
    setDepthState(on);
    writeStorage(DEPTH_STORAGE_KEY, on ? "on" : "off");
  }, []);

  const value = useMemo(
    () => ({ theme, preference, setPreference, accent, setAccent, depth, setDepth }),
    [theme, preference, setPreference, accent, setAccent, depth, setDepth]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Like useTheme but returns null outside a provider (for leaf components rendered in isolation/tests). */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
