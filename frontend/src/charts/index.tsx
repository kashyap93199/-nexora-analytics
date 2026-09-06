import { useEffect, useMemo, useState } from "react";
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

function cssVarRgb(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw.split(/\s+/).join(", ")})` : fallback;
}

/** Live accent colours resolved from the CSS variables set by the theme (re-read when accent changes). */
export function useAccentColors() {
  const { accent } = useTheme();
  const [colors, setColors] = useState(() => ({
    primary: cssVarRgb("--primary-600", CHART_COLORS.blue),
    primaryLight: cssVarRgb("--primary-400", "#628ef9"),
    secondary: cssVarRgb("--accent-2", CHART_COLORS.violet),
  }));
  useEffect(() => {
    // The data-accent attribute is applied in an effect too; read after paint.
    const id = requestAnimationFrame(() =>
      setColors({
        primary: cssVarRgb("--primary-600", CHART_COLORS.blue),
        primaryLight: cssVarRgb("--primary-400", "#628ef9"),
        secondary: cssVarRgb("--accent-2", CHART_COLORS.violet),
      })
    );
    return () => cancelAnimationFrame(id);
  }, [accent]);
  return colors;
}

// Shared styling for a consistent look in both themes.
export function useChartTheme() {
  const { theme, depth } = useTheme();
  const dark = theme === "dark";
  return useMemo(
    () => ({
      dark,
      depth,
      grid: dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.14)",
      axis: dark ? "#64748b" : "#94a3b8",
      text: dark ? "#94a3b8" : "#64748b",
      tooltipBg: dark ? "rgba(15,21,33,0.92)" : "rgba(255,255,255,0.92)",
      tooltipBorder: dark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)",
      cursor: dark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.08)",
    }),
    [dark, depth]
  );
}

/**
 * Named chart colours. `blue` / `violet` are sentinel values that get swapped for
 * the live accent palette at render time, so charts follow the user's accent.
 */
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

function useResolveColor() {
  const accent = useAccentColors();
  return (color: string) => (color === CHART_COLORS.blue ? accent.primary : color === CHART_COLORS.violet ? accent.secondary : color);
}

/** SVG filter defs for the soft glow used in depth mode. */
function GlowDefs({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} x="-20%" y="-50%" width="140%" height="200%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={color} floodOpacity="0.35" />
    </filter>
  );
}

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string | number; currency?: string }) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-depth backdrop-blur-md"
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
  const resolve = useResolveColor();
  const resolved = series.map((s) => ({ ...s, color: resolve(s.color) }));
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {resolved
            .filter((s) => s.type !== "line")
            .map((s) => (
              <linearGradient key={s.key} id={`grad-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={t.depth ? 0.38 : 0.22} />
                <stop offset="60%" stopColor={s.color} stopOpacity={t.depth ? 0.1 : 0.06} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          {t.depth && resolved.map((s) => <GlowDefs key={s.key} id={`glow-${uid}-${s.key}`} color={s.color} />)}
        </defs>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={tooltip as never} cursor={{ stroke: t.cursor, strokeWidth: 1 }} />
        {resolved.map((s) =>
          s.type === "line" ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.4} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} filter={t.depth ? `url(#glow-${uid}-${s.key})` : undefined} />
          ) : (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.6} fill={`url(#grad-${uid}-${s.key})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} filter={t.depth ? `url(#glow-${uid}-${s.key})` : undefined} />
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
  const resolve = useResolveColor();
  const accent = useAccentColors();
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const resolved = bars.map((b) => ({
    ...b,
    // Translucent "secondary" series follow the accent too.
    color: b.color.startsWith("rgba(38,72,233") ? accent.primary.replace("rgb(", "rgba(").replace(")", ",0.22)") : resolve(b.color),
  }));
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  const fillFor = (b: { key: string; color: string }) => (t.depth && !b.color.startsWith("rgba") ? `url(#bar-${uid}-${b.key})` : b.color);
  const defs = t.depth && (
    <defs>
      {resolved.map((b) => (
        <linearGradient key={b.key} id={`bar-${uid}-${b.key}`} x1="0" y1="0" x2={layout === "vertical" ? "1" : "0"} y2={layout === "vertical" ? "0" : "1"}>
          <stop offset="0%" stopColor={b.color} stopOpacity={1} />
          <stop offset="100%" stopColor={b.color} stopOpacity={0.55} />
        </linearGradient>
      ))}
    </defs>
  );
  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
          {defs}
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (currency ? formatCurrency(v, currency, true) : String(v))} />
          <YAxis type="category" dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={130} />
          <Tooltip content={tooltip as never} cursor={{ fill: t.cursor }} />
          {resolved.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={fillFor(b)} radius={[0, 6, 6, 0]} barSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        {defs}
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
        <YAxis tick={{ ...AXIS_TICKS, fill: t.axis }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={tooltip as never} cursor={{ fill: t.cursor }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {resolved.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} stackId={stacked ? "a" : undefined} fill={fillFor(b)} radius={stacked ? [3, 3, 0, 0] : [6, 6, 0, 0]} barSize={stacked ? undefined : 22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const PALETTE = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.violet, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.green, CHART_COLORS.pink, CHART_COLORS.slate];

/** Palette with the accent colours substituted — shared by donut charts and their legends. */
export function useChartPalette(): string[] {
  const resolve = useResolveColor();
  return PALETTE.map(resolve);
}

export function DonutChart({
  data,
  height = 240,
  currency,
}: {
  data: { name: string; value: number }[];
  height?: number;
  currency?: string;
}) {
  const t = useChartTheme();
  const palette = useChartPalette();
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const tooltip = (props: unknown) => <ChartTooltip {...(props as object)} currency={currency} />;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        {t.depth && (
          <defs>
            <GlowDefs id={`donut-glow-${uid}`} color={palette[0]} />
            {palette.map((c, i) => (
              <radialGradient key={i} id={`donut-${uid}-${i}`} cx="50%" cy="50%" r="80%">
                <stop offset="55%" stopColor={c} stopOpacity={0.85} />
                <stop offset="100%" stopColor={c} stopOpacity={1} />
              </radialGradient>
            ))}
          </defs>
        )}
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="88%"
          paddingAngle={t.depth ? 3 : 2}
          cornerRadius={t.depth ? 6 : 0}
          stroke="none"
          filter={t.depth ? `url(#donut-glow-${uid})` : undefined}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={t.depth ? `url(#donut-${uid}-${i % palette.length})` : palette[i % palette.length]} />
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
