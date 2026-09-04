"""Role-based access control: permission keys and role matrix.

Hierarchy: owner > admin > manager > analyst > viewer.
Permissions are stored in the database (permissions + role_permissions tables)
and synced on startup from this single source of truth.
"""

# ---------------------------------------------------------------------------
# Permission keys
# ---------------------------------------------------------------------------
P_DASHBOARD_VIEW = "dashboard:view"
P_ANALYTICS_VIEW = "analytics:view"
P_SALES_VIEW = "sales:view"
P_SALES_EXPORT = "sales:export"
P_CUSTOMERS_VIEW = "customers:view"
P_CUSTOMERS_MANAGE = "customers:manage"
P_PRODUCTS_VIEW = "products:view"
P_PRODUCTS_MANAGE = "products:manage"
P_ORDERS_VIEW = "orders:view"
P_ORDERS_MANAGE = "orders:manage"
P_REPORTS_VIEW = "reports:view"
P_REPORTS_CREATE = "reports:create"
P_GOALS_VIEW = "goals:view"
P_GOALS_MANAGE = "goals:manage"
P_TEAM_VIEW = "team:view"
P_TEAM_MANAGE = "team:manage"
P_NOTIFICATIONS_VIEW = "notifications:view"
P_SETTINGS_MANAGE = "settings:manage"
P_AUDIT_VIEW = "audit:view"
P_ORG_MANAGE = "org:manage"

ALL_PERMISSIONS = [
    P_DASHBOARD_VIEW,
    P_ANALYTICS_VIEW,
    P_SALES_VIEW,
    P_SALES_EXPORT,
    P_CUSTOMERS_VIEW,
    P_CUSTOMERS_MANAGE,
    P_PRODUCTS_VIEW,
    P_PRODUCTS_MANAGE,
    P_ORDERS_VIEW,
    P_ORDERS_MANAGE,
    P_REPORTS_VIEW,
    P_REPORTS_CREATE,
    P_GOALS_VIEW,
    P_GOALS_MANAGE,
    P_TEAM_VIEW,
    P_TEAM_MANAGE,
    P_NOTIFICATIONS_VIEW,
    P_SETTINGS_MANAGE,
    P_AUDIT_VIEW,
    P_ORG_MANAGE,
]

PERMISSION_DESCRIPTIONS: dict[str, str] = {
    P_DASHBOARD_VIEW: "View the dashboard overview",
    P_ANALYTICS_VIEW: "View analytics and charts",
    P_SALES_VIEW: "View sales analytics",
    P_SALES_EXPORT: "Export sales data",
    P_CUSTOMERS_VIEW: "View customer data",
    P_CUSTOMERS_MANAGE: "Create and edit customers",
    P_PRODUCTS_VIEW: "View products and inventory",
    P_PRODUCTS_MANAGE: "Create, edit and delete products",
    P_ORDERS_VIEW: "View orders",
    P_ORDERS_MANAGE: "Create and update orders",
    P_REPORTS_VIEW: "View generated reports",
    P_REPORTS_CREATE: "Generate reports and export CSV",
    P_GOALS_VIEW: "View business goals",
    P_GOALS_MANAGE: "Create and edit goals",
    P_TEAM_VIEW: "View team members",
    P_TEAM_MANAGE: "Invite, change roles and remove members",
    P_NOTIFICATIONS_VIEW: "View notifications",
    P_SETTINGS_MANAGE: "Manage organization settings",
    P_AUDIT_VIEW: "View audit logs",
    P_ORG_MANAGE: "Manage organization (owner only)",
}

# ---------------------------------------------------------------------------
# Role matrix
# ---------------------------------------------------------------------------
ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_ANALYST = "analyst"
ROLE_VIEWER = "viewer"

ROLE_DESCRIPTIONS: dict[str, str] = {
    ROLE_OWNER: "Full access to everything",
    ROLE_ADMIN: "Almost full access, except organization management",
    ROLE_MANAGER: "Business and sales management",
    ROLE_ANALYST: "Analytics and reports",
    ROLE_VIEWER: "Read-only access",
}

ROLE_PERMISSIONS: dict[str, list[str]] = {
    ROLE_VIEWER: [
        P_DASHBOARD_VIEW,
        P_ANALYTICS_VIEW,
        P_SALES_VIEW,
        P_CUSTOMERS_VIEW,
        P_PRODUCTS_VIEW,
        P_ORDERS_VIEW,
        P_REPORTS_VIEW,
        P_GOALS_VIEW,
        P_NOTIFICATIONS_VIEW,
        P_TEAM_VIEW,
    ],
    ROLE_ANALYST: [
        P_DASHBOARD_VIEW,
        P_ANALYTICS_VIEW,
        P_SALES_VIEW,
        P_SALES_EXPORT,
        P_CUSTOMERS_VIEW,
        P_PRODUCTS_VIEW,
        P_ORDERS_VIEW,
        P_REPORTS_VIEW,
        P_REPORTS_CREATE,
        P_GOALS_VIEW,
        P_NOTIFICATIONS_VIEW,
        P_TEAM_VIEW,
    ],
    ROLE_MANAGER: [
        P_DASHBOARD_VIEW,
        P_ANALYTICS_VIEW,
        P_SALES_VIEW,
        P_SALES_EXPORT,
        P_CUSTOMERS_VIEW,
        P_CUSTOMERS_MANAGE,
        P_PRODUCTS_VIEW,
        P_PRODUCTS_MANAGE,
        P_ORDERS_VIEW,
        P_ORDERS_MANAGE,
        P_REPORTS_VIEW,
        P_REPORTS_CREATE,
        P_GOALS_VIEW,
        P_GOALS_MANAGE,
        P_NOTIFICATIONS_VIEW,
        P_TEAM_VIEW,
    ],
    ROLE_ADMIN: [p for p in ALL_PERMISSIONS if p not in (P_ORG_MANAGE, P_AUDIT_VIEW)],
    ROLE_OWNER: ALL_PERMISSIONS,
}