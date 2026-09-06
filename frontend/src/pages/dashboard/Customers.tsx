import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, UserPlus, Users } from "lucide-react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDebounced, useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api, downloadCsv } from "../../services/api";
import { PERMISSIONS, type Customer, type CustomerMetrics } from "../../types";
import { formatCurrency as fc, formatDate, formatNumber, apiErrorMessage } from "../../lib/utils";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { SegmentBadge } from "../../components/ui/Badge";
import { Pagination } from "../../components/ui/Pagination";
import { Avatar, PageHeader } from "../../components/ui/base";
import { LineAreaChart } from "../../charts/index";
import { CHART_COLORS } from "../../charts/index";
import type { SeriesPoint } from "../../types";

export default function CustomersPage() {
  const { range } = useDateRange();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Customers");
  const toast = useToast();
  const canManage = hasPermission(PERMISSIONS.customersManage);
  const canExport = hasPermission(PERMISSIONS.salesExport);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [segment, setSegment] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (segment) params.set("segment", segment);
  params.set("page", String(page));
  params.set("page_size", "25");
  const qs = params.toString();

  const list = useApi<{ items: Customer[]; total: number; page: number; pages: number }>(`/api/customers?${qs}`, `${qs}-${page}`);
  const analytics = useApi<{ metrics: CustomerMetrics; series: { points: SeriesPoint[] } }>(
    `/api/analytics/customers?start=${range.start}&end=${range.end}&interval=month`,
    `${range.start}-${range.end}`
  );

  const createMutation = useMutation(async (payload: { name: string; email: string; region?: string; city?: string }) => {
    return api.post("/api/customers", payload);
  });

  const segmentCounts = analytics.data?.metrics.segments;
  const metricTiles = [
    { label: "Total customers", value: formatNumber(analytics.data?.metrics.total_customers ?? 0) },
    { label: "New this period", value: formatNumber(analytics.data?.metrics.new_customers ?? 0) },
    { label: "Returning", value: formatNumber(analytics.data?.metrics.returning_customers ?? 0) },
    { label: "Retention rate", value: `${analytics.data?.metrics.retention_rate ?? 0}%` },
    { label: "Lifetime value", value: fc(analytics.data?.metrics.avg_lifetime_value ?? 0, currency) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Search your customer base and understand segments, spending and activity."
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
                    if (segment) exportParams.set("segment", segment);
                    await downloadCsv(`/api/customers/export?${exportParams.toString()}`, "customers.csv");
                    toast.success("Customers exported");
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
              <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Add customer
              </Button>
            )}
          </div>
        }
      />

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {metricTiles.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-ink tabular">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Growth chart + segment distribution */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Customer growth</h3>
            <p className="mt-0.5 text-[13px] text-muted">New customers per month in the selected range</p>
          </div>
          <div className="p-4">
            {analytics.loading ? (
              <SkeletonRows rows={3} />
            ) : (
              <LineAreaChart
                data={(analytics.data?.series.points ?? []).map((p) => ({ label: p.label, "New customers": p.new }))}
                xKey="label"
                height={240}
                series={[{ key: "New customers", name: "New customers", color: CHART_COLORS.blue }]}
              />
            )}
          </div>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Segments</h3>
            <p className="mt-0.5 text-[13px] text-muted">All customers, by segment</p>
          </div>
          <div className="space-y-3 p-5">
            {(["new", "returning", "vip", "inactive"] as const).map((seg) => {
              const count = segmentCounts?.[seg] ?? 0;
              const total = analytics.data?.metrics.total_customers || 1;
              return (
                <button key={seg} onClick={() => setSegment(segment === seg ? "" : seg)} className="w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="font-medium capitalize text-ink">{seg}</span>
                    <span className="text-muted tabular">{formatNumber(count)} · {((count / total) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink/[0.06] dark:bg-white/[0.08]">
                    <div
                      className={`h-full rounded-full ${seg === "vip" ? "bg-violet-500" : seg === "returning" ? "bg-teal-500" : seg === "new" ? "bg-blue-500" : "bg-slate-400"}`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
            <p className="pt-2 text-[11px] text-muted">Segments are derived from purchase history &amp; recency. Click to filter the table.</p>
          </div>
        </Card>
      </div>

      {/* Customer table */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="pl-9" aria-label="Search customers" />
          </div>
          <Select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }} className="w-44" aria-label="Filter by segment">
            <option value="">All segments</option>
            <option value="new">New</option>
            <option value="returning">Returning</option>
            <option value="vip">VIP</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        {list.error ? (
          <ErrorState message="Unable to load customers." onRetry={list.refetch} className="py-10" />
        ) : list.loading ? (
          <div className="p-5"><SkeletonRows rows={6} /></div>
        ) : list.data && list.data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-2.5 font-semibold">Customer</th>
                    <th className="px-5 py-2.5 font-semibold">Segment</th>
                    <th className="px-5 py-2.5 font-semibold">Region</th>
                    <th className="px-5 py-2.5 font-semibold">Orders</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Total spent</th>
                    <th className="px-5 py-2.5 font-semibold">Last purchase</th>
                    <th className="px-5 py-2.5 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {list.data.items.map((c) => (
                    <tr key={c.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link to={`/app/customers/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={c.name} size="sm" />
                          <span>
                            <span className="block font-medium text-ink hover:text-primary-600 dark:hover:text-primary-400">{c.name}</span>
                            <span className="block text-xs text-muted">{c.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3"><SegmentBadge segment={c.segment} /></td>
                      <td className="px-5 py-3 text-muted">{c.region ?? "—"}</td>
                      <td className="px-5 py-3 tabular text-ink">{c.order_count ?? 0}</td>
                      <td className="px-5 py-3 text-right font-semibold text-ink tabular">{fc(c.total_spent ?? 0, currency)}</td>
                      <td className="px-5 py-3 text-muted">{formatDate(c.last_order_at)}</td>
                      <td className="px-5 py-3 text-muted">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No customers found"
            message={debouncedSearch || segment ? "Try a different search or clear the segment filter." : "Add your first customer to get started."}
          />
        )}
      </Card>

      {/* Create customer modal */}
      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          list.refetch();
          analytics.refetch();
        }}
        mutate={createMutation}
        toastError={(err) => toast.error(apiErrorMessage(err))}
        toastSuccess={(msg) => toast.success(msg)}
      />
    </div>
  );
}

function CreateCustomerModal({
  open,
  onClose,
  onCreated,
  mutate,
  toastError,
  toastSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  mutate: ReturnType<typeof useMutation<{ name: string; email: string; region?: string; city?: string }, unknown>>;
  toastError: (err: unknown) => void;
  toastSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", region: "", city: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await mutate.run({ ...form, region: form.region || undefined, city: form.city || undefined });
      toastSuccess("Customer created");
      setForm({ name: "", email: "", region: "", city: "" });
      onCreated();
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add customer"
      description="Create a customer record for your organization."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutate.loading}>Cancel</Button>
          <Button type="submit" form="create-customer-form" loading={mutate.loading}>Create customer</Button>
        </>
      }
    >
      <form id="create-customer-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label="Full name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Cooper" />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Region">
            <Select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}>
              <option value="">Select…</option>
              {["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa"].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Austin" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
