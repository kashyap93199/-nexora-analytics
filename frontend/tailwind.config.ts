import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef4ff",
          100: "#dce7fe",
          200: "#c0d3fe",
          300: "#94b6fc",
          400: "#628ef9",
          500: "#3c66f4",
          600: "#2648e9",
          700: "#1d36d6",
          800: "#1e2fae",
          900: "#1e2c89",
          950: "#171e53",
        },
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
      },
      animation: {
        "fade-in": "fadeIn 0.18s ease-out",
        "slide-up": "slideUp 0.22s ease-out",
        "scale-in": "scaleIn 0.16s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
} satisfies Config;
