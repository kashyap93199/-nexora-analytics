import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../lib/utils";

/**
 * Overview hero: accent gradient, floating "orbs" and a faint 3D grid.
 * Falls back to a plain page header when depth mode is off.
 */
export function WelcomeBanner({
  title,
  description,
  stat,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Optional headline figure shown on the right; styled for whichever mode is active. */
  stat?: { label: ReactNode; value: ReactNode };
  actions?: ReactNode;
  className?: string;
}) {
  const { depth } = useTheme();

  if (!depth) {
    return (
      <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {(stat || actions) && (
          <div className="flex flex-wrap items-center gap-2">
            {stat && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-ink shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{stat.label}</span>
                <span className="text-lg font-bold tabular">{stat.value}</span>
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "stat-hero relative overflow-hidden rounded-2xl border border-white/10 px-6 py-6 shadow-depth-lg sm:px-8 sm:py-7 animate-rise-in",
        className
      )}
      aria-label="Welcome"
    >
      {/* 3D perspective grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 opacity-40 [mask-image:linear-gradient(to_top,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          transform: "perspective(600px) rotateX(58deg) translateY(30px) scale(1.4)",
          transformOrigin: "bottom center",
        }}
      />
      {/* Floating orbs */}
      <span aria-hidden className="orb animate-float -right-6 -top-10 h-40 w-40" />
      <span aria-hidden className="orb animate-float-slow right-40 top-6 h-14 w-14 opacity-80 [animation-delay:1.2s]" />
      <span aria-hidden className="orb animate-float right-72 -bottom-6 h-24 w-24 opacity-60 [animation-delay:2.4s]" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 shadow-inner backdrop-blur">
            <Sparkles className="h-3 w-3" /> Live overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-white/80">{description}</p>}
        </div>
        {(stat || actions) && (
          <div className="relative flex flex-wrap items-center gap-2">
            {stat && (
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-white shadow-inner backdrop-blur">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/75">{stat.label}</span>
                <span className="text-lg font-bold tabular">{stat.value}</span>
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
