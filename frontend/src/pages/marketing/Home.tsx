import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  FileBarChart2,
  Gauge,
  LineChart,
  Package,
  PieChart,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { Eyebrow, H2, Lead, Section } from "./landingShared";

/* ------------------------------------------------------------- hero mockup */

function HeroMockup() {
  return (
    <div aria-hidden className="relative mx-auto mt-14 max-w-5xl">
      <div className="absolute -inset-x-8 -top-10 h-64 rounded-[40px] bg-gradient-to-r from-primary-200/40 via-violet-200/30 to-teal-200/40 blur-3xl dark:from-primary-600/10 dark:via-violet-600/10 dark:to-teal-600/10" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 hidden rounded-md bg-ink/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted sm:block dark:bg-white/[0.06]">
            app.nexora.app/overview
          </span>
        </div>
        <div className="grid sm:grid-cols-[150px_1fr]">
          {/* fake sidebar */}
          <div className="hidden border-r border-border bg-surface/60 p-3 sm:block">
            <div className="mb-3 flex items-center gap-2 px-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-600 text-white">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3"><path d="M4 17l5-6 4 3 7-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="text-xs font-bold text-ink">Nexora</span>
            </div>
            {["Overview", "Analytics", "Sales", "Customers"].map((label, i) => (
              <div key={label} className={cn("mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]", i === 0 ? "bg-primary-50 font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-400" : "text-muted")}>
                <span className={cn("h-2.5 w-2.5 rounded", i === 0 ? "bg-primary-500" : "bg-slate-300 dark:bg-slate-600")} />
                {label}
              </div>
            ))}
          </div>
          {/* fake dashboard */}
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Revenue", value: "$128,430", delta: "+18.6%", up: true },
                { label: "Orders", value: "8,426", delta: "+12.4%", up: true },
                { label: "Customers", value: "5,284", delta: "+9.8%", up: true },
                { label: "Conversion", value: "4.82%", delta: "+0.7%", up: true },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-border bg-surface/50 p-3 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{kpi.label}</p>
                  <p className="mt-1 text-base font-bold text-ink sm:text-lg">{kpi.value}</p>
                  <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">↑ {kpi.delta}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-ink">Revenue</p>
                  <div className="flex gap-1">
                    {["D", "W", "M", "Y"].map((l, i) => (
                      <span key={l} className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", i === 2 ? "bg-primary-600 text-white" : "text-muted")}>{l}</span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 300 90" className="h-24 w-full sm:h-28">
                  <defs>
                    <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2648e9" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2648e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[18, 38, 58, 78].map((y) => (
                    <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                  ))}
                  <path d="M0,72 C20,68 30,58 50,60 C70,62 80,46 100,48 C120,50 130,38 150,40 C170,42 180,28 200,30 C220,32 230,20 250,22 C270,24 285,12 300,10 L300,90 L0,90 Z" fill="url(#heroFill)" />
                  <path d="M0,72 C20,68 30,58 50,60 C70,62 80,46 100,48 C120,50 130,38 150,40 C170,42 180,28 200,30 C220,32 230,20 250,22 C270,24 285,12 300,10" fill="none" stroke="#2648e9" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-[11px] font-semibold text-ink">Revenue by category</p>
                {[
                  { label: "Electronics", pct: 84, color: "bg-primary-600" },
                  { label: "Apparel", pct: 60, color: "bg-violet-500" },
                  { label: "Home & Living", pct: 42, color: "bg-teal-500" },
                  { label: "Beauty", pct: 25, color: "bg-amber-500" },
                ].map((row) => (
                  <div key={row.label} className="mb-2">
                    <div className="mb-0.5 flex justify-between text-[10px] text-muted"><span>{row.label}</span><span className="tabular">{row.pct}%</span></div>
                    <div className="h-1.5 rounded-full bg-ink/[0.06] dark:bg-white/[0.08]"><div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-pop md:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><Check className="h-4 w-4" /></span>
        <div>
          <p className="text-xs font-semibold text-ink">Revenue goal</p>
          <p className="text-[10px] text-muted">86% of $150,000 reached</p>
        </div>
      </div>
      <div className="absolute -bottom-5 -right-3 hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-pop md:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-500/15"><TrendingUp className="h-4 w-4" /></span>
        <div>
          <p className="text-xs font-semibold text-ink">+18.6% revenue</p>
          <p className="text-[10px] text-muted">vs previous period</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- feature grid */

const FEATURES = [
  { icon: LineChart, title: "Revenue analytics", text: "Track daily, weekly, monthly and yearly revenue trends with interactive charts and live period-over-period changes." },
  { icon: Users, title: "Customer intelligence", text: "Segment customers into new, returning, VIP and inactive cohorts. Follow retention, acquisition and lifetime value." },
  { icon: Package, title: "Product performance", text: "See best sellers, profit margins and inventory health per product — with trends that show momentum at a glance." },
  { icon: ShoppingCart, title: "Order management", text: "Search, filter, sort and inspect every order. Statuses flow from pending to delivered with full audit history." },
  { icon: Target, title: "Goal tracking", text: "Set revenue, order, customer and profit goals. Progress is computed live from your real data — no spreadsheets." },
  { icon: FileBarChart2, title: "Reports & exports", text: "Generate sales, revenue, customer and product reports over any date range and export clean CSVs in one click." },
];

function FeatureCard({ icon: Icon, title, text }: { icon: typeof LineChart; title: string; text: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300/60 hover:shadow-card dark:hover:border-primary-500/30">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition group-hover:scale-105 dark:bg-primary-500/10 dark:text-primary-400">
        <Icon className="h-5.5 w-5.5" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- faq */

const FAQS = [
  { q: "How is my revenue calculated?", a: "Revenue is computed from your actual order records — the sum of completed order totals within the selected date range. Nothing is estimated or hard-coded." },
  { q: "Can I compare periods?", a: "Yes. Every KPI card shows the change versus the previous period of equal length, and you can switch between today, 7/30/90 days, this month, this year or a custom range." },
  { q: "What does each plan include?", a: "Every plan includes the full dashboard. Growth adds advanced analytics exports and 5 team seats; Business adds unlimited seats, goals and audit logging. See the pricing page." },
  { q: "Is my data secure?", a: "Passwords are hashed with bcrypt, sessions use short-lived JWTs, every request is validated, and data is isolated per organization with role-based permissions." },
  { q: "Can I export reports?", a: "Absolutely. Generate a report over any date range and export it as a CSV from the Reports page." },
  { q: "Can I try it first?", a: "Create a free workspace in seconds, or click the demo account button on the login page to explore a fully populated sample company." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-ink">{q}</span>
        <ChevronDown className={cn("h-4.5 w-4.5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <p className="animate-fade-in px-5 pb-4 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(38,72,233,0.08),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 text-center sm:px-8 sm:pt-24">
          <Eyebrow>Business analytics, reimagined</Eyebrow>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Make smarter decisions with your <span className="text-primary-600">business data</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Nexora Analytics brings your sales, customers, revenue, and business performance into one intelligent dashboard.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button size="lg" className="w-56">Start Free <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="w-56">View Demo</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Free forever plan · No credit card required · Demo account available</p>
          <HeroMockup />
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-border bg-card/60 py-10">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted">Trusted by teams at</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70" aria-hidden>
            {["Northwind", "Brightline", "Cobalt Labs", "Ferris & Co", "Harbor Health", "Vertex Retail"].map((name) => (
              <span key={name} className="text-lg font-bold tracking-tight text-ink/60 dark:text-slate-300">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Key features */}
      <Section id="features">
        <div className="text-center">
          <Eyebrow>Features</Eyebrow>
          <H2>Everything you need to run on data</H2>
          <Lead>From revenue dashboards to goal tracking, Nexora turns your operational data into clear answers.</Lead>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      {/* Revenue analytics preview */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <Eyebrow>Revenue analytics</Eyebrow>
            <H2>Watch revenue move in real time</H2>
            <Lead>Daily, weekly, monthly or yearly views with instant comparisons against the previous period. Spot trends before they become surprises.</Lead>
            <ul className="mt-6 space-y-3">
              {["Area & line charts for every granularity", "Conversion rate driven by real traffic data", "Profit, refunds and average order value alongside"].map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-sm text-ink/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {li}
                </li>
              ))}
            </ul>
            <Link to="/features" className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400">
              Explore features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-hidden>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Revenue overview</p>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">+18.6%</span>
              </div>
              <svg viewBox="0 0 400 160" className="mt-4 h-44 w-full sm:h-52">
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2648e9" stopOpacity="0.2" /><stop offset="100%" stopColor="#2648e9" stopOpacity="0" /></linearGradient>
                </defs>
                {[30, 70, 110, 150].map((y) => (<line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />))}
                <path d="M0,130 C40,124 60,138 100,118 C140,98 160,110 200,88 C240,66 260,84 300,58 C330,40 370,34 400,20 L400,160 L0,160 Z" fill="url(#revFill)" />
                <path d="M0,130 C40,124 60,138 100,118 C140,98 160,110 200,88 C240,66 260,84 300,58 C330,40 370,34 400,20" fill="none" stroke="#2648e9" strokeWidth="3" strokeLinecap="round" />
                <circle cx="300" cy="58" r="5" fill="#2648e9" stroke="white" strokeWidth="2" />
              </svg>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
                {[["$128,430", "Revenue"], ["8,426", "Orders"], ["4.82%", "Conversion"]].map(([v, l]) => (
                  <div key={l}><p className="text-sm font-bold text-ink tabular">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer analytics */}
      <Section>
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-hidden>
              <p className="text-sm font-semibold text-ink">Customer growth</p>
              <div className="mt-4 flex items-end gap-1.5" style={{ height: 140 }}>
                {[22, 30, 26, 40, 36, 50, 44, 58, 66, 60, 76, 70, 86, 92, 88, 100].map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                    <div className="w-full rounded-t-sm bg-primary-600/25" style={{ height: `${h * 0.42}%` }} />
                    <div className="w-full rounded-t-sm bg-primary-600" style={{ height: `${h * 0.52}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary-600" /> New customers</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary-600/25" /> Returning</span>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow>Customer analytics</Eyebrow>
            <H2>Understand who buys — and why they stay</H2>
            <Lead>Track new and returning customers, retention and lifetime value. Our segment engine automatically labels every customer.</Lead>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { icon: Gauge, label: "Retention rate", value: "78.2%" },
                { icon: Zap, label: "Avg. order frequency", value: "2.4 /mo" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <s.icon className="h-4.5 w-4.5 text-primary-500" />
                  <p className="mt-2 text-lg font-bold text-ink tabular">{s.value}</p>
                  <p className="text-xs text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Product performance */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="text-center">
            <Eyebrow>Product performance</Eyebrow>
            <H2>Know your winners at a glance</H2>
            <Lead>Units sold, revenue, profit, margin and momentum for every product — sorted however you like.</Lead>
          </div>
          <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-hidden>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/60 text-[11px] uppercase tracking-wider text-muted dark:bg-white/[0.02]">
                    {["Product", "Category", "Units sold", "Revenue", "Margin", "Trend"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Aurora Wireless Earbuds", "Electronics", "1,284", "$114,276", "58%", "+12.4%"],
                    ["Nova Smart Watch", "Electronics", "862", "$171,538", "54%", "+8.1%"],
                    ["Drift Denim Jacket", "Apparel", "1,048", "$82,792", "57%", "+21.0%"],
                    ["Flex Yoga Mat", "Sports & Outdoors", "1,512", "$52,920", "63%", "+4.2%"],
                    ["Glow Vitamin C Serum", "Beauty & Care", "988", "$37,544", "71%", "-2.3%"],
                  ].map((row, i) => (
                    <tr key={row[0]} className={cn("border-b border-border/70 last:border-0", i === 0 && "bg-primary-50/40 dark:bg-primary-500/[0.05]")}>
                      {row.map((cell, j) => (
                        <td key={j} className={cn("px-4 py-3", j === 0 ? "font-semibold text-ink" : "text-muted", j === 4 && "font-semibold text-ink", j === 5 && (row[5].startsWith("+") ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-600 dark:text-red-400"))}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <Section id="how-it-works">
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <H2>Live in under five minutes</H2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { step: "01", icon: BarChart3, title: "Create your workspace", text: "Sign up free and Nexora provisions your organization, roles and security model instantly." },
            { step: "02", icon: Package, title: "Add your products & customers", text: "Import your catalog and customer base, or load the demo dataset to explore with realistic data." },
            { step: "03", icon: TrendingUp, title: "Watch insights appear", text: "KPIs, charts, goals and reports are calculated live from your records — no manual reporting." },
          ].map((s) => (
            <div key={s.step} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="absolute right-5 top-4 text-4xl font-extrabold tracking-tight text-ink/[0.06] dark:text-white/[0.08]">{s.step}</span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"><s.icon className="h-5.5 w-5.5" /></span>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Benefits */}
      <section className="border-y border-border bg-primary-950 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
          <div>
            <Eyebrow>Why teams switch</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Built for decisions, not just dashboards</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-slate-300">
              Analytics is only valuable when it changes what you do next. Nexora is designed to answer the questions owners and managers actually ask every week.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register"><Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">Get started</Button></Link>
              <Link to="/pricing"><Button size="lg" variant="outline" className="border-slate-600 bg-transparent text-white hover:bg-white/10">View pricing</Button></Link>
            </div>
          </div>
          <ul className="space-y-4">
            {[
              ["Stop exporting spreadsheets", "Live metrics replace Monday-morning manual reporting."],
              ["Catch problems early", "Low inventory, slowing sales and churn signals surface fast."],
              ["Align the team", "Role-based dashboards give everyone the right view and permissions."],
              ["Grow with confidence", "Goal progress ties daily numbers to monthly targets."],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"><Check className="h-4 w-4" /></span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      <Section>
        <div className="text-center">
          <Eyebrow>Loved by operators</Eyebrow>
          <H2>Teams that switched to Nexora</H2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { name: "Priya Sharma", role: "COO · Northwind Goods", quote: "We replaced four weekly spreadsheets with one dashboard. Revenue review went from 90 minutes to fifteen.", initials: "PS" },
            { name: "Daniel Okafor", role: "Founder · Brightline Studio", quote: "The goal progress feature changed how our whole team thinks about the month. Everyone can see where we stand.", initials: "DO" },
            { name: "Elena Fischer", role: "Head of E-commerce · Cobalt Labs", quote: "Customer segments alone are worth it. We finally stopped emailing our entire list and started targeting VIPs.", initials: "EF" },
          ].map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <div className="flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" /></svg>)}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink/90">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{t.initials}</span>
                <span><span className="block text-[13px] font-semibold text-ink">{t.name}</span><span className="block text-xs text-muted">{t.role}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Pricing teaser */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="text-center">
            <Eyebrow>Pricing</Eyebrow>
            <H2>Start free. Upgrade when you grow.</H2>
            <Lead>Simple plans that scale with your business. No hidden fees, cancel anytime.</Lead>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-3">
            {[
              { name: "Starter", price: "$0", period: "forever", features: ["1 user", "Core dashboard & charts", "7-day data history", "Community support"], highlight: false },
              { name: "Growth", price: "$19", period: "/month", features: ["5 team seats", "Unlimited analytics & exports", "Goals & notifications", "Email support"], highlight: true },
              { name: "Business", price: "$49", period: "/month", features: ["Unlimited seats", "Reports & CSV export", "Audit logs & permissions", "Priority support"], highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={cn("relative rounded-2xl border p-6", plan.highlight ? "border-primary-500 bg-primary-600 text-white shadow-pop" : "border-border bg-card")}>
                {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-950">Most popular</span>}
                <h3 className={cn("text-sm font-semibold", plan.highlight ? "text-primary-100" : "text-muted")}>{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold tracking-tight"><span className="tabular">{plan.price}</span><span className={cn("text-sm font-medium", plan.highlight ? "text-primary-200" : "text-muted")}> {plan.period}</span></p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className={cn("flex items-start gap-2 text-sm", plan.highlight ? "text-primary-50" : "text-ink/80")}>
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlight ? "text-white" : "text-emerald-500")} /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="mt-6 block">
                  <Button variant={plan.highlight ? "secondary" : "outline"} className="w-full" >{plan.name === "Starter" ? "Start for free" : "Choose plan"}</Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted">Need details? <Link to="/pricing" className="font-semibold text-primary-600 hover:underline dark:text-primary-400">See the full pricing page</Link></p>
        </div>
      </section>

      {/* FAQ */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <H2>Frequently asked questions</H2>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary-600 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_50%)]" aria-hidden />
          <div className="relative">
            <PieChart className="mx-auto h-8 w-8 text-primary-200" />
            <h2 className="mx-auto mt-4 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to see your numbers clearly?</h2>
            <p className="mx-auto mt-3 max-w-md text-primary-100">Join thousands of operators who start every week with Nexora.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register"><Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50">Start Free</Button></Link>
              <Link to="/login"><Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">View Demo</Button></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
