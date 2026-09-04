import { format, startOfDay, subDays, subMonths, startOfMonth, startOfYear } from "date-fns";

export type DateRangeKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

export interface DateRange {
  key: DateRangeKey;
  start: string; // yyyy-MM-dd
  end: string;
  label: string;
}

export function computeRange(key: DateRangeKey, customStart?: string, customEnd?: string): DateRange {
  const today = startOfDay(new Date());
  const toIso = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "today":
      return { key, start: toIso(today), end: toIso(today), label: "Today" };
    case "yesterday": {
      const d = subDays(today, 1);
      return { key, start: toIso(d), end: toIso(d), label: "Yesterday" };
    }
    case "last7":
      return { key, start: toIso(subDays(today, 6)), end: toIso(today), label: "Last 7 days" };
    case "last30":
      return { key, start: toIso(subDays(today, 29)), end: toIso(today), label: "Last 30 days" };
    case "last90":
      return { key, start: toIso(subDays(today, 89)), end: toIso(today), label: "Last 90 days" };
    case "thisMonth":
      return { key, start: toIso(startOfMonth(today)), end: toIso(today), label: "This month" };
    case "lastMonth": {
      const start = startOfMonth(subMonths(today, 1));
      return { key, start: toIso(start), end: toIso(subDays(startOfMonth(today), 1)), label: "Last month" };
    }
    case "thisYear":
      return { key, start: toIso(startOfYear(today)), end: toIso(today), label: "This year" };
    case "custom":
      return { key, start: customStart ?? toIso(subDays(today, 29)), end: customEnd ?? toIso(today), label: "Custom range" };
  }
}

export const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "thisYear", label: "This year" },
  { key: "custom", label: "Custom range" },
];

/** Suggested chart interval based on span length. */
export function intervalForRange(days: number): "day" | "week" | "month" {
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}
