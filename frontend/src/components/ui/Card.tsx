import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
