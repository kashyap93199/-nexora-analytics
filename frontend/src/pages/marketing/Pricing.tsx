import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { Eyebrow, H2, Section } from "./landingShared";

const PLANS = [
  {
    name: "Starter",
    tagline: "For trying Nexora and side projects",
    monthly: 0,
    cta: "Start for free",
    highlight: false,
    features: ["1 user", "Core dashboard & KPIs", "Revenue, sales & customer charts", "7-day data history", "Community support"],
  },
  {
    name: "Growth",
    tagline: "For growing teams that live in their numbers",
    monthly: 19,
    cta: "Start 14-day trial",
    highlight: true,
    features: ["Everything in Starter", "5 team seats with roles", "Unlimited history & advanced filters", "Goals, notifications & reports", "CSV exports", "Email support"],
  },
  {
    name: "Business",
    tagline: "For organizations with many moving parts",
    monthly: 49,
    cta: "Contact sales",
    highlight: false,
    features: ["Everything in Growth", "Unlimited seats & roles", "Audit logs & advanced permissions", "Priority support", "SSO-ready architecture"],
  },
];

const COMPARISON: { feature: string; plans: [boolean | string, boolean | string, boolean | string] }[] = [
  { feature: "Dashboard with live KPIs", plans: [true, true, true] },
  { feature: "Revenue & sales analytics", plans: [true, true, true] },
  { feature: "Customer segments & retention", plans: [true, true, true] },
  { feature: "Product performance & inventory", plans: [true, true, true] },
  { feature: "Order management", plans: [true, true, true] },
  { feature: "Date-range comparisons", plans: [true, true, true] },
  { feature: "Data history", plans: ["7 days", "Unlimited", "Unlimited"] },
  { feature: "Reports & CSV export", plans: [false, true, true] },
  { feature: "Goals & notifications", plans: [false, true, true] },
  { feature: "Team seats", plans: ["1", "5", "Unlimited"] },
  { feature: "Role-based access control", plans: [false, true, true] },
  { feature: "Audit logs", plans: [false, false, true] },
];

const FAQS = [
  { q: "Can I start with the free plan and upgrade later?", a: "Yes — create a workspace free, then upgrade when you need more seats or history. No setup fees." },
  { q: "Is there a credit card required to start?", a: "No. The Starter plan is free forever, and trials don't require a card." },
  { q: "What happens when I hit the Starter limits?", a: "You'll be prompted to upgrade to Growth or Business. Your data is never deleted." },
  { q: "Do you offer discounts for annual billing?", a: "Annual billing is 20% off on Growth and Business — ask us when you're ready to switch." },
  { q: "Is this a real payment system?", a: "This demo project presents pricing as UI only — no payments are processed." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      <Section className="pt-16 text-center sm:pt-20">
        <Eyebrow>Pricing</Eyebrow>
        <H2 className="mx-auto max-w-2xl">Pricing that grows with you</H2>
        <p className="mx-auto mt-4 max-w-xl text-muted">Start free. Add seats and history when the team needs it.</p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-border bg-card p-1">
          <button onClick={() => setAnnual(false)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition", !annual ? "bg-primary-600 text-white" : "text-muted hover:text-ink")}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition", annual ? "bg-primary-600 text-white" : "text-muted hover:text-ink")}>
            Annual <span className={cn("ml-1 text-xs", annual ? "text-primary-200" : "text-emerald-500")}>−20%</span>
          </button>
        </div>
      </Section>

      <Section className="pt-10">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = plan.monthly === 0 ? 0 : annual ? Math.round(plan.monthly * 0.8) : plan.monthly;
            return (
              <div key={plan.name} className={cn("relative flex flex-col rounded-2xl border p-6", plan.highlight ? "border-primary-500 bg-card shadow-pop ring-1 ring-primary-500" : "border-border bg-card")}>
                {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Most popular</span>}
                <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                <p className="mt-1 text-[13px] text-muted">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-ink tabular">${price}</span>
                  <span className="text-sm text-muted">{plan.monthly === 0 ? "forever" : "/ month"}</span>
                </div>
                {annual && plan.monthly > 0 && <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">Billed annually</p>}
                <Link to="/register" className="mt-5 block">
                  <Button variant={plan.highlight ? "primary" : "outline"} className="w-full">{plan.cta}</Button>
                </Link>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-center text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> All plans include organization-level data isolation, hashed passwords and JWT sessions.
        </p>
      </Section>

      <section className="border-y border-border bg-card/50">
        <Section className="py-14">
          <h3 className="text-center text-xl font-bold tracking-tight text-ink sm:text-2xl">Compare plans</h3>
          <div className="mx-auto mt-8 max-w-3xl overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60 text-left dark:bg-white/[0.02]">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Feature</th>
                  {PLANS.map((p) => <th key={p.name} className="px-5 py-3 text-center text-sm font-bold text-ink">{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-2.5 text-ink/85">{row.feature}</td>
                    {row.plans.map((cell, i) => (
                      <td key={i} className="px-5 py-2.5 text-center">
                        {cell === true ? <Check className="mx-auto h-4 w-4 text-emerald-500" /> : cell === false ? <span className="text-muted/50">—</span> : <span className="text-[13px] font-medium text-ink">{cell}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </section>

      <Section className="max-w-3xl">
        <div className="text-center">
          <Eyebrow>Pricing FAQ</Eyebrow>
          <H2>Questions about plans</H2>
        </div>
        <div className="mt-8 space-y-3">
          {FAQS.map((f, i) => (
            <div key={f.q} className="rounded-xl border border-border bg-card">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="text-sm font-semibold text-ink">{f.q}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", openFaq === i && "rotate-180")} />
              </button>
              {openFaq === i && <p className="animate-fade-in px-5 pb-4 text-sm leading-relaxed text-muted">{f.a}</p>}
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/register"><Button size="lg">Start Free <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </Section>
    </>
  );
}
