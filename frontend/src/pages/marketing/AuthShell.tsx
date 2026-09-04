import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "../../components/layout/Logo";

export function AuthShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Logo to="/" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
        <p className="text-center text-xs text-muted">
          By continuing you agree to the <span className="cursor-default underline">Terms</span> and{" "}
          <span className="cursor-default underline">Privacy Policy</span>.
        </p>
      </div>

      {/* Highlight side */}
      <div className="relative hidden overflow-hidden bg-primary-950 lg:block dark:bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Every metric your business needs, in one place.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-300">
            Revenue, orders, customers, products and goals — calculated live from your data, not static charts.
          </p>
          <div className="mt-10 space-y-5">
            {[
              { icon: <BarChart3 className="h-5 w-5" />, title: "Real analytics", text: "KPIs computed from actual orders and sales records." },
              { icon: <Users className="h-5 w-5" />, title: "Customer intelligence", text: "Segments, retention and lifetime value." },
              { icon: <Sparkles className="h-5 w-5" />, title: "Goal tracking", text: "Revenue and growth targets with live progress." },
              { icon: <ShieldCheck className="h-5 w-5" />, title: "Enterprise-grade security", text: "Role-based access, hashed passwords, tenant isolation." },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary-300">{f.icon}</span>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-12 text-xs text-slate-500">Try the demo — no credit card required. <Link to="/register" className="text-primary-300 hover:underline">Create an account</Link></p>
        </div>
      </div>
    </div>
  );
}
