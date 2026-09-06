import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "icon-3d inline-flex items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm",
        className ?? "h-8 w-8"
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M4 17l5-6 4 3 7-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ dark = false, to = "/" }: { dark?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Nexora Analytics home">
      <LogoMark className="h-8 w-8" />
      <span className="flex flex-col leading-none">
        <span className={cn("text-[17px] font-bold tracking-tight", dark ? "text-white" : "text-ink")}>
          Nexora<span className="text-gradient"> Analytics</span>
        </span>
        {!dark && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">Business insights</span>}
      </span>
    </Link>
  );
}
