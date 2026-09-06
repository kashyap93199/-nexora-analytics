import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, MoreHorizontal, Plus, Search, ShoppingBag } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDebounced, useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api, downloadCsv } from "../../services/api";
import { PERMISSIONS, type Channel, type Customer, type Order, type OrderStatus } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatDateTime } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OrderStatusBadge } from "../../components/ui/Badge";
import { Dropdown, MenuItem } from "../../components/ui/Dropdown";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/base";
import { Pagination } from "../../components/ui/Pagination";
import { cn } from "../../lib/utils";

const STATUSES: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];

/** Mirrors the server-side state machine so the UI only offers valid moves. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "shipped", "delivered", "cancelled"],
  processing: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export default function OrdersPage() {
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Orders");
  const toast = useToast();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMISSIONS.ordersManage);
  const canExport = hasPermission(PERMISSIONS.salesExport);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [sort, setSort] = useState<"placed_at" | "total">("placed_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);
  if (channel) params.set("channel", channel);
  params.set("sort", sort);
  params.set("order", order);
  params.set("page", String(page));
  params.set("page_size", "25");
  const qs = params.toString();

  const { data, loading, error, refetch } = useApi<{ items: Order[]; total: number; page: number; pages: number }>(
    `/api/orders?${qs}`,
    `${qs}-${page}`
  );

  const toggleSort = (col: "placed_at" | "total") => {
    if (sort === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setOrder("desc");
    }
  };

  const setStatusMutation = useMutation(async ({ orderId, status }: { orderId: number; status: OrderStatus }) =>
    api.patch(`/api/orders/${orderId}/status`, { status })
  );

  const changeStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      await setStatusMutation.run({ orderId, status: newStatus });
      toast.success(`Order marked ${newStatus}`);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const headerSort = (col: "placed_at" | "total", label: string) => (
    <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-ink">
      {label}
      {sort === col && (order === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Search, filter and manage every order in your store."
        actions={
          <div className="flex items-center gap-2">
            {canExport && (
              <Button
                variant="outline"
                leftIcon={<Download className="h-4 w-4" />}
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    const exportParams = new URLSearchParams();
                    if (debouncedSearch) exportParams.set("search", debouncedSearch);
                    if (status) exportParams.set("status", status);
                    if (channel) exportParams.set("channel", channel);
                    await downloadCsv(`/api/orders/export?${exportParams.toString()}`, "orders.csv");
                    toast.success("Orders exported");
                  } catch (err) {
                    toast.error(apiErrorMessage(err));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                Export CSV
              </Button>
            )}
            {canManage && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                New order
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search order #, customer…" className="pl-9" aria-label="Search orders" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="w-40" aria-label="Filter by channel">
            <option value="">All channels</option>
            {(["online", "in_store", "wholesale", "partner"] as Channel[]).map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </Select>
        </div>

        {error ? (
          <ErrorState message="Unable to load orders." onRetry={refetch} className="py-10" />
        ) : loading ? (
          <div className="p-5"><SkeletonRows rows={8} /></div>
        ) : data && data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-2.5 font-semibold">{headerSort("placed_at", "Order")}</th>
                    <th className="px-5 py-2.5 font-semibold">Customer</th>
                    <th className="px-5 py-2.5 font-semibold">Channel</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold">{headerSort("total", "Total")}</th>
                    {canManage && <th className="px-5 py-2.5" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {data.items.map((o) => (
                    <tr key={o.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link to={`/app/orders/${o.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">{o.order_number}</Link>
                        <p className="text-xs text-muted">{formatDateTime(o.placed_at)}</p>
                      </td>
                      <td className="px-5 py-3">
                        {o.customer_id ? (
                          <Link to={`/app/customers/${o.customer_id}`} className="font-medium text-ink hover:text-primary-600 dark:hover:text-primary-400">{o.customer_name ?? "—"}</Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 capitalize text-muted">{o.channel.replace("_", " ")}</td>
                      <td className="px-5 py-3">
                        {canManage ? (
                          <Dropdown
                            width="w-44"
                            trigger={() => <OrderStatusBadge status={o.status} />}
                          >
                            {(close) => (
                              <>
                                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Change status</p>
                                {ALLOWED_TRANSITIONS[o.status].length === 0 && (
                                  <p className="px-3 pb-2 text-xs text-muted">This order is {o.status} — no further changes.</p>
                                )}
                                {ALLOWED_TRANSITIONS[o.status].map((s) => (
                                  <MenuItem key={s} onClick={() => { close(); void changeStatus(o.id, s); }} disabled={setStatusMutation.loading}>
                                    <span className="capitalize">{s}</span>
                                  </MenuItem>
                                ))}
                              </>
                            )}
                          </Dropdown>
                        ) : (
                          <OrderStatusBadge status={o.status} />
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-ink tabular">{fc(o.total, currency)}</td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            <Dropdown
                              width="w-48"
                              trigger={(open) => (
                                <button className={cn("rounded-md p-1.5 text-muted transition hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.08]", open && "bg-ink/[0.05] dark:bg-white/[0.08]")} aria-label={`Actions for ${o.order_number}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              )}
                            >
                              {(close) => (
                                <>
                                  <MenuItem onClick={() => { close(); navigate(`/app/orders/${o.id}`); }}>View details</MenuItem>
                                  {ALLOWED_TRANSITIONS[o.status].map((s) => (
                                    <MenuItem key={s} onClick={() => { close(); void changeStatus(o.id, s); }}>
                                      Mark as {s}
                                    </MenuItem>
                                  ))}
                                </>
                              )}
                            </Dropdown>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="No orders found"
            message={debouncedSearch || status || channel ? "Try adjusting your search or filters." : "Create your first order to get started."}
            action={canManage && !debouncedSearch && !status && !channel ? <Button size="sm" onClick={() => setCreateOpen(true)}>Create order</Button> : undefined}
          />
        )}
      </Card>

      {createOpen && <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); toast.success("Order created"); }} toastError={(err) => toast.error(apiErrorMessage(err))} />}
    </div>
  );
}

function CreateOrderModal({ open, onClose, onCreated, toastError }: { open: boolean; onClose: () => void; onCreated: () => void; toastError: (err: unknown) => void }) {
  const { me } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  const customers = useApi<{ items: Customer[] }>("/api/customers?page_size=100&sort=name&order=asc");
  const products = useApi<{ items: { id: number; name: string; price: number; stock: number }[] }>("/api/products?page_size=100&status=active&sort=name&order=asc");

  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState<Channel>("online");
  const [lines, setLines] = useState<{ product_id: string; quantity: string }[]>([{ product_id: "", quantity: "1" }]);
  const mutation = useMutation(async (payload: unknown) => api.post("/api/orders", payload));

  const addLine = () => setLines((l) => [...l, { product_id: "", quantity: "1" }]);
  const removeLine = (idx: number) => setLines((l) => (l.length > 1 ? l.filter((_, i) => i !== idx) : l));
  const setLine = (idx: number, key: "product_id" | "quantity", value: string) => setLines((l) => l.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = (products.data?.items ?? []).find((p) => String(p.id) === line.product_id);
        return sum + (product ? product.price * (Number(line.quantity) || 0) : 0);
      }, 0),
    [lines, products.data]
  );

  const submit = async () => {
    const items = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Math.max(1, Number(l.quantity) || 1) }));
    if (items.length === 0) {
      toastError(new Error("Add at least one product line."));
      return;
    }
    try {
      await mutation.run({ customer_id: customerId ? Number(customerId) : null, channel, items, status: "pending" });
      onCreated();
      onClose();
      setLines([{ product_id: "", quantity: "1" }]);
      setCustomerId("");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create order"
      description="Subtotal is computed from the catalog prices."
      size="lg"
      footer={
        <>
          <p className="mr-auto self-center text-sm text-muted">
            Subtotal <span className="font-semibold text-ink tabular">{fc(subtotal, currency)}</span>
          </p>
          <Button variant="outline" onClick={onClose} disabled={mutation.loading}>Cancel</Button>
          <Button onClick={() => void submit()} loading={mutation.loading}>Create order</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer" hint="Optional — walk-in orders work too">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in / guest</option>
              {(customers.data?.items ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {(["online", "in_store", "wholesale", "partner"] as Channel[]).map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink">Products</p>
            <button onClick={addLine} className="text-[13px] font-semibold text-primary-600 hover:underline dark:text-primary-400">+ Add line</button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={line.product_id} onChange={(e) => setLine(idx, "product_id", e.target.value)} className="flex-1" aria-label={`Product line ${idx + 1}`}>
                  <option value="">Select product…</option>
                  {(products.data?.items ?? []).map((p) => (
                    <option key={p.id} value={String(p.id)} disabled={p.stock <= 0}>
                      {p.name} — {fc(p.price, currency)} ({p.stock} in stock)
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => setLine(idx, "quantity", e.target.value)}
                  className="w-20 text-center"
                  aria-label={`Quantity line ${idx + 1}`}
                />
                <button onClick={() => removeLine(idx)} className="rounded-md p-1.5 text-muted hover:bg-ink/[0.05] hover:text-red-600 dark:hover:bg-white/[0.08]" aria-label={`Remove line ${idx + 1}`}>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        {products.error && <p className="text-xs text-red-500">{products.error}</p>}
      </div>
    </Modal>
  );
}
