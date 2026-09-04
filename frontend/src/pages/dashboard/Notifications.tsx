import { useState } from "react";
import { BellRing, BellOff, CheckCheck, MailOpen } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { api } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import type { NotificationItem, NotificationsResponse } from "../../types";
import { timeAgo } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/base";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { cn } from "../../lib/utils";

const TYPE_STYLE: Record<string, string> = {
  revenue: "bg-emerald-500",
  sales: "bg-blue-500",
  inventory: "bg-amber-500",
  team: "bg-violet-500",
  order: "bg-teal-500",
  report: "bg-sky-500",
  system: "bg-slate-400",
};

export default function NotificationsPage() {
  useDocumentTitle("Notifications");
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<NotificationsResponse>("/api/notifications");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const items = (data?.items ?? []).filter((n) => filter === "all" || !n.is_read);

  const markRead = async (notification: NotificationItem) => {
    setBusyId(notification.id);
    try {
      await api.post(`/api/notifications/${notification.id}/read`);
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    await api.post("/api/notifications/read-all");
    toast.success("All caught up");
    refetch();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Targets reached, low stock alerts, team updates and more."
        actions={
          (data?.unread ?? 0) > 0 && (
            <Button variant="outline" onClick={() => void markAll()} leftIcon={<CheckCheck className="h-4 w-4" />}>
              Mark all as read
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition", filter === f ? "bg-primary-600 text-white" : "border border-border bg-card text-muted hover:text-ink")}
          >
            {f} {f === "unread" && (data?.unread ?? 0) > 0 && <span className="ml-1 tabular">({data?.unread})</span>}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="p-5"><SkeletonRows rows={6} /></div>
        ) : error ? (
          <ErrorState message="Unable to load notifications." onRetry={refetch} className="py-10" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? <BellOff className="h-6 w-6" /> : <BellRing className="h-6 w-6" />}
            title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
            message="You'll see revenue milestones, sales alerts, low inventory warnings and team activity here."
            className="py-14"
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {items.map((n) => (
              <li key={n.id} className={cn("flex gap-4 px-5 py-4 transition", !n.is_read && "bg-primary-50/40 dark:bg-primary-500/[0.04]")}>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", TYPE_STYLE[n.type] ?? TYPE_STYLE.system)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{n.message}</p>
                  <p className="mt-1 text-xs text-muted/80">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => void markRead(n)}
                    disabled={busyId === n.id}
                    className="self-center rounded-lg p-2 text-muted transition hover:bg-ink/[0.05] hover:text-ink disabled:opacity-50 dark:hover:bg-white/[0.08]"
                    aria-label={`Mark "${n.title}" as read`}
                    title="Mark as read"
                  >
                    <MailOpen className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
