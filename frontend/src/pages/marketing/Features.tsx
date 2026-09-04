import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  FileBarChart2,
  LayoutDashboard,
  Lock,
  Package,
  PieChart,
  Search,
  ShieldCheck,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Eyebrow, H2, Lead, Section } from "./landingShared";

const SECTIONS = [
  {
    icon: LayoutDashboard,
    eyebrow: "Dashboard",
    title: "One overview of everything that matters",
    text: "Revenue, orders, customers, conversion rate and average order value — each with live period-over-period changes, plus recent orders and goal progress at a glance.",
    bullets: ["KPI cards computed from real records", "Recent orders and low-stock alerts", "Goal progress always visible"],
  },
  {
    icon: TrendingUp,
    eyebrow: "Analytics",
    title: "Charts that answer follow-up questions",
    text: "Switch between daily, weekly, monthly and yearly views on the same chart. Filter sales by region, channel, product or category and see conversion, gross and net side by side.",
    bullets: ["Revenue area & line charts", "Customer growth — new vs returning", "Revenue by category and source", "Geographic performance"],
  },
  {
    icon: Users,
    eyebrow: "Customers",
    title: "Know your customers as people, not rows",
    text: "Automatic segments (new, returning, VIP, inactive), retention tracking, lifetime value and complete purchase history per customer.",
    bullets: ["Segments computed from behavior", "Retention and lifetime value metrics", "Per-customer profiles with order history"],
  },
  {
    icon: Package,
    eyebrow: "Products",
    title: "Product performance with margins",
    text: "Units sold, revenue, profit and margin per product with trend arrows, plus inventory status so you never miss a low-stock signal.",
    bullets: ["Best and worst performers sorted instantly", "Profit margin from real unit costs", "Inventory health on every row"],
  },
  {
    icon: ShoppingCart,
    eyebrow: "Orders",
    title: "Orders under control",
    text: "Search any order, filter by status or channel, sort by amount and open a full detail view with line items and customer info.",
    bullets: ["Full-text search across orders", "Six statuses with audit trail", "Create orders right from the dashboard"],
  },
  {
    icon: FileBarChart2,
    eyebrow: "Reports & goals",
    title: "From data to documents in one click",
    text: "Generate sales, revenue, customer, product or performance reports over any date range, preview them, and export clean CSVs. Track goals whose progress updates automatically.",
    bullets: ["Five report types with live previews", "One-click CSV export", "Revenue, orders, customers & profit goals"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-20">
        <Eyebrow>Features</Eyebrow>
        <H2 className="mx-auto max-w-2xl">A full analytics suite, without the enterprise bloat</H2>
        <Lead>Every feature is functional, connected to real data, and designed for how small teams actually work.</Lead>
      </Section>

      {SECTIONS.map((s, i) => (
        <section key={s.title} className={i % 2 === 1 ? "border-y border-border bg-card/50" : ""}>
          <Section className={cnPad(i % 2 === 1)}>
            <div className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 === 1 ? "" : "lg:[&>*:first-child]:order-2"}`}>
              <div>
                <Eyebrow>{s.eyebrow}</Eyebrow>
                <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{s.title}</h2>
                <p className="mt-4 leading-relaxed text-muted">{s.text}</p>
                <ul className="mt-5 space-y-2.5">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-ink/85">
                      <span className="mt-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                        <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Icon panel as visual anchor */}
              <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 shadow-card">
                <div className="grid grid-cols-3 gap-3">
                  {[BarChart3, PieChart, Target, BellRing, Search, Lock].map((Icon, idx) => (
                    <span key={idx} className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface text-primary-600 dark:bg-white/[0.03] dark:text-primary-400">
                      <Icon className="h-6 w-6" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </section>
      ))}

      <Section className="text-center">
        <H2>Ready to try every feature yourself?</H2>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register"><Button size="lg">Start Free <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/login"><Button variant="outline" size="lg">Open the live demo</Button></Link>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> Role-based access, hashed passwords and per-organization data isolation on every plan.
        </p>
      </Section>
    </>
  );
}

function cnPad(alt: boolean): string {
  return alt ? "py-16 sm:py-20" : "py-16 sm:py-20";
}
