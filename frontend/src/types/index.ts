// Shared API types — mirror the FastAPI response models.

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  /** Products at or below this stock level are flagged as low stock. */
  low_stock_threshold: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  organization: Organization;
  role: string;
}

export interface Workspace extends Organization {
  role: string;
}

export interface MeResponse {
  user: User;
  organization: Organization;
  role: string;
  permissions: string[];
  /** Every organization the user can switch into (includes the current one). */
  workspaces: Workspace[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  status: "active" | "draft" | "archived";
  category_id: number | null;
  category_name: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  segment: "new" | "returning" | "vip" | "inactive";
  created_at: string;
  last_order_at: string | null;
  total_spent: number | null;
  order_count: number | null;
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type Channel = "online" | "in_store" | "wholesale" | "partner";

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  channel: Channel;
  region: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  placed_at: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  items: OrderItem[];
}

export interface Kpis {
  revenue: number;
  revenue_change: number;
  orders: number;
  orders_change: number;
  new_customers: number;
  customers_change: number;
  total_customers: number;
  conversion_rate: number;
  conversion_change: number;
  aov: number;
  aov_change: number;
  profit: number;
  refunds: number;
  visitors: number;
  conversions: number;
}

export interface SeriesPoint {
  key: string;
  label: string;
  value?: number;
  count?: number;
  gross?: number;
  net?: number;
  refunds?: number;
  units?: number;
  visitors?: number;
  conversions?: number;
  new?: number;
  returning?: number;
  total?: number;
}

export type Interval = "day" | "week" | "month" | "year";

export interface OverviewResponse {
  /** `interval` is the granularity the server picked for the bundled series. */
  range: { start: string; end: string; interval: Interval };
  kpis: Kpis;
  revenue_series: { interval: string; total: number; points: SeriesPoint[] };
  sales_series: { interval: string; points: SeriesPoint[]; totals: Record<string, number> };
  customer_series: { interval: string; points: SeriesPoint[] };
  revenue_by_category: { name: string; value: number }[];
  revenue_by_source: { name: string; value: number }[];
  geographic: { region: string; orders: number; revenue: number }[];
  top_products: ProductPerformance[];
  recent_orders: {
    id: number;
    order_number: string;
    customer_name: string | null;
    status: OrderStatus;
    total: number;
    placed_at: string;
  }[];
  low_stock: { id: number; name: string; stock: number; sku: string; threshold: number }[];
}

export interface ProductPerformance {
  id: number;
  name: string;
  category: string | null;
  category_id: number | null;
  units_sold: number;
  revenue: number;
  profit: number;
  margin: number;
  trend: number;
  stock: number;
  status: string;
  price: number;
}

export interface SalesMetrics {
  gross_revenue: number;
  net_revenue: number;
  refunds: number;
  units_sold: number;
  orders: number;
  aov: number;
  conversion_rate: number;
  visitors: number;
  conversions: number;
}

export interface CustomerMetrics {
  total_customers: number;
  new_customers: number;
  new_customers_change: number;
  returning_customers: number;
  retention_rate: number;
  avg_lifetime_value: number;
  avg_order_frequency: number;
  avg_order_value: number;
  segments: Record<"new" | "returning" | "vip" | "inactive", number>;
}

export interface Goal {
  id: number;
  name: string;
  type: "revenue" | "orders" | "customers" | "profit";
  target: number;
  period: string;
  starts_at: string;
  ends_at: string;
  status: string;
  progress: number | null;
  progress_pct: number | null;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  unread: number;
  items: NotificationItem[];
}

export interface ReportSummary {
  id: number;
  name: string;
  type: string;
  filters: Record<string, unknown>;
  status: string;
  created_at: string;
  created_by_name: string | null;
}

export interface ReportDetail extends ReportSummary {
  data: Record<string, unknown>;
}

export interface Member {
  id: number;
  user_id: number | null;
  full_name: string;
  email: string;
  role: string;
  status: "active" | "pending";
  last_active_at: string | null;
  created_at: string;
}

export interface SearchResults {
  query: string;
  customers: { id: number; name: string; email: string; segment: string }[];
  orders: { id: number; order_number: string; status: OrderStatus; total: number }[];
  products: { id: number; name: string; sku: string; stock: number; price: number }[];
  reports: { id: number; name: string; type: string }[];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  resource_type: string;
  resource_id: number | null;
  details: Record<string, unknown> | null;
  user_name: string;
  created_at: string;
}

export interface CustomerDetailResponse {
  customer: Customer;
  orders: {
    id: number;
    order_number: string;
    status: OrderStatus;
    total: number;
    placed_at: string;
    channel: Channel;
    items_count: number;
  }[];
}

// Permission keys (mirror backend)
export const PERMISSIONS = {
  dashboardView: "dashboard:view",
  analyticsView: "analytics:view",
  salesView: "sales:view",
  salesExport: "sales:export",
  customersView: "customers:view",
  customersManage: "customers:manage",
  productsView: "products:view",
  productsManage: "products:manage",
  ordersView: "orders:view",
  ordersManage: "orders:manage",
  reportsView: "reports:view",
  reportsCreate: "reports:create",
  goalsView: "goals:view",
  goalsManage: "goals:manage",
  teamView: "team:view",
  teamManage: "team:manage",
  notificationsView: "notifications:view",
  settingsManage: "settings:manage",
  auditView: "audit:view",
  orgManage: "org:manage",
} as const;
