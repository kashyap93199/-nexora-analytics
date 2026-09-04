import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-primary-500", className)}
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted" role="status">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink/[0.07] dark:bg-white/[0.07]", className)} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink/[0.04] text-muted dark:bg-white/[0.06]">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-[13px] text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = "Unable to load this data.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)} role="alert">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/10">
        <AlertTriangle className="h-5.5 w-5.5" />
      </div>
      <p className="text-sm font-medium text-ink">{message}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted">Please try again in a moment.</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  );
}
