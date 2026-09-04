import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-400">
      {children}
    </p>
  );
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-3xl font-bold tracking-tight text-ink sm:text-4xl", className)}>{children}</h2>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{children}</p>;
}
