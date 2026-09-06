import { Box, Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { ACCENTS, ACCENT_META, useTheme, type ThemePreference } from "../../contexts/ThemeContext";
import { cn } from "../../lib/utils";
import { Dropdown } from "../ui/Dropdown";

/** Row of accent swatches — reused by the topbar popover and the Settings page. */
export function AccentSwatches({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const { accent, setAccent } = useTheme();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="radiogroup" aria-label="Accent colour">
      {ACCENTS.map((a) => {
        const meta = ACCENT_META[a];
        const active = accent === a;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={meta.label}
            title={meta.label}
            onClick={() => setAccent(a)}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-spring hover:scale-110 focus-visible:outline-offset-4",
              size === "sm" ? "h-6 w-6" : "h-8 w-8",
              active && "scale-110"
            )}
            style={{
              background: `linear-gradient(135deg, ${meta.swatch}, ${meta.glow})`,
              // Rings are box-shadows in Tailwind, so the selection ring is composed here.
              boxShadow: active
                ? `0 0 0 2px rgb(var(--card)), 0 0 0 4px ${meta.swatch}, 0 6px 14px -6px ${meta.swatch}`
                : `inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 14px -6px ${meta.swatch}`,
            }}
          >
            {active && <Check className={cn("text-white drop-shadow", size === "sm" ? "h-3 w-3" : "h-4 w-4")} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

export function DepthToggle({ className }: { className?: string }) {
  const { depth, setDepth } = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={depth}
      onClick={() => setDepth(!depth)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition",
        depth ? "border-primary-500/60 bg-primary-50/70 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-border text-ink hover:bg-ink/[0.03] dark:hover:bg-white/[0.05]",
        className
      )}
    >
      <Box className="h-4 w-4" />
      <span className="flex-1">
        3D depth
        <span className="block text-xs font-normal text-muted">Layered shadows, gradients &amp; motion</span>
      </span>
      <span
        className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", depth ? "bg-primary-600" : "bg-ink/20 dark:bg-white/20")}
        aria-hidden
      >
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", depth ? "translate-x-4" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

const MODES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

/** Compact topbar popover: light/dark/system, accent swatches and depth toggle in one place. */
export function AppearancePicker({ compact = false }: { compact?: boolean }) {
  const { theme, preference, setPreference, accent } = useTheme();
  const meta = ACCENT_META[accent];

  return (
    <Dropdown
      width="w-72"
      role="dialog"
      trigger={(open) => (
        <button
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted transition hover:text-ink dark:hover:bg-white/[0.06]",
            compact ? "h-8 w-8" : "h-9 w-9",
            open && "text-ink dark:bg-white/[0.06]"
          )}
          aria-label={`Appearance (theme ${theme}, accent ${meta.label})`}
        >
          <span className="relative">
            <Palette className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-card" style={{ background: meta.swatch }} aria-hidden />
          </span>
        </button>
      )}
    >
      <div className="px-3 pb-1 pt-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Mode</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-ink/[0.05] p-0.5 dark:bg-white/[0.07]" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.value}
              role="tab"
              aria-selected={preference === m.value}
              onClick={() => setPreference(m.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
                preference === m.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-2 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Accent</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <AccentSwatches size="sm" />
          <span className="text-xs font-medium text-ink">{meta.label}</span>
        </div>
      </div>
      <div className="border-t border-border p-1.5">
        <DepthToggle className="border-transparent" />
      </div>
    </Dropdown>
  );
}
