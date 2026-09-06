import { useMemo, useState } from "react";
import { Download, FilterX } from "lucide-react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { api, downloadCsv } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { PERMISSIONS, type SalesMetrics, type SeriesPoint } from "../../types";
import { formatCurrency as fc, formatNumber } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Form";
import { ErrorState, EmptyState } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/base";
import { ChartCard } from "../../charts/ChartCard";
import { CHART_COLORS, LineAreaChart, SimpleBarChart } from "../../charts/index";

interface SalesResponse {
  metrics: SalesMetrics;
  series: { points: SeriesPoint[]; totals: Record<string, number> };
}

export default function SalesPage() {
  const { range } = useDateRange();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  const toast = useToast();
  useDocumentTitle("Sales");

  const [region, setRegion] = useState("");
  const [channel, setChannel] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [interval, setInterval] = useState<"day" | "week" | "month" | "year">("month");
  const [exporting, setExporting] = useState(false);

  const products = useApi<{ items: { id: number; name: string }[] }>("/api/products?page_size=200");
  const categories = useApi<{ id: number; name: string }[]>("/api/categories");

  const filters = useMemo(() => {
    const params = new URLSearchParams({ start: range.start, end: range.end, interval });
    if (region) params.set("region", region);
    if (channel) params.set("channel", channel);
    if (productId) params.set("product_id", productId);
    if (categoryId) params.set("category_id", categoryId);
    return params.toString();
  }, [range, region, channel, productId, categoryId, interval]);

  const { data, loading, error, refetch } = useApi<SalesResponse>(`/api/analytics/sales?${filters}`, filters);

  const canExport = hasPermission(PERMISSIONS.salesExport);

  const exportCsv = async () => {
    setExporting(true);
    try {
      // Generate a report snapshot, then stream its CSV.
      const report = await api.post<{ id: number }>("/api/reports", {
        name: `Sales ${range.label}${region ? ` · ${region}` : ""}`,
        type: "sales",
        start_date: range.start,
        end_date: range.end,
        filters: { region, channel, product_id: productId || undefined, category_id: categoryId || undefined },
      });
      await downloadCsv(`/api/reports/${report.id}/export`, `sales-report-${range.start}-to-${range.end}.csv`);
      toast.success("Sales report exported as CSV");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setRegion("");
    setChannel("");
    setProductId("");
    setCategoryId("");
  };

  const hasActiveFilters = Boolean(region || channel || productId || categoryId);
  const m = data?.metrics;
  const totals = data?.series.totals;

  const tiles = [
    { label: "Gross revenue", value: fc(m?.gross_revenue ?? 0, currency), sub: `Visitors ${formatNumber(totals?.visitors ?? 0)}` },
    { label: "Net revenue", value: fc(m?.net_revenue ?? 0, currency), sub: "After refunds" },
    { label: "Refunds", value: fc(m?.refunds ?? 0, currency), sub: "" },
    { label: "Orders", value: formatNumber(m?.orders ?? 0), sub: "" },
    { label: "Avg. order value", value: fc(m?.aov ?? 0, currency), sub: "Net ÷ orders" },
    { label: "Conversion rate", value: `${(m?.conversion_rate ?? 0).toFixed(2)}%`, sub: `${formatNumber(m?.conversions ?? 0)} conversions` },
    { label: "Units sold", value: formatNumber(m?.units_sold ?? 0), sub: "" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales analytics"
        description="Revenue, volume and conversion for the selected filters."
        actions={
          canExport && (
            <Button variant="outline" size="md" loading={exporting} onClick={() => void exportCsv()} leftIcon={!exporting ? <Download className="h-4 w-4" /> : undefined}>
              Export CSV
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="s-region">Region</label>
          <Select id="s-region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa"].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="s-channel">Channel</label>
          <Select id="s-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All channels</option>
            {["online", "in_store", "wholesale", "partner"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-52">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="s-cat">Category</label>
          <Select id="s-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-64">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="s-prod">Product</label>
          <Select id="s-prod" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {(products.data?.items ?? []).map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<FilterX className="h-4 w-4" />} className="mb-0.5">
            Clear
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message="Unable to load sales analytics. Please try again." onRetry={refetch} className="mt-10" />
      ) : (
        <>
          {/* Metric tiles */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
            {tiles.map((tile) => (
              <div key={tile.label} className="card-3d rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted">{tile.label}</p>
                <p className="mt-1 truncate text-lg font-bold text-ink tabular">{tile.value}</p>
                {tile.sub && <p className="truncate text-[11px] text-muted/80">{tile.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart */}
          <ChartCard
            title="Sales over time"
            subtitle={`Gross ${fc(totals?.gross ?? 0, currency)} · Net ${fc(totals?.net ?? 0, currency)} · Refunds ${fc(totals?.refunds ?? 0, currency)}`}
            loading={loading}
            height={380}
            actions={
              <div className="flex flex-wrap gap-2">
                {(["day", "week", "month", "year"] as const).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${interval === iv ? "bg-primary-600 text-white" : "text-muted hover:bg-ink/[0.05] dark:hover:bg-white/[0.08]"}`}
                  >
                    {iv[0].toUpperCase() + iv.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            {data && data.series.points.length > 0 ? (
              <LineAreaChart
                data={(data.series.points ?? []).map((p) => ({ label: p.label, "Gross revenue": p.gross, "Net revenue": p.net, Refunds: p.refunds }))}
                xKey="label"
                currency={currency}
                height={335}
                series={[
                  { key: "Gross revenue", name: "Gross", color: CHART_COLORS.blue, type: "area" },
                  { key: "Net revenue", name: "Net", color: CHART_COLORS.teal, type: "line" },
                  { key: "Refunds", name: "Refunds", color: CHART_COLORS.red, type: "line" },
                ]}
              />
            ) : (
              <EmptyState title="No sales in this range" message="Try widening the date range or clearing filters." className="py-14" />
            )}
          </ChartCard>

          {/* Traffic & conversion chart — computed from sales records */}
          <ChartCard
            title="Traffic & conversions"
            subtitle={`Visitors ${formatNumber(totals?.visitors ?? 0)} · Conversions ${formatNumber(totals?.conversions ?? 0)} · Rate ${(((totals?.conversions ?? 0) / (totals?.visitors || 1)) * 100).toFixed(2)}%`}
            loading={loading}
            height={300}
          >
            <SimpleBarChart
              data={(data?.series.points ?? []).map((p) => ({ label: p.label, Visitors: p.visitors, Conversions: p.conversions }))}
              xKey="label"
              height={260}
              bars={[
                { key: "Visitors", name: "Visitors", color: "rgba(38,72,233,0.25)" },
                { key: "Conversions", name: "Conversions", color: CHART_COLORS.blue },
              ]}
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}
