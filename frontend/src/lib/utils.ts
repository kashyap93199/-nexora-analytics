import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = "USD", compact = false): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  });
  return formatter.format(amount || 0);
}

export function formatNumber(value: number, compact = false): string {
  if (compact) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
  }
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, "MMM d, yyyy · HH:mm");
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function apiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg}, ...]
      return detail
        .map((d) => (d as { msg?: string }).msg ?? "Invalid value")
        .join("; ");
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export const isNumericString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v));

/** Deterministic gradient/color from a string (for category charts). */
export function stringToColor(name: string): string {
  const palette = ["#2648e9", "#0ea5a4", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#64748b", "#84cc16", "#06b6d4"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
