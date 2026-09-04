import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";

import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted">
              Turn business data into better decisions. Nexora Analytics brings your revenue, sales, customers and performance into one intelligent dashboard.
            </p>
            <a href="mailto:hello@nexora.app" className="mt-4 block text-sm text-muted hover:text-ink">
              hello@nexora.app
            </a>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Product</h4>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li><Link className="text-ink/80 hover:text-primary-600" to="/features">Features</Link></li>
              <li><Link className="text-ink/80 hover:text-primary-600" to="/pricing">Pricing</Link></li>
              <li><Link className="text-ink/80 hover:text-primary-600" to="/login">Live demo</Link></li>
              <li><Link className="text-ink/80 hover:text-primary-600" to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Company</h4>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li><Link className="text-ink/80 hover:text-primary-600" to="/about">About</Link></li>
              <li><Link className="text-ink/80 hover:text-primary-600" to="/features">Why Nexora</Link></li>
              <li><Link className="text-ink/80 hover:text-primary-600" to="/pricing">Plans</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Legal</h4>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li><span className="cursor-default text-muted">Privacy Policy</span></li>
              <li><span className="cursor-default text-muted">Terms of Service</span></li>
              <li><span className="cursor-default text-muted">Security</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Nexora Analytics. Demo project — no real services attached.</p>
          <p>Built with React, FastAPI &amp; PostgreSQL</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status } = useAuth();
  const location = useLocation();
  const authenticated = status === "authenticated";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive ? "text-ink" : "text-muted hover:text-ink"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            {authenticated ? (
              <Link to="/app/overview">
                <Button size="sm">Dashboard <ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Start free</Button>
                </Link>
              </>
            )}
            <button
              className="ml-1 rounded-lg p-2 text-muted hover:bg-ink/[0.05] hover:text-ink md:hidden dark:hover:bg-white/[0.08]"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-border bg-card px-5 py-3 md:hidden" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive ? "bg-ink/[0.05] text-ink" : "text-muted hover:text-ink"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {!authenticated && (
              <Link to="/login" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-primary-600">
                Log in
              </Link>
            )}
            {location.pathname === "/register" || location.pathname === "/login" ? null : (
              <div className="mt-2 border-t border-border px-3 pb-1 pt-3">
                <Link to={authenticated ? "/app/overview" : "/register"}>
                  <Button className="w-full">{authenticated ? "Open dashboard" : "Start free"}</Button>
                </Link>
              </div>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
