import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, DollarSign, ShoppingBag, Target, TrendingUp, Users } from "lucide-react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { cn, formatCurrency as fc, formatNumber, timeAgo } from "../../lib/utils";
import type { Goal, Interval, OverviewResponse, SeriesPoint } from "../../types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from "../../components/ui/Feedback";
import { Segmented } from "../../components/ui/Tabs";
import { ProgressBar } from "../../components/ui/base";
import { StatCard } from "../../components/dashboard/StatCard";
import { WelcomeBanner } from "../../components/dashboard/WelcomeBanner";
import { OrderStatusBadge } from "../../components/ui/Badge";
import { ChartCard } from "../../charts/ChartCard";
import { CHART_COLORS, DonutChart, LineAreaChart, SimpleBarChart, useChartPalette } from "../../charts/index";


export default function OverviewPage() {
  const { range } = useDateRange();
  const { me } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Overview");

  // "auto" follows the granularity the server picked for the range (day for
  // short ranges, month for long ones); a manual pick re-queries the revenue series.
  const [intervalChoice, setIntervalChoice] = useState<Interval | "auto">("auto");
  const qs = `start=${range.start}&end=${range.end}`;
  const { data, loading, error, refetch } = useApi<OverviewResponse>(`/api/dashboard/overview?${qs}`, qs);
  const serverInterval: Interval = data?.range.interval ?? "month";
  const interval: Interval = intervalChoice === "auto" ? serverInterval : intervalChoice;
  const useBundledSeries = intervalChoice === "auto" || intervalChoice === serverInterval;
  const interactiveRevenue = useApi<{ interval: string; total: number; points: SeriesPoint[] }>(
    useBundledSeries ? null : `/api/analytics/revenue?${qs}&interval=${interval}`,
    `${qs}-${interval}-${useBundledSeries}`
  );

  if (error) {
    return <ErrorState message="Unable to load your dashboard overview." onRetry={refetch} className="mt-10" />;
  }

  const kpis = data?.kpis;

  const revenuePoints = (useBundledSeries ? data?.revenue_series.points : interactiveRevenue.data?.points) ?? [];
  const customerPoints = data?.customer_series.points ?? [];
  const bundledRevenue = data?.revenue_series.points ?? [];
  const revenueSpark = bundledRevenue.map((p) => p.value ?? 0);
  const ordersSpark = bundledRevenue.map((p) => p.count ?? 0);
  const customersSpark = customerPoints.map((p) => p.new ?? 0);
  const salesPoints = data?.sales_series.points ?? [];
  const conversionSpark = salesPoints.map((p) => (p.visitors ? ((p.conversions ?? 0) / p.visitors) * 100 : 0));
  const aovSpark = bundledRevenue.map((p) => (p.count ? (p.value ?? 0) / p.count : 0));
  const palette = useChartPalette();

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title={`Welcome back, ${me?.user.full_name.split(" ")[0] ?? "there"}`}
        description={`Here's how ${me?.organization.name} is performing ${range.label.toLowerCase()}.`}
        stat={!loading && kpis ? { label: "Revenue", value: fc(kpis.revenue, currency, kpis.revenue >= 100000) } : undefined}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard index={0} variant="hero" label="Revenue" value={kpis?.revenue ?? 0} delta={kpis?.revenue_change} currency={currency} loading={loading} icon={<DollarSign className="h-4 w-4" />} sparkline={revenueSpark} />
        <StatCard index={1} label="Orders" value={kpis?.orders ?? 0} kind="number" delta={kpis?.orders_change} loading={loading} icon={<ShoppingBag className="h-4 w-4" />} sparkline={ordersSpark} />
        <StatCard index={2} label="Customers" value={kpis?.total_customers ?? 0} kind="number" delta={kpis?.customers_change} loading={loading} icon={<Users className="h-4 w-4" />} hint={`${formatNumber(kpis?.new_customers ?? 0)} new in period`} sparkline={customersSpark} />
        <StatCard index={3} label="Conversion rate" value={kpis?.conversion_rate ?? 0} kind="percent" delta={kpis?.conversion_change} deltaSuffix=" pts" loading={loading} icon={<TrendingUp className="h-4 w-4" />} sparkline={conversionSpark} />
        <StatCard index={4} label="Avg. order value" value={kpis?.aov ?? 0} delta={kpis?.aov_change} currency={currency} loading={loading} icon={<Target className="h-4 w-4" />} sparkline={aovSpark} />
      </div>

      {/* Revenue + category donut */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue"
          subtitle={`Total ${fc(data?.revenue_series.total ?? 0, currency)} across the selected period`}
          loading={loading}
          height={330}
          actions={
            <Segmented<Interval | "auto">
              value={intervalChoice}
              onChange={setIntervalChoice}
              options={[
                { value: "auto", label: "Auto" },
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
                { value: "year", label: "Yearly" },
              ]}
            />
          }
        >
          {interactiveRevenue.loading && !useBundledSeries ? (
            <div className="flex h-full items-center justify-center"><Skeleton className="h-full w-full" /></div>
          ) : (
            <LineAreaChart
              data={revenuePoints.map((p) => ({ label: p.label, Revenue: p.value, Orders: p.count }))}
              xKey="label"
              currency={currency}
              height={290}
              series={[{ key: "Revenue", name: "Revenue", color: CHART_COLORS.blue }]}
            />
          )}
        </ChartCard>

        <ChartCard title="Revenue by category" subtitle="Share of revenue per category" loading={loading} height={330}>
          {data && data.revenue_by_category.length > 0 ? (
            <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[1fr_auto]">
              <DonutChart data={data.revenue_by_category} currency={currency} height={210} />
              <ul className="space-y-1.5 pr-2">
                {data.revenue_by_category.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-4 text-xs">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="h-2 w-2 rounded-full shadow-sm" style={{ background: palette[i % palette.length] }} />
                      {c.name}
                    </span>
                    <span className="font-semibold text-ink tabular">{fc(c.value, currency, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="No categorized revenue yet" message="Revenue will appear here once orders exist within the selected range." className="py-10" />
          )}
        </ChartCard>
      </div>

      {/* Customer growth + revenue by source */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Customer growth"
          subtitle="New vs returning customers (stacked) and cumulative total"
          loading={loading}
          height={310}
        >
          <SimpleBarChart
            data={customerPoints.map((p) => ({ label: p.label, New: p.new, Returning: p.returning }))}
            xKey="label"
            stacked
            height={270}
            bars={[
              { key: "New", name: "New customers", color: CHART_COLORS.blue },
              { key: "Returning", name: "Returning", color: "rgba(38,72,233,0.18)" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Revenue by source" subtitle="Orders, subscriptions & services" loading={loading} height={310}>
          {data && data.revenue_by_source.length > 0 ? (
            <DonutChart data={data.revenue_by_source} currency={currency} height={270} />
          ) : (
            <EmptyState title="No revenue records" message="Add revenue records to see the source breakdown." className="py-10" />
          )}
        </ChartCard>
      </div>

      {/* Top products + goals */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" hover>
          <CardHeader
            title="Top products"
            subtitle="Best performers in the selected period"
            actions={
              <Link to="/app/products" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-600 hover:underline dark:text-primary-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="divide-y divide-border/70">
            {loading ? (
              <div className="p-5"><SkeletonRows rows={4} /></div>
            ) : data && data.top_products.length > 0 ? (
              data.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-500/5">
                  <span className={cn("chip-3d flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", i === 0 ? "bg-primary-600 text-white" : "bg-ink/[0.04] text-muted dark:bg-white/[0.06]")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-muted">{p.category ?? "Uncategorized"}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-bold text-ink tabular">{formatNumber(p.units_sold)}</p>
                    <p className="text-xs text-muted">units</p>
                  </div>
                  <div className="w-24 text-right sm:w-28">
                    <p className="text-sm font-bold text-ink tabular">{fc(p.revenue, currency, true)}</p>
                    <p className={cn("text-xs font-semibold tabular", p.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {p.trend >= 0 ? "+" : ""}{p.trend.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No products sold yet" message="Orders in this period will list your top products here." />
            )}
          </div>
        </Card>

        {/* Goals panel */}
        <GoalsPanel />
      </div>

      {/* Recent orders */}
      <Card hover>
        <CardHeader
          title="Recent orders"
          subtitle="Latest activity across your store"
          actions={
            <Link to="/app/orders" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-600 hover:underline dark:text-primary-400">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {loading ? (
          <div className="p-5"><SkeletonRows rows={5} /></div>
        ) : data && data.recent_orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-semibold">Order</th>
                  <th className="px-5 py-2.5 font-semibold">Customer</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Placed</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.recent_orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3"><Link to={`/app/orders/${o.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">{o.order_number}</Link></td>
                    <td className="px-5 py-3 text-ink/90">{o.customer_name ?? "—"}</td>
                    <td className="px-5 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-muted">{timeAgo(o.placed_at)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink tabular">{fc(o.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No orders yet" message="Orders will appear here as your customers place them." />
        )}
      </Card>
    </div>
  );
}

/** Small reusable goals-with-progress panel used on Overview. */
export function GoalsPanel() {
  const goals = useApi<Goal[]>("/api/goals");
  const { me } = useAuth();
  const currency = me?.organization.currency ?? "USD";

  return (
    <Card hover>
      <CardHeader
        title="Goals"
        subtitle="Live progress this period"
        actions={
          <Link to="/app/goals" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-600 hover:underline dark:text-primary-400">
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <CardBody className="space-y-5">
        {goals.loading ? (
          <SkeletonRows rows={3} />
        ) : goals.error ? (
          <p className="py-4 text-center text-sm text-muted">Couldn't load goals.</p>
        ) : goals.data && goals.data.length > 0 ? (
          goals.data.slice(0, 4).map((goal) => {
            const pct = goal.progress_pct ?? 0;
            return (
              <div key={goal.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-ink">{goal.name}</p>
                  <p className="shrink-0 text-xs text-muted tabular">{pct.toFixed(1)}%</p>
                </div>
                <ProgressBar value={pct} />
                <p className="mt-1 text-[11px] text-muted tabular">
                  {goal.type === "revenue" || goal.type === "profit"
                    ? `${fc(goal.progress ?? 0, currency)} of ${fc(goal.target, currency)}`
                    : `${formatNumber(goal.progress ?? 0)} of ${formatNumber(goal.target)}`}
                </p>
              </div>
            );
          })
        ) : (
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="No active goals"
            message="Set a revenue target to start tracking progress here."
            action={
              <Link to="/app/goals"><span className="text-[13px] font-semibold text-primary-600 hover:underline dark:text-primary-400">Create a goal</span></Link>
            }
          />
        )}
      </CardBody>
    </Card>
  );
}
