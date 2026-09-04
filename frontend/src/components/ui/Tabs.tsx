import { cn } from "../../lib/utils";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-lg bg-ink/[0.05] p-0.5 dark:bg-white/[0.07]", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
            value === opt.value
              ? "bg-card text-ink shadow-sm"
              : "text-muted hover:text-ink"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
