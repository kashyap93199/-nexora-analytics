import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../contexts/ThemeContext";
import { formatCurrency } from "../lib/utils";

// Shared styling for a consistent look in both themes.
export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return useMemo(
    () => ({
      grid: dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.14)",
      axis: dark ? "#64748b" : "#94a3b8",
      text: dark ? "#94a3b8" : "#64748b",
      tooltipBg: dark ? "#0f1521" : "#ffffff",
      tooltipBorder: dark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)",
      cursor: dark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.08)",
    }),
    [dark]
  );
}

export const CHART_COLORS = {
  blue: "#2648e9",
  teal: "#0ea5a4",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#10b981",
  pink: "#ec4899",
  slate: "#64748b",
};

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string | number; currency?: string }) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-pop"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder, color: t.text }}
    >
      {label !== undefined && <p className="mb-1 font-semibold text-ink">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span className="capitalize">{entry.name}</span>
            <span className="ml-auto pl-4 font-semibold text-ink tabular">
              {currency !== undefined ? formatCurrency(Number(entry.value), currency) : Number(entry.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AXIS_TICKS = { fontSize: 11, fill: "#94a3b8" };

export function LineAreaChart({
  data,
  xKey,
  series,
  currency,
  height = 280,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; name: string; color: string; type?: "line" | "area" }[];
  currency?: string;
  height?: number;
}) {
  const t = useChartTheme();
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {series
            .filter((s) => s.type !== "line")
            .map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
        </defs>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={tooltip as never} cursor={{ stroke: t.cursor, strokeWidth: 1 }} />
        {series.map((s) =>
          s.type === "line" ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.2} fill={`url(#grad-${s.key})`} dot={false} activeDot={{ r: 4 }} />
          )
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data,
  xKey,
  bars,
  currency,
  height = 280,
  layout = "horizontal",
  stacked = false,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; name: string; color: string }[];
  currency?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
}) {
  const t = useChartTheme();
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (currency ? formatCurrency(v, currency, true) : String(v))} />
          <YAxis type="category" dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={130} />
          <Tooltip content={tooltip as never} cursor={{ fill: t.cursor }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[0, 5, 5, 0]} barSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
        <YAxis tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={tooltip as never} cursor={{ fill: t.cursor }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} stackId={stacked ? "a" : undefined} fill={b.color} radius={[4, 4, 0, 0]} barSize={stacked ? undefined : 22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const PALETTE = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.violet, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.green, CHART_COLORS.pink, CHART_COLORS.slate];

export function DonutChart({
  data,
  height = 240,
  currency,
}: {
  data: { name: string; value: number }[];
  height?: number;
  currency?: string;
}) {
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={tooltip as never} />
        {data.length > 0 && (
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-ink">
            <tspan className="text-lg font-bold" fill="currentColor">
              {currency ? formatCurrency(total, currency, true) : total.toLocaleString()}
            </tspan>
          </text>
        )}
        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-muted text-xs">
          Total
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
