import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { RANGE_OPTIONS, type DateRangeKey } from "../../lib/dates";
import { useDateRange } from "../../contexts/DateRangeContext";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../lib/utils";

export function DateRangePicker() {
  const { range, setRangeKey } = useDateRange();
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);

  const apply = (key: DateRangeKey) => {
    if (key === "custom") {
      if (customStart && customEnd && customStart <= customEnd) {
        setRangeKey("custom", customStart, customEnd);
      }
      return;
    }
    setRangeKey(key);
  };

  return (
    <Dropdown
      width="w-[21rem] max-w-[calc(100vw-2rem)]"
      trigger={(open) => (
        <button
          className={cn(
            "hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-ink transition hover:border-primary-400/50 md:inline-flex",
            open && "border-primary-400/60"
          )}
          aria-label={`Date range: ${range.label}`}
        >
          <CalendarDays className="h-4 w-4 text-muted" />
          {range.label}
        </button>
      )}
    >
      <p className="px-3 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Date range</p>
      <div className="max-h-72 overflow-y-auto pb-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => apply(opt.key)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[13px] transition",
              range.key === opt.key ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-400" : "text-ink hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Custom range</p>
        <div className="flex items-center gap-2">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-ink" aria-label="Start date" />
          <span className="text-muted">→</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-ink" aria-label="End date" />
        </div>
        <button
          onClick={() => apply("custom")}
          className="mt-2.5 w-full rounded-lg bg-primary-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-primary-700"
        >
          Apply
        </button>
      </div>
    </Dropdown>
  );
}
