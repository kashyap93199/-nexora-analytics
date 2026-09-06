import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ACCENTS, ACCENT_STORAGE_KEY, DEPTH_STORAGE_KEY, ThemeProvider, isAccent, useTheme } from "../ThemeContext";
import { AccentSwatches, DepthToggle } from "../../components/layout/AppearancePicker";

function Probe() {
  const { accent, depth, theme } = useTheme();
  return (
    <p>
      accent={accent} depth={String(depth)} theme={theme}
    </p>
  );
}

describe("ThemeProvider accent + depth", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.accent;
    delete document.documentElement.dataset.depth;
  });

  it("defaults to the indigo accent with depth enabled and mirrors them on <html>", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByText(/accent=indigo depth=true/)).toBeInTheDocument();
    expect(document.documentElement.dataset.accent).toBe("indigo");
    expect(document.documentElement.dataset.depth).toBe("on");
  });

  it("restores a saved accent and depth preference", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, "emerald");
    localStorage.setItem(DEPTH_STORAGE_KEY, "off");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByText(/accent=emerald depth=false/)).toBeInTheDocument();
    expect(document.documentElement.dataset.depth).toBe("off");
  });

  it("ignores unknown accents in storage", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, "hotpink");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByText(/accent=indigo/)).toBeInTheDocument();
    expect(isAccent("hotpink")).toBe(false);
    expect(ACCENTS.every(isAccent)).toBe(true);
  });

  it("persists swatch and depth changes made through the picker", () => {
    render(
      <ThemeProvider>
        <AccentSwatches />
        <DepthToggle />
        <Probe />
      </ThemeProvider>
    );
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Rose" }));
    });
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("rose");
    expect(document.documentElement.dataset.accent).toBe("rose");
    expect(screen.getByRole("radio", { name: "Rose" })).toHaveAttribute("aria-checked", "true");

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });
    expect(localStorage.getItem(DEPTH_STORAGE_KEY)).toBe("off");
    expect(document.documentElement.dataset.depth).toBe("off");
    expect(screen.getByText(/depth=false/)).toBeInTheDocument();
  });
});

describe("ThemeProvider system mode", () => {
  const originalMatchMedia = window.matchMedia;
  let listeners: Array<(e: { matches: boolean }) => void> = [];
  let systemDark = false;

  beforeEach(() => {
    localStorage.clear();
    listeners = [];
    systemDark = false;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-color-scheme") ? systemDark : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        if (query.includes("prefers-color-scheme")) listeners.push(cb);
      },
      removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove("dark");
  });

  it("re-resolves the theme when the OS colour scheme changes", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByText(/theme=light/)).toBeInTheDocument();
    expect(listeners.length).toBeGreaterThan(0);

    act(() => {
      systemDark = true;
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(screen.getByText(/theme=dark/)).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      systemDark = false;
      listeners.forEach((cb) => cb({ matches: false }));
    });
    expect(screen.getByText(/theme=light/)).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("stops following the OS once an explicit theme is chosen", () => {
    localStorage.setItem("nexora-theme", "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(listeners.length).toBe(0);
    expect(screen.getByText(/theme=light/)).toBeInTheDocument();
  });
});
