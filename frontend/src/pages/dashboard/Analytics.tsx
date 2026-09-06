import { useState } from "react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { formatCurrency as fc, formatNumber } from "../../lib/utils";
import type { CustomerMetrics, Interval, SalesMetrics, SeriesPoint } from "../../types";
import { ErrorState, EmptyState } from "../../components/ui/Feedback";
import { Segmented } from "../../components/ui/Tabs";
import { PageHeader } from "../../components/ui/base";
import { ChartCard } from "../../charts/ChartCard";
import { CHART_COLORS, DonutChart, LineAreaChart, SimpleBarChart } from "../../charts/index";


interface CustomerSeriesResponse {
  metrics: CustomerMetrics;
  series: { points: SeriesPoint[] };
}
interface SalesResponse {
  metrics: SalesMetrics;
  series: { points: SeriesPoint[]; totals: Record<string, number> };
}

export default function AnalyticsPage() {
  const { range } = useDateRange();
  const { me } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Analytics");

  const [revInterval, setRevInterval] = useState<Interval>("month");
  const [salesInterval, setSalesInterval] = useState<Interval>("month");
  const [customerInterval, setCustomerInterval] = useState<Interval>("month");
  const [chartStyle, setChartStyle] = useState<"area" | "line">("area");

  const qs = `start=${range.start}&end=${range.end}`;
  const revenue = useApi<{ interval: string; total: number; points: SeriesPoint[] }>(`/api/analytics/revenue?${qs}&interval=${revInterval}`, `${qs}-rev-${revInterval}`);
  const sales = useApi<SalesResponse>(`/api/analytics/sales?${qs}&interval=${salesInterval}`, `${qs}-sales-${salesInterval}`);
  const customers = useApi<CustomerSeriesResponse>(`/api/analytics/customers?${qs}&interval=${customerInterval}`, `${qs}-cust-${customerInterval}`);
  const categories = useApi<{ by_category: { name: string; value: number }[] }>(`/api/analytics/categories?${qs}`, qs);
  const geo = useApi<{ regions: { region: string; orders: number; revenue: number }[] }>(`/api/analytics/geographic?${qs}`, qs);

  if (revenue.error || sales.error) {
    return <ErrorState message="Unable to load analytics. Please try again." onRetry={() => { revenue.refetch(); sales.refetch(); }} className="mt-10" />;
  }

  const metricTiles = [
    { label: "Gross revenue", value: fc(sales.data?.metrics.gross_revenue ?? 0, currency) },
    { label: "Net revenue", value: fc(sales.data?.metrics.net_revenue ?? 0, currency) },
    { label: "Units sold", value: formatNumber(sales.data?.metrics.units_sold ?? 0) },
    { label: "Orders", value: formatNumber(sales.data?.metrics.orders ?? 0) },
    { label: "Avg. order value", value: fc(sales.data?.metrics.aov ?? 0, currency) },
    { label: "Conversion", value: `${(sales.data?.metrics.conversion_rate ?? 0).toFixed(2)}%` },
  ];

  const customerMetrics = customers.data?.metrics;
  const cmTiles = [
    { label: "Total customers", value: formatNumber(customerMetrics?.total_customers ?? 0) },
    { label: "New in period", value: formatNumber(customerMetrics?.new_customers ?? 0) },
    { label: "Returning", value: formatNumber(customerMetrics?.returning_customers ?? 0) },
    { label: "Retention", value: `${customerMetrics?.retention_rate ?? 0}%` },
    { label: "Lifetime value", value: fc(customerMetrics?.avg_lifetime_value ?? 0, currency) },
    { label: "Order frequency", value: `${customerMetrics?.avg_order_frequency ?? 0}/mo` },
  ];

  const salesTotals = sales.data?.series.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Dive into revenue, sales, customer and category trends for the selected period." />

      {/* Revenue chart */}
      <ChartCard
        title="Revenue over time"
        subtitle={`Daily/weekly/monthly/yearly totals · ${fc(revenue.data?.total ?? 0, currency)} in period`}
        loading={revenue.loading}
        height={380}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<"area" | "line">
              value={chartStyle}
              onChange={setChartStyle}
              options={[{ value: "area", label: "Area" }, { value: "line", label: "Line" }]}
            />
            <Segmented<Interval>
              value={revInterval}
              onChange={setRevInterval}
              options={[{ value: "day", label: "D" }, { value: "week", label: "W" }, { value: "month", label: "M" }, { value: "year", label: "Y" }]}
            />
          </div>
        }
      >
        <LineAreaChart
          data={(revenue.data?.points ?? []).map((p) => ({ label: p.label, Revenue: p.value, Orders: p.count }))}
          xKey="label"
          currency={currency}
          height={335}
          series={[{ key: "Revenue", name: "Revenue", color: CHART_COLORS.blue, type: chartStyle === "line" ? "line" : "area" }]}
        />
      </ChartCard>

      {/* Sales metric tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {metricTiles.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-ink tabular">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Sales over time + category donut */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Sales vs refunds"
          subtitle={`Gross ${fc(salesTotals?.gross ?? 0, currency)} · Refunds ${fc(salesTotals?.refunds ?? 0, currency)} · Visitors ${formatNumber(salesTotals?.visitors ?? 0)}`}
          loading={sales.loading}
          height={340}
          actions={
            <Segmented<Interval>
              value={salesInterval}
              onChange={setSalesInterval}
              options={[{ value: "day", label: "D" }, { value: "week", label: "W" }, { value: "month", label: "M" }, { value: "year", label: "Y" }]}
            />
          }
        >
          <LineAreaChart
            data={(sales.data?.series.points ?? []).map((p) => ({ label: p.label, Gross: p.gross, Refunds: p.refunds }))}
            xKey="label"
            currency={currency}
            height={295}
            series={[
              { key: "Gross", name: "Gross revenue", color: CHART_COLORS.blue, type: "area" },
              { key: "Refunds", name: "Refunds", color: CHART_COLORS.red, type: "line" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Revenue by category" subtitle="Where revenue comes from" loading={categories.loading} height={340}>
          {categories.data && categories.data.by_category.length > 0 ? (
            <DonutChart data={categories.data.by_category} currency={currency} height={300} />
          ) : (
            <EmptyState title="No data in range" message="Extend the date range to see category breakdowns." className="py-10" />
          )}
        </ChartCard>
      </div>

      {/* Customer growth + customer metrics */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Customer growth"
          subtitle="New and returning customers per period"
          loading={customers.loading}
          height={330}
          actions={
            <Segmented<Interval>
              value={customerInterval}
              onChange={setCustomerInterval}
              options={[{ value: "day", label: "D" }, { value: "week", label: "W" }, { value: "month", label: "M" }, { value: "year", label: "Y" }]}
            />
          }
        >
          <SimpleBarChart
            data={(customers.data?.series.points ?? []).map((p) => ({ label: p.label, New: p.new, Returning: p.returning }))}
            xKey="label"
            stacked
            height={285}
            bars={[
              { key: "New", name: "New", color: CHART_COLORS.blue },
              { key: "Returning", name: "Returning", color: "rgba(38,72,233,0.16)" },
            ]}
          />
        </ChartCard>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3.5"><h3 className="text-sm font-semibold text-ink">Customer metrics</h3></div>
            <div className="grid grid-cols-2 gap-px bg-border/60">
              {cmTiles.map((m) => (
                <div key={m.label} className="bg-card px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">{m.label}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-ink tabular">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
          <ChartCard title="Customer segments" subtitle="All-time distribution" height={190}>
            {customerMetrics && Object.values(customerMetrics.segments).some((v) => v > 0) ? (
              <DonutChart
                height={150}
                data={[
                  { name: "VIP", value: customerMetrics.segments.vip },
                  { name: "Returning", value: customerMetrics.segments.returning },
                  { name: "New", value: customerMetrics.segments.new },
                  { name: "Inactive", value: customerMetrics.segments.inactive },
                ]}
              />
            ) : (
              <EmptyState title="No customers yet" className="py-8" />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Geographic performance */}
      <ChartCard title="Geographic performance" subtitle="Revenue and orders by region" loading={geo.loading} height={360}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <ul className="space-y-1 overflow-y-auto pr-2" style={{ maxHeight: 300 }}>
            {(geo.data?.regions ?? []).map((region, i) => (
              <li key={region.region} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink/[0.04] text-[11px] font-bold text-muted dark:bg-white/[0.06]">{i + 1}</span>
                <span className="flex-1 truncate font-medium text-ink">{region.region}</span>
                <span className="text-xs text-muted">{formatNumber(region.orders)} orders</span>
                <span className="w-24 text-right font-semibold text-ink tabular">{fc(region.revenue, currency, true)}</span>
              </li>
            ))}
            {(geo.data?.regions ?? []).length === 0 && <li className="py-8 text-center text-sm text-muted">No regional data in this range.</li>}
          </ul>
          <SimpleBarChart
            layout="vertical"
            data={(geo.data?.regions ?? []).map((r) => ({ label: r.region, Revenue: r.revenue }))}
            xKey="label"
            currency={currency}
            height={320}
            bars={[{ key: "Revenue", name: "Revenue", color: CHART_COLORS.violet }]}
          />
        </div>
      </ChartCard>
    </div>
  );
}
