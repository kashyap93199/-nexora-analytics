import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300 dark:disabled:bg-primary-900 disabled:text-white/80 shadow-sm",
  secondary:
    "bg-ink/[0.05] text-ink hover:bg-ink/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] disabled:opacity-50",
  outline:
    "border border-border bg-card text-ink hover:bg-surface dark:hover:bg-white/[0.05] disabled:opacity-50",
  ghost: "text-muted hover:text-ink hover:bg-ink/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 shadow-sm",
  link: "text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 p-0 h-auto",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, leftIcon, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed",
        VARIANTS[variant],
        variant !== "link" && SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
    </button>
  );
});
