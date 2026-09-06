import { useId, type ReactNode } from "react";
import { Skeleton } from "../ui/Feedback";
import { Delta } from "../ui/base";
import { useCountUp } from "../../hooks/useUi";
import { useTilt } from "../../hooks/useTilt";
import { cn, formatCurrency, formatNumber } from "../../lib/utils";

function AnimatedValue({
  value,
  kind,
  currency,
}: {
  value: number;
  kind: "currency" | "number" | "percent";
  currency?: string;
}) {
  const animated = useCountUp(value);
  if (kind === "currency") return <>{formatCurrency(animated, currency, animated >= 100000)}</>;
  if (kind === "percent") return <>{animated.toFixed(2)}%</>;
  return <>{formatNumber(animated, Math.abs(value) >= 100000)}</>;
}

/** Tiny inline trend line rendered from a numeric series (no axes, no deps). */
export function Sparkline({ points, className, stroke = "currentColor" }: { points: number[]; className?: string; stroke?: string }) {
  const id = `spark-${useId().replace(/:/g, "")}`;
  if (points.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / span) * (h - 4) - 2] as const);
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaSuffix = "%",
  deltaInvert = false,
  kind = "currency",
  currency,
  icon,
  loading = false,
  hint,
  variant = "default",
  sparkline,
  index = 0,
}: {
  label: string;
  value: number;
  delta?: number;
  deltaSuffix?: string;
  deltaInvert?: boolean;
  kind?: "currency" | "number" | "percent";
  currency?: string;
  icon?: ReactNode;
  loading?: boolean;
  hint?: string;
  /** `hero` renders the accent-gradient version used for the headline KPI. */
  variant?: "default" | "hero";
  /** Optional trend series rendered as a sparkline under the value. */
  sparkline?: number[];
  /** Position in a grid — used to stagger the entrance animation. */
  index?: number;
}) {
  const tilt = useTilt<HTMLDivElement>(5);
  const hero = variant === "hero";

  return (
    <div
      ref={tilt.ref}
      {...tilt.handlers}
      style={{ ...tilt.style, animationDelay: `${index * 60}ms` }}
      className={cn(
        "card-3d card-3d-hover relative animate-rise-in overflow-hidden rounded-xl border p-5 shadow-card",
        hero ? "stat-hero border-transparent" : "border-border bg-card"
      )}
    >
      {/* Pointer-following highlight (depth mode only, driven by --mx/--my from useTilt) */}
      {tilt.enabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 [.card-3d:hover_&]:opacity-100"
          style={{
            background: hero
              ? "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.22), transparent 60%)"
              : "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgb(var(--primary-500) / 0.12), transparent 60%)",
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-2">
        <p className={cn("text-[13px] font-medium", hero ? "text-white/80" : "text-muted")}>{label}</p>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 [.card-3d:hover_&]:-translate-y-0.5 [.card-3d:hover_&]:rotate-6",
              hero ? "bg-white/20 text-white shadow-inner" : "icon-3d bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className={cn("mt-2.5 h-8 w-28", hero && "bg-white/25")} />
      ) : (
        <p className={cn("relative mt-1.5 text-[26px] font-bold leading-tight tracking-tight tabular", hero ? "text-white" : "text-ink")}>
          <AnimatedValue value={value} kind={kind} currency={currency} />
        </p>
      )}

      <div className="relative mt-1.5 flex items-center gap-2">
        {loading ? (
          <Skeleton className={cn("h-4 w-16", hero && "bg-white/25")} />
        ) : delta !== undefined ? (
          <>
            <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} className={cn(hero && "rounded-full bg-white/20 px-1.5 py-0.5 !text-white")} />
            <span className={cn("text-xs", hero ? "text-white/75" : "text-muted")}>vs previous period</span>
          </>
        ) : (
          hint && <span className={cn("text-xs", hero ? "text-white/75" : "text-muted")}>{hint}</span>
        )}
      </div>

      {!loading && sparkline && sparkline.length > 1 && (
        <div className={cn("relative mt-3 -mb-1", hero ? "text-white" : "text-primary-500")}>
          <Sparkline points={sparkline} />
        </div>
      )}
    </div>
  );
}
