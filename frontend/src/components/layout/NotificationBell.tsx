import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useApi } from "../../hooks/useApi";
import type { NotificationsResponse } from "../../types";
import { timeAgo } from "../../lib/utils";
import { Dropdown } from "../ui/Dropdown";
import { Spinner } from "../ui/Feedback";

const TYPE_DOT: Record<string, string> = {
  revenue: "bg-emerald-500",
  sales: "bg-blue-500",
  inventory: "bg-amber-500",
  team: "bg-violet-500",
  order: "bg-teal-500",
  report: "bg-sky-500",
  system: "bg-slate-400",
};

export function NotificationBell() {
  const { data, loading, refetch } = useApi<NotificationsResponse>("/api/notifications", 0);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const unread = data?.unread ?? 0;

  // Poll lightly while open to keep the badge fresh.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => refetch(), 30000);
    return () => window.clearInterval(id);
  }, [open, refetch]);

  const markAll = async () => {
    await api.post("/api/notifications/read-all");
    toast.success("All notifications marked as read");
    refetch();
  };

  return (
    <Dropdown
      width="w-[22rem] max-w-[calc(100vw-2rem)]"
      trigger={(isOpen) => (
        <button
          onClick={() => {
            setOpen(!isOpen);
            if (!isOpen) refetch();
          }}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted transition hover:text-ink dark:hover:bg-white/[0.06]"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
        <p className="text-[13px] font-semibold text-ink">Notifications</p>
        {unread > 0 && (
          <button onClick={() => void markAll()} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : data && data.items.length > 0 ? (
          data.items.map((n) => (
            <div key={n.id} className={`flex gap-3 border-t border-border px-3 py-3 ${n.is_read ? "opacity-60" : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] ?? TYPE_DOT.system}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug text-ink">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted/80">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">You're all caught up 🎉</p>
        )}
      </div>
      <div className="border-t border-border p-1.5">
        <Link to="/app/notifications" className="block rounded-lg px-3 py-2 text-center text-[13px] font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-500/10">
          View all notifications
        </Link>
      </div>
    </Dropdown>
  );
}
