import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, initials } from "../../lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumb && <div className="mb-1 text-[13px] text-muted">{breadcrumb}</div>}
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-cyan-600",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-[13px]",
    lg: "h-12 w-12 text-base",
  };
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", color, sizes[size], className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({
  value,
  tone,
  className,
}: {
  value: number; // 0-100+
  tone?: "auto" | "blue" | "green" | "red" | "amber";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const resolvedTone =
    tone ?? (value >= 100 ? "green" : value >= 60 ? "blue" : value >= 30 ? "amber" : "red");
  const tones = {
    auto: "",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07] dark:bg-white/[0.08]", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-700", tones[resolvedTone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Delta({
  value,
  suffix = "%",
  invert = false,
  className,
}: {
  value: number;
  suffix?: string;
  invert?: boolean; // true when a decrease is good (e.g. refunds)
  className?: string;
}) {
  const up = value > 0;
  const down = value < 0;
  const good = invert ? down || value === 0 : up || value === 0;
  if (value === 0) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium text-muted", className)}>
        <Minus className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}
