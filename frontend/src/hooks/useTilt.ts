import { useCallback, useRef, type CSSProperties, type MouseEvent } from "react";
import { useThemeOptional } from "../contexts/ThemeContext";

/**
 * Pointer-tracking 3D tilt for cards. Returns handlers + a ref; the element is
 * rotated toward the cursor (max `maxDeg`) and a highlight follows the pointer
 * through the `--mx` / `--my` CSS variables. No-op when depth mode is off or the
 * user prefers reduced motion, and never runs on touch/coarse pointers.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 6) {
  const ref = useRef<T | null>(null);
  const depth = useThemeOptional()?.depth ?? false;
  const enabled =
    depth &&
    typeof window !== "undefined" &&
    !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) &&
    !(window.matchMedia?.("(pointer: coarse)").matches ?? false);

  const onMouseMove = useCallback(
    (e: MouseEvent<T>) => {
      const el = ref.current;
      if (!el || !enabled) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return; // not laid out yet (or jsdom)
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * maxDeg * 2;
      const ry = (px - 0.5) * maxDeg * 2;
      el.style.transition = "transform 0.12s ease-out, box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.35s";
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    },
    [enabled, maxDeg]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.transition = "";
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
  }, []);

  const style: CSSProperties = enabled ? { transformStyle: "preserve-3d", willChange: "transform" } : {};

  return { ref, enabled, style, handlers: enabled ? { onMouseMove, onMouseLeave } : {} };
}
