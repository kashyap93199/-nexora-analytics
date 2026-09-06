import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RANGE_OPTIONS, computeRange, type DateRange, type DateRangeKey } from "../lib/dates";

interface DateRangeContextValue {
  range: DateRange;
  setRangeKey: (key: DateRangeKey, start?: string, end?: string) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export const DATE_RANGE_STORAGE_KEY = "nexora.dateRange";

interface StoredRange {
  key: DateRangeKey;
  start?: string;
  end?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Restore the last selection. Relative presets are recomputed from today; custom ranges keep their dates. */
export function restoreRange(storage: Pick<Storage, "getItem"> | undefined): DateRange {
  const fallback = computeRange("last30");
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(DATE_RANGE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredRange>;
    if (typeof parsed.key !== "string" || !RANGE_OPTIONS.some((o) => o.key === parsed.key)) return fallback;
    if (parsed.key === "custom") {
      const { start, end } = parsed;
      if (!start || !end || !ISO_DAY.test(start) || !ISO_DAY.test(end) || start > end) return fallback;
      return computeRange("custom", start, end);
    }
    return computeRange(parsed.key);
  } catch {
    return fallback;
  }
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(() =>
    restoreRange(typeof window !== "undefined" ? window.sessionStorage : undefined)
  );

  useEffect(() => {
    try {
      const stored: StoredRange = range.key === "custom" ? { key: "custom", start: range.start, end: range.end } : { key: range.key };
      window.sessionStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage may be unavailable (private mode / quota); persistence is best-effort.
    }
  }, [range]);

  const setRangeKey = (key: DateRangeKey, start?: string, end?: string) => {
    setRange(computeRange(key, start, end));
  };

  const value = useMemo(() => ({ range, setRangeKey }), [range]);
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
