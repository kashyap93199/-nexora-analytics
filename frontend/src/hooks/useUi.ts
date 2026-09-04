import { useEffect, useRef, useState } from "react";

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Animated count-up toward `value` (respects prefers-reduced-motion). */
export function useCountUp(value: number, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const prefersReduced = useRef(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    if (prefersReduced.current) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = display;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // ease-out cubic
      setDisplay(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}

export function useClickOutside(onOutside: () => void): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Nexora Analytics` : "Nexora Analytics";
  }, [title]);
}
