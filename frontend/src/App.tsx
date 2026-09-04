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
          <Route
            path="overview"
            element={
              <RequirePermission permission={PERMISSIONS.dashboardView}>
                <OverviewPage />
              </RequirePermission>
            }
          />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
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
