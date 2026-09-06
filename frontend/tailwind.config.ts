import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accent colour is driven by CSS variables (see index.css) so users can
        // pick a palette at runtime; every shade keeps Tailwind opacity support.
        primary: {
          50: "rgb(var(--primary-50) / <alpha-value>)",
          100: "rgb(var(--primary-100) / <alpha-value>)",
          200: "rgb(var(--primary-200) / <alpha-value>)",
          300: "rgb(var(--primary-300) / <alpha-value>)",
          400: "rgb(var(--primary-400) / <alpha-value>)",
          500: "rgb(var(--primary-500) / <alpha-value>)",
          600: "rgb(var(--primary-600) / <alpha-value>)",
          700: "rgb(var(--primary-700) / <alpha-value>)",
          800: "rgb(var(--primary-800) / <alpha-value>)",
          900: "rgb(var(--primary-900) / <alpha-value>)",
          950: "rgb(var(--primary-950) / <alpha-value>)",
        },
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        pop: "0 4px 6px -2px rgba(16,24,40,0.05), 0 12px 16px -4px rgba(16,24,40,0.08)",
        modal: "0 24px 48px -12px rgba(16,24,40,0.25)",
        // Layered "3D" elevation used in depth mode
        depth: "0 1px 1px rgba(16,24,40,0.03), 0 2px 4px rgba(16,24,40,0.04), 0 8px 16px -4px rgba(16,24,40,0.08), 0 24px 40px -16px rgba(16,24,40,0.12)",
        "depth-lg": "0 2px 4px rgba(16,24,40,0.04), 0 12px 24px -8px rgba(16,24,40,0.14), 0 40px 64px -24px rgba(16,24,40,0.2)",
        glow: "0 0 0 1px rgb(var(--primary-500) / 0.25), 0 12px 32px -8px rgb(var(--primary-500) / 0.45)",
        inset3d: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(16,24,40,0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.18s ease-out",
        "slide-up": "slideUp 0.22s ease-out",
        "scale-in": "scaleIn 0.16s ease-out",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "gradient-x": "gradientX 8s ease infinite",
        "rise-in": "riseIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        gradientX: { "0%, 100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        riseIn: { from: { opacity: "0", transform: "translateY(14px) scale(0.98)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
