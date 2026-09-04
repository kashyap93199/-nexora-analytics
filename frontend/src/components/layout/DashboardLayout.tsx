import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  FileBarChart2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plug,
  Search,
  Settings,
  ShoppingBag,
  Target,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { PERMISSIONS } from "../../types";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Dropdown, MenuItem } from "../ui/Dropdown";
import { Avatar } from "../ui/base";
import { NotificationBell } from "./NotificationBell";
import { SearchPalette } from "./SearchPalette";
import { DateRangePicker } from "./DateRangePicker";

const NAV_SECTIONS: { section: string; items: { to: string; label: string; icon: typeof LayoutDashboard; permission?: string }[] }[] = [
  {
    section: "Insights",
    items: [
      { to: "/app/overview", label: "Overview", icon: LayoutDashboard, permission: PERMISSIONS.dashboardView },
      { to: "/app/analytics", label: "Analytics", icon: TrendingUp, permission: PERMISSIONS.analyticsView },
    ],
  },
  {
    section: "Business",
    items: [
      { to: "/app/sales", label: "Sales", icon: BarChart3, permission: PERMISSIONS.salesView },
      { to: "/app/customers", label: "Customers", icon: Users, permission: PERMISSIONS.customersView },
      { to: "/app/products", label: "Products", icon: Package, permission: PERMISSIONS.productsView },
      { to: "/app/orders", label: "Orders", icon: ShoppingBag, permission: PERMISSIONS.ordersView },
    ],
  },
  {
    section: "Management",
    items: [
      { to: "/app/reports", label: "Reports", icon: FileBarChart2, permission: PERMISSIONS.reportsView },
      { to: "/app/goals", label: "Goals", icon: Target, permission: PERMISSIONS.goalsView },
      { to: "/app/team", label: "Team", icon: UserRound, permission: PERMISSIONS.teamView },
      { to: "/app/integrations", label: "Integrations", icon: Plug },
    ],
  },
];

export function DashboardLayout() {
  const { me: authMe, hasPermission, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile sidebar on navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Global shortcuts: Cmd/Ctrl+K opens search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((i) => !i.permission || hasPermission(i.permission)),
      })).filter((s) => s.items.length > 0),
    [hasPermission]
  );


  const sidebar = (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to="/app/overview" />
        <button className="rounded-lg p-1.5 text-muted hover:text-ink lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        {visibleSections.map((section) => (
          <div key={section.section}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{section.section}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
                        isActive
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400"
                          : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/[0.06]"
                      )
                    }
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
              isActive ? "bg-ink/[0.05] text-ink dark:bg-white/[0.08]" : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/[0.06]"
            )
          }
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          Settings
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-slide-up">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-muted hover:text-ink lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full max-w-xs items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-muted transition hover:border-primary-400/50 hover:text-ink dark:bg-white/[0.03] sm:w-72"
            aria-label="Open global search"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">Search…</span>
            <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <DateRangePicker />
            <NotificationBell />
            <ThemeToggle compact />
            <button
              onClick={() => setHelpOpen(true)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted transition hover:text-ink sm:inline-flex dark:hover:bg-white/[0.06]"
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <Dropdown
              trigger={(open) => (
                <button className={cn("flex items-center gap-2 rounded-lg p-1 pr-1.5 transition hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]", open && "bg-ink/[0.04] dark:bg-white/[0.06]")} aria-label="Account menu">
                  <Avatar name={authMe?.user.full_name ?? "?"} size="sm" />
                  <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-ink xl:block">{authMe?.user.full_name}</span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-ink">{authMe?.user.full_name}</p>
                    <p className="truncate text-xs text-muted">{authMe?.organization.name}</p>
                    <span className="mt-1.5 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-500/10 dark:text-primary-400">
                      {authMe?.role}
                    </span>
                  </div>
                  <MenuItem onClick={() => { close(); navigate("/app/settings"); }}>
                    <Settings className="h-4 w-4 text-muted" /> Settings
                  </MenuItem>
                  <MenuItem onClick={() => { close(); navigate("/"); }}>
                    <Building2 className="h-4 w-4 text-muted" /> Marketing site
                  </MenuItem>
                  <MenuItem danger onClick={() => { close(); void logout(); navigate("/login"); }}>
                    <LogOut className="h-4 w-4" /> Log out
                  </MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Help dialog */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setHelpOpen(false)} />
          <div className="relative z-10 w-full max-w-md animate-scale-in rounded-xl border border-border bg-card p-6 shadow-modal">
            <h2 className="text-base font-semibold text-ink">Help &amp; shortcuts</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li className="flex justify-between"><span>Global search</span><kbd className="rounded border border-border px-1.5 py-0.5 text-xs">Ctrl / ⌘ + K</kbd></li>
              <li className="flex justify-between"><span>Date range filter</span><span className="text-xs">Top bar selector</span></li>
              <li className="flex justify-between"><span>Notifications</span><span className="text-xs">Bell icon</span></li>
              <li className="flex justify-between"><span>Theme</span><span className="text-xs">Sun / moon toggle</span></li>
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              For API documentation visit <span className="font-mono">/api/docs</span>.
            </p>
            <button onClick={() => setHelpOpen(false)} className="mt-4 w-full rounded-lg bg-ink/[0.05] px-4 py-2 text-sm font-medium text-ink hover:bg-ink/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.14]">
              Got it
            </button>
          </div>
        </div>
      )}

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
