import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { computeRange, type DateRange, type DateRangeKey } from "../lib/dates";

interface DateRangeContextValue {
  range: DateRange;
  setRangeKey: (key: DateRangeKey, start?: string, end?: string) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(() => computeRange("last30"));

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
