import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { OrderStatus } from "../../types";

type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
};

export function Badge({
  tone = "gray",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

const ORDER_STATUS_TONE: Record<OrderStatus, { tone: Tone; label: string }> = {
  pending: { tone: "amber", label: "Pending" },
  processing: { tone: "blue", label: "Processing" },
  shipped: { tone: "violet", label: "Shipped" },
  delivered: { tone: "green", label: "Delivered" },
  cancelled: { tone: "red", label: "Cancelled" },
  refunded: { tone: "gray", label: "Refunded" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_TONE[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

const SEGMENT_TONE: Record<string, { tone: Tone; label: string }> = {
  new: { tone: "blue", label: "New" },
  returning: { tone: "teal", label: "Returning" },
  vip: { tone: "violet", label: "VIP" },
  inactive: { tone: "gray", label: "Inactive" },
};

export function SegmentBadge({ segment }: { segment: string }) {
  const meta = SEGMENT_TONE[segment] ?? { tone: "gray" as Tone, label: segment };
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

const ROLE_TONE: Record<string, Tone> = {
  owner: "violet",
  admin: "blue",
  manager: "teal",
  analyst: "amber",
  viewer: "gray",
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? "gray"}>{role[0]?.toUpperCase() + role.slice(1)}</Badge>;
}
