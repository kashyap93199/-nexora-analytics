import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Feedback";
import { Delta } from "../ui/base";
import { useCountUp } from "../../hooks/useUi";
import { formatCurrency, formatNumber } from "../../lib/utils";

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
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className="rounded-lg bg-primary-50 p-1.5 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2.5 h-8 w-28" />
      ) : (
        <p className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-ink tabular">
          <AnimatedValue value={value} kind={kind} currency={currency} />
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-4 w-16" />
        ) : delta !== undefined ? (
          <>
            <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} />
            <span className="text-xs text-muted">vs previous period</span>
          </>
        ) : (
          hint && <span className="text-xs text-muted">{hint}</span>
        )}
      </div>
    </Card>
  );
}
