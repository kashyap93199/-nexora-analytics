import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, ShoppingBag } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { api } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { PERMISSIONS, type Order, type OrderStatus } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatDateTime } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { OrderStatusBadge } from "../../components/ui/Badge";
import { Avatar, PageHeader } from "../../components/ui/base";
import { EmptyState, ErrorState, PageLoader } from "../../components/ui/Feedback";
import { cn } from "../../lib/utils";

const STATUS_FLOW: OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  const toast = useToast();
  useDocumentTitle("Order");
  const canManage = hasPermission(PERMISSIONS.ordersManage);

  const { data: order, loading, error, refetch } = useApi<Order>(`/api/orders/${orderId}`);
  const mutation = useMutation(async ({ status }: { status: OrderStatus }) => api.patch(`/api/orders/${orderId}/status`, { status }));

  if (loading) return <PageLoader label="Loading order…" />;
  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link to="/app/orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Orders</Link>
        <ErrorState message="Unable to load this order." onRetry={refetch} className="mt-6" />
      </div>
    );
  }

  const changeStatus = async (status: OrderStatus) => {
    try {
      await mutation.run({ status });
      toast.success(`Order marked as ${status}`);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const flowIndex = STATUS_FLOW.indexOf(order.status);
  const isTerminal = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="space-y-6">
      <Link to="/app/orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>

      <PageHeader
        title={order.order_number}
        breadcrumb="Order details"
        description={`Placed ${formatDateTime(order.placed_at)} · ${order.channel.replace("_", " ")} channel`}
        actions={<OrderStatusBadge status={order.status} />}
      />

      {/* Status stepper */}
      {canManage && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((step, i) => {
              const reached = !isTerminal && i <= Math.max(flowIndex, 0);
              const current = !isTerminal && i === flowIndex;
              return (
                <button
                  key={step}
                  onClick={() => void changeStatus(step)}
                  disabled={mutation.loading}
                  className={cn(
                    "flex flex-1 items-center gap-2 disabled:cursor-not-allowed",
                    i === STATUS_FLOW.length - 1 && "flex-none"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                      current ? "bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-500/20"
                        : reached ? "bg-primary-600 text-white"
                        : "bg-ink/[0.06] text-muted dark:bg-white/[0.08]"
                    )}
                  >
                    {reached && !current ? "✓" : i + 1}
                  </span>
                  <span className={cn("text-[13px] font-medium capitalize", reached ? "text-ink" : "text-muted")}>{step}</span>
                  {i < STATUS_FLOW.length - 1 && <span className={cn("mx-1 h-px flex-1", reached && i < Math.max(flowIndex, 0) ? "bg-primary-400" : "bg-border")} />}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            {order.status !== "cancelled" && (
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => void changeStatus("cancelled")} disabled={mutation.loading}>
                Cancel order
              </Button>
            )}
            {order.status !== "refunded" && (
              <Button variant="ghost" size="sm" onClick={() => void changeStatus("refunded")} disabled={mutation.loading}>
                Mark refunded
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Items */}
        <Card className="lg:col-span-2">
          <CardHeader title="Items" subtitle={`${order.items.reduce((s, i) => s + i.quantity, 0)} units across ${order.items.length} lines`} />
          {order.items.length > 0 ? (
            <div className="divide-y divide-border/70">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] text-muted dark:bg-white/[0.06]"><Package className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.product_name}</p>
                    <p className="text-xs text-muted">Unit price {fc(item.unit_price, currency)}</p>
                  </div>
                  <span className="text-xs text-muted tabular">× {item.quantity}</span>
                  <span className="w-24 text-right font-semibold text-ink tabular">{fc(item.total, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No line items" className="py-8" />
          )}
          {/* Totals */}
          <div className="space-y-1.5 border-t border-border px-5 py-4 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span className="tabular text-ink">{fc(order.subtotal, currency)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-muted"><span>Discount</span><span className="tabular text-ink">−{fc(order.discount, currency)}</span></div>}
            <div className="flex justify-between text-muted"><span>Tax (8%)</span><span className="tabular text-ink">{fc(order.tax, currency)}</span></div>
            <div className="flex justify-between text-muted"><span>Shipping</span><span className="tabular text-ink">{fc(order.shipping, currency)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-ink"><span>Total</span><span className="tabular">{fc(order.total, currency)}</span></div>
          </div>
        </Card>

        {/* Customer */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <div className="p-5">
              {order.customer_id ? (
                <Link to={`/app/customers/${order.customer_id}`} className="flex items-center gap-3">
                  <Avatar name={order.customer_name ?? "?"} />
                  <span>
                    <span className="block font-medium text-ink hover:text-primary-600 dark:hover:text-primary-400">{order.customer_name}</span>
                    <span className="block text-xs text-muted">{order.customer_email}</span>
                  </span>
                </Link>
              ) : (
                <p className="text-sm text-muted">Guest / walk-in order — no customer linked.</p>
              )}
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-[13px] text-muted">
                <p><span className="font-medium text-ink">Region:</span> {order.region ?? "—"}</p>
                <p><span className="font-medium text-ink">Channel:</span> <span className="capitalize">{order.channel.replace("_", " ")}</span></p>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Order summary" />
            <ul className="space-y-2 p-5 text-[13px]">
              <li className="flex justify-between"><span className="text-muted">Order #</span><span className="font-medium text-ink">{order.order_number}</span></li>
              <li className="flex justify-between"><span className="text-muted">Status</span><OrderStatusBadge status={order.status} /></li>
              <li className="flex justify-between"><span className="text-muted">Placed</span><span className="text-ink">{formatDateTime(order.placed_at)}</span></li>
              <li className="flex justify-between"><span className="text-muted">Items</span><span className="tabular text-ink">{order.items.length}</span></li>
            </ul>
          </Card>
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
            <ShoppingBag className="mx-auto mb-1 h-4 w-4" />
            Order data powers the revenue &amp; sales analytics in your dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
