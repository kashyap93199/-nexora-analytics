import { Link } from "react-router-dom";
import { ArrowRight, Coffee, Code2, Database, Layers, Rocket, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Eyebrow, H2, Section } from "./landingShared";

const VALUES = [
  { icon: Layers, title: "Clarity over noise", text: "Dashboards should answer questions, not create new ones. We show fewer, better numbers." },
  { icon: Database, title: "Real data, always", text: "Every metric is calculated from records — never estimated. What you see is what happened." },
  { icon: ShieldCheck, title: "Security by default", text: "Tenant isolation, role-based access and hashed credentials are built in from day one." },
  { icon: Smartphone, title: "Work anywhere", text: "Responsive from phone to 4K monitor so decisions aren't trapped at a desk." },
];

const STACK = [
  { name: "React + TypeScript", role: "Interactive UI" },
  { name: "FastAPI (Python)", role: "REST API" },
  { name: "PostgreSQL", role: "Relational data" },
  { name: "Tailwind CSS", role: "Design system" },
  { name: "Recharts", role: "Charts" },
  { name: "Docker", role: "Deployment" },
];

export default function AboutPage() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-20">
        <Eyebrow>About Nexora</Eyebrow>
        <H2 className="mx-auto max-w-2xl">Analytics for teams that can't afford analysts</H2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted">
          Nexora Analytics started from a simple observation: most small businesses buy expensive tools with endless charts — and still can't answer
          "how did we do this month?" Nexora is a full-stack SaaS that does one thing well: turns order, customer and product records into decisions.
        </p>
      </Section>

      <section className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-4">
          {[
            { value: "24/7", label: "Numbers always fresh" },
            { value: "5", label: "Built-in roles" },
            { value: "6", label: "Chart families" },
            { value: "1", label: "Source of truth" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-primary-600 dark:text-primary-400">{s.value}</p>
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Why we built it</Eyebrow>
            <H2>A portfolio project, engineered like production</H2>
            <div className="mt-5 space-y-4 leading-relaxed text-muted">
              <p>
                Nexora is built as a demonstration of serious full-stack SaaS architecture — not a tutorial dashboard. It includes multi-tenant
                data isolation, role-based authorization, JWT authentication with refresh rotation, audit logging, rate limiting, computed
                analytics and a realistic seed dataset.
              </p>
              <p>
                The UI follows a single design system across a public marketing site and an authenticated product: consistent tokens, dark mode,
                accessible components, loading/empty/error states everywhere, and responsive layouts from 375px phones to wide desktop.
              </p>
              <p>
                The demo workspace comes pre-loaded with a sample company so you can explore every feature immediately with{" "}
                <span className="font-semibold text-ink">demo@nexora.app</span>.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span key={s.name} className="rounded-lg border border-border bg-card px-3 py-1.5 text-[13px]">
                  <span className="font-semibold text-ink">{s.name}</span>{" "}
                  <span className="text-muted">· {s.role}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Eyebrow>Values</Eyebrow>
            {VALUES.map((v) => (
              <div key={v.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                  <v.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{v.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{v.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="border-t border-border bg-card/50">
        <Section className="py-14">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white"><Code2 className="h-6 w-6" /></span>
              <div>
                <h3 className="text-lg font-bold text-ink">Open to feedback &amp; collaboration</h3>
                <p className="mt-0.5 text-sm text-muted">This is a demonstration project. Ideas, PRs and feature requests are welcome.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/contact"><Button variant="outline">Contact us</Button></Link>
              <Link to="/register"><Button>Try the demo <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </div>
          <div className="mt-10 grid gap-4 border-t border-border pt-8 sm:grid-cols-3">
            {[
              { icon: Coffee, title: "Crafted with care", text: "Every screen has been considered for its job." },
              { icon: Rocket, title: "Deployment-ready", text: "Docker, env-based config and CI-friendly tests included." },
              { icon: Layers, title: "Extensible core", text: "A clean domain model ready for payments, email and more." },
            ].map((c) => (
              <div key={c.title} className="flex items-start gap-3">
                <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                <div>
                  <p className="text-sm font-semibold text-ink">{c.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </section>
    </>
  );
}
