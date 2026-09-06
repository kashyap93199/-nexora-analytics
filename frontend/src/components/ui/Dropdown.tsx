import { useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useClickOutside } from "../../hooks/useUi";

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
  width = "w-56",
  role = "menu",
}: {
  trigger: (open: boolean) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  className?: string;
  width?: string;
  /** ARIA role of the popover — use `dialog` when the content is not a list of menu items. */
  role?: "menu" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">
        {trigger(open)}
      </div>
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1.5 animate-scale-in rounded-xl border border-border bg-card p-1 shadow-pop",
            align === "right" ? "right-0" : "left-0",
            width,
            className
          )}
          role={role}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-ink hover:bg-ink/[0.05] dark:hover:bg-white/[0.08]",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}
