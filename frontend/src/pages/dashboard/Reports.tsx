import { useMemo, useState } from "react";
import { Download, FileBarChart2, FileText, Plus, Trash2 } from "lucide-react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api, downloadCsv } from "../../services/api";
import { PERMISSIONS, type ReportDetail, type ReportSummary } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatDate, formatNumber } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/Form";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { Badge } from "../../components/ui/Badge";
import { PageHeader } from "../../components/ui/base";

const REPORT_TYPES = [
  { value: "sales", label: "Sales report", description: "Gross/net revenue, refunds, orders, AOV and conversion" },
  { value: "revenue", label: "Revenue report", description: "KPIs, monthly series, category and source breakdown" },
  { value: "customer", label: "Customer report", description: "Total/new/returning customers, retention and LTV" },
  { value: "product", label: "Product report", description: "Per-product units, revenue, profit, margin and trend" },
  { value: "performance", label: "Performance report", description: "Business-wide snapshot: KPIs, top products and regions" },
];

export default function ReportsPage() {
  const { range } = useDateRange();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Reports");
  const toast = useToast();
  const canCreate = hasPermission(PERMISSIONS.reportsCreate);

  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportSummary | null>(null);

  const list = useApi<ReportSummary[]>("/api/reports");
  const active = useApi<ReportDetail>(activeId ? `/api/reports/${activeId}` : null, activeId);

  const exportReport = async (report: ReportSummary) => {
    try {
      await downloadCsv(`/api/reports/${report.id}/export`, `${report.name.replace(/\s+/g, "-").toLowerCase()}.csv`);
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate, preview and export business reports over any date range."
        actions={
          canCreate && (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              New report
            </Button>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Saved reports list */}
        <Card className="xl:col-span-1">
          <CardHeader title="Saved reports" subtitle="Recently generated snapshots" />
          {list.loading ? (
            <div className="p-5"><SkeletonRows rows={5} /></div>
          ) : list.error ? (
            <ErrorState message="Unable to load reports." onRetry={list.refetch} className="py-8" />
          ) : list.data && list.data.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {list.data.map((report) => (
                <li key={report.id}>
                  <button
                    onClick={() => setActiveId(report.id)}
                    className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02] ${activeId === report.id ? "bg-primary-50/60 dark:bg-primary-500/[0.06]" : ""}`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] text-muted dark:bg-white/[0.06]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{report.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <Badge tone="blue">{report.type}</Badge>
                        <span>{formatDate(report.created_at)}</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted/80">by {report.created_by_name ?? "—"}</span>
                    </span>
                  </button>
                  <div className="flex justify-end gap-1 px-5 pb-2">
                    {canCreate && (
                      <>
                        <button onClick={() => void exportReport(report)} className="rounded p-1 text-muted hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.08]" aria-label={`Export ${report.name} as CSV`}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(report)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" aria-label={`Delete ${report.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<FileBarChart2 className="h-6 w-6" />}
              title="No reports yet"
              message="Generate a report and it will be stored here for quick re-export."
              action={canCreate ? <Button size="sm" onClick={() => setCreateOpen(true)}>Generate report</Button> : undefined}
            />
          )}
        </Card>

        {/* Preview pane */}
        <div className="xl:col-span-2">
          {active.data ? (
            <ReportPreview report={active.data} currency={currency} onExport={() => void exportReport({ id: active.data!.id, name: active.data!.name, type: active.data!.type, filters: {}, status: "ready", created_at: active.data!.created_at, created_by_name: null })} canExport={canCreate} />
          ) : (
            <Card className="flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <FileBarChart2 className="h-10 w-10 text-muted/40" />
              <h3 className="mt-3 text-sm font-semibold text-ink">Select a report to preview</h3>
              <p className="mt-1 max-w-sm text-[13px] text-muted">
                Choose a saved report on the left, or generate a new one — the preview renders the stored snapshot, ready for CSV export or PDF-style review.
              </p>
            </Card>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateReportModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          defaultRange={range}
          onCreated={(id) => {
            setActiveId(id);
            list.refetch();
          }}
          toastError={(err) => toast.error(apiErrorMessage(err))}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete report"
        message={<>Delete <strong>{deleteTarget?.name}</strong>? The stored snapshot and CSV export will be removed.</>}
        confirmLabel="Delete report"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void api
            .delete(`/api/reports/${deleteTarget.id}`)
            .then(() => {
              toast.success("Report deleted");
              if (activeId === deleteTarget.id) setActiveId(null);
              setDeleteTarget(null);
              list.refetch();
            })
            .catch((err) => toast.error(apiErrorMessage(err)));
        }}
      />
    </div>
  );
}

function CreateReportModal({
  open,
  onClose,
  defaultRange,
  onCreated,
  toastError,
}: {
  open: boolean;
  onClose: () => void;
  defaultRange: { start: string; end: string; label: string };
  onCreated: (id: number) => void;
  toastError: (err: unknown) => void;
}) {
  const [type, setType] = useState("sales");
  const [name, setName] = useState("");
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const meta = REPORT_TYPES.find((t) => t.value === type)!;
  const suggestedName = useMemo(() => {
    const t = REPORT_TYPES.find((r) => r.value === type);
    return `${t ? t.label.replace(" report", "") : ""} ${start} → ${end}`;
  }, [type, start, end]);

  const generate = async () => {
    if (!start || !end || start > end) {
      setError("Choose a valid date range.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const report = await api.post<{ id: number }>("/api/reports", { name: name.trim() || suggestedName, type, start_date: start, end_date: end, filters: {} });
      onCreated(report.id);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate report"
      description="A snapshot is computed now and stored for later export."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={() => void generate()} loading={generating} leftIcon={!generating ? <FileBarChart2 className="h-4 w-4" /> : undefined}>Generate report</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <Field label="Report type">
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`rounded-xl border p-3.5 text-left transition ${type === t.value ? "border-primary-500 bg-primary-50/60 ring-1 ring-primary-500 dark:bg-primary-500/[0.07]" : "border-border hover:border-primary-300 dark:hover:border-primary-500/40"}`}
              >
                <p className="text-sm font-semibold text-ink">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted">{t.description}</p>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Report name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestedName} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End date" required>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-muted dark:bg-white/[0.05]">
          {meta.description}. Includes: <span className="capitalize">{meta.value}</span> snapshot over {start} → {end}.
        </p>
      </div>
    </Modal>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 px-3.5 py-2.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13px] font-semibold text-ink tabular">{value}</span>
    </div>
  );
}

function ReportPreview({ report, currency, onExport, canExport }: { report: ReportDetail; currency: string; onExport: () => void; canExport: boolean }) {
  const data = report.data as Record<string, any>;
  const kpis = (data?.kpis ?? {}) as Record<string, number>;
  const products = (data?.products ?? []) as Record<string, any>[];
  const byCategory = (data?.by_category ?? []) as { name: string; value: number }[];
  const topProducts = (data?.top_products ?? []) as Record<string, any>[];
  const regions = (data?.geographic ?? []) as { region: string; orders: number; revenue: number }[];
  const metrics = (data?.metrics ?? {}) as Record<string, number>;
  const customerMetrics = (data?.customer_metrics ?? {}) as Record<string, unknown>;
  const seriesPoints = ((data?.series?.points as { label: string; value?: number; count?: number }[] | undefined) ?? []);

  const totalRevenue = products.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const totalProfit = products.reduce((s, p) => s + (p.profit ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">{report.name}</h2>
              <Badge tone="blue">{report.type}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {typeof report.filters.start === "string" ? `${report.filters.start} → ${report.filters.end ?? ""}` : ""} · Generated {formatDate(report.created_at)} · Ready for PDF-style review
            </p>
          </div>
          {canExport && (
            <Button variant="outline" size="sm" onClick={onExport} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
          )}
        </div>
      </Card>

      {report.type === "product" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-semibold">Product</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Units</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Profit</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {products.slice(0, 12).map((p, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5 font-medium text-ink">{p.name}</td>
                    <td className="px-5 py-2.5 text-right tabular text-ink">{formatNumber(p.units_sold ?? 0)}</td>
                    <td className="px-5 py-2.5 text-right tabular text-ink">{fc(p.revenue ?? 0, currency)}</td>
                    <td className="px-5 py-2.5 text-right tabular text-emerald-600 dark:text-emerald-400">{fc(p.profit ?? 0, currency)}</td>
                    <td className="px-5 py-2.5 text-right tabular text-ink">{(p.margin ?? 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-border p-4 text-center">
            <div><p className="text-lg font-bold text-ink tabular">{fc(totalRevenue, currency)}</p><p className="text-xs text-muted">Revenue (top 12)</p></div>
            <div><p className="text-lg font-bold text-ink tabular">{fc(totalProfit, currency)}</p><p className="text-xs text-muted">Profit (top 12)</p></div>
            <div><p className="text-lg font-bold text-ink tabular">{products.length}</p><p className="text-xs text-muted">Products ranked</p></div>
          </div>
        </Card>
      )}

      {report.type === "revenue" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(kpis).filter(([k]) => ["revenue", "orders", "aov", "conversion_rate", "profit", "new_customers"].includes(k)).map(([k, v]) => (
              <MetricRow key={k} label={k.replace(/_/g, " ")} value={typeof v === "number" ? (k.includes("rate") ? `${v}%` : fc(v, currency)) : String(v)} />
            ))}
          </div>
          {seriesPoints.length > 0 && (
            <Card>
              <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold text-ink">Monthly revenue</h3></div>
              <div className="divide-y divide-border/70">
                {seriesPoints.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2 text-sm">
                    <span className="text-muted">{p.label}</span>
                    <span className="font-semibold text-ink tabular">{fc(p.value ?? 0, currency)} · {p.count ?? 0} orders</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {byCategory.length > 0 && (
            <Card>
              <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold text-ink">Revenue by category</h3></div>
              <div className="flex flex-wrap gap-2 p-4">
                {byCategory.map((c) => (
                  <span key={c.name} className="rounded-lg border border-border px-3 py-1.5 text-[13px]">
                    <span className="font-medium text-ink">{c.name}</span>{" "}
                    <span className="text-muted">{fc(c.value, currency)}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {(report.type === "sales" || report.type === "customer") && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Object.entries(report.type === "sales" ? metrics : customerMetrics).filter(([k]) => !["segments"].includes(k)).map(([k, v]) => {
            const numeric = typeof v === "number";
            const isMoney = ["revenue", "refunds", "aov", "lifetime"].some((s) => k.includes(s));
            return (
              <MetricRow
                key={k}
                label={k.replace(/_/g, " ")}
                value={!numeric ? String(v) : isMoney ? fc(v, currency) : k.includes("rate") ? `${Number(v).toFixed(1)}%` : formatNumber(Number(v))}
              />
            );
          })}
        </div>
      )}

      {report.type === "performance" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(kpis).filter(([k]) => ["revenue", "orders", "profit", "conversion_rate"].includes(k)).map(([k, v]) => (
              <MetricRow key={k} label={k.replace(/_/g, " ")} value={typeof v === "number" ? (k.includes("rate") ? `${v}%` : fc(v, currency)) : String(v)} />
            ))}
          </div>
          {topProducts.length > 0 && (
            <Card>
              <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold text-ink">Top products</h3></div>
              <div className="divide-y divide-border/70">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-ink">{i + 1}. {p.name}</span>
                    <span className="text-muted">{formatNumber(p.units_sold ?? 0)} units · {fc(p.revenue ?? 0, currency)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {regions.length > 0 && (
            <Card>
              <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold text-ink">Regions</h3></div>
              <div className="divide-y divide-border/70">
                {regions.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-ink">{r.region}</span>
                    <span className="text-muted">{formatNumber(r.orders)} orders · {fc(r.revenue, currency)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <p className="flex items-center gap-2 text-xs text-muted">
        <FileText className="h-3.5 w-3.5" /> Snapshot-based report — filters shown above were applied at generation time.
      </p>
    </div>
  );
}
