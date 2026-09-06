import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { useAuth } from "./contexts/AuthContext";
import { PERMISSIONS } from "./types";
import { MarketingLayout } from "./components/layout/MarketingLayout";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PageLoader } from "./components/ui/Feedback";

// Code-split every route so the initial load stays lean.
const HomePage = lazy(() => import("./pages/marketing/Home"));
const FeaturesPage = lazy(() => import("./pages/marketing/Features"));
const PricingPage = lazy(() => import("./pages/marketing/Pricing"));
const AboutPage = lazy(() => import("./pages/marketing/About"));
const ContactPage = lazy(() => import("./pages/marketing/Contact"));
const LoginPage = lazy(() => import("./pages/marketing/Login"));
const RegisterPage = lazy(() => import("./pages/marketing/Register"));
const OverviewPage = lazy(() => import("./pages/dashboard/Overview"));
const AnalyticsPage = lazy(() => import("./pages/dashboard/Analytics"));
const SalesPage = lazy(() => import("./pages/dashboard/Sales"));
const CustomersPage = lazy(() => import("./pages/dashboard/Customers"));
const CustomerDetailPage = lazy(() => import("./pages/dashboard/CustomerDetail"));
const ProductsPage = lazy(() => import("./pages/dashboard/Products"));
const OrdersPage = lazy(() => import("./pages/dashboard/Orders"));
const OrderDetailPage = lazy(() => import("./pages/dashboard/OrderDetail"));
const ReportsPage = lazy(() => import("./pages/dashboard/Reports"));
const GoalsPage = lazy(() => import("./pages/dashboard/Goals"));
const TeamPage = lazy(() => import("./pages/dashboard/Team"));
const IntegrationsPage = lazy(() => import("./pages/dashboard/Integrations"));
const NotificationsPage = lazy(() => import("./pages/dashboard/Notifications"));
const SettingsPage = lazy(() => import("./pages/dashboard/Settings"));
const NotFoundPage = lazy(() => import("./pages/errors/NotFound"));
const ForbiddenPage = lazy(() => import("./pages/errors/Forbidden"));
const ServerErrorPage = lazy(() => import("./pages/errors/ServerError"));

function RouteFallback() {
  return <PageLoader label="Loading…" />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader label="Checking your session…" />;
  if (status === "guest") return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <ForbiddenPage />;
  return <>{children}</>;
}

/** Shorthand used by the dashboard routes below. */
const Guarded = RequirePermission;

function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <PageLoader label="Loading…" />;
  if (status === "authenticated") return <Navigate to="/app/overview" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* Public marketing site */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        </Route>

        {/* Authenticated dashboard */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <DateRangeProvider>
                <DashboardLayout />
              </DateRangeProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<Guarded permission={PERMISSIONS.dashboardView}><OverviewPage /></Guarded>} />
          <Route path="analytics" element={<Guarded permission={PERMISSIONS.analyticsView}><AnalyticsPage /></Guarded>} />
          <Route path="sales" element={<Guarded permission={PERMISSIONS.salesView}><SalesPage /></Guarded>} />
          <Route path="customers" element={<Guarded permission={PERMISSIONS.customersView}><CustomersPage /></Guarded>} />
          <Route path="customers/:customerId" element={<Guarded permission={PERMISSIONS.customersView}><CustomerDetailPage /></Guarded>} />
          <Route path="products" element={<Guarded permission={PERMISSIONS.productsView}><ProductsPage /></Guarded>} />
          <Route path="orders" element={<Guarded permission={PERMISSIONS.ordersView}><OrdersPage /></Guarded>} />
          <Route path="orders/:orderId" element={<Guarded permission={PERMISSIONS.ordersView}><OrderDetailPage /></Guarded>} />
          <Route path="reports" element={<Guarded permission={PERMISSIONS.reportsView}><ReportsPage /></Guarded>} />
          <Route path="goals" element={<Guarded permission={PERMISSIONS.goalsView}><GoalsPage /></Guarded>} />
          <Route path="team" element={<Guarded permission={PERMISSIONS.teamView}><TeamPage /></Guarded>} />
          <Route path="integrations" element={<Guarded permission={PERMISSIONS.settingsManage}><IntegrationsPage /></Guarded>} />
          <Route path="notifications" element={<Guarded permission={PERMISSIONS.notificationsView}><NotificationsPage /></Guarded>} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Errors */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
