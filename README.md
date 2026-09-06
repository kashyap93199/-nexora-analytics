<div align="center">

# 📊 Nexora Analytics

**Turn business data into better decisions.**

A production-quality, multi-tenant **business analytics SaaS** — a polished marketing site plus a full
authenticated dashboard where revenue, sales, customers, products, goals and reports are calculated
**live from real database records**.

![stack](https://img.shields.io/badge/React%2018-TypeScript-3178c6) ![stack](https://img.shields.io/badge/FastAPI-Python-009688) ![stack](https://img.shields.io/badge/PostgreSQL-SQLAlchemy-4169e1) ![stack](https://img.shields.io/badge/Tailwind%20CSS-v3-06b6d4) ![license](https://img.shields.io/badge/license-MIT-green)

**Live demo** · [demo@nexora.app](mailto:demo@nexora.app) / `DemoPassword123!` *(demo workspace pre-loaded with ~2 years of realistic data)*

</div>

---

## Table of contents

1. [Product overview](#-product-overview)
2. [Features](#-features)
3. [Tech stack](#-tech-stack)
4. [Architecture](#-architecture)
5. [Database schema](#-database-schema)
6. [API overview](#-api-overview)
7. [Getting started (local dev)](#-getting-started-local-dev)
8. [Demo credentials & seed data](#-demo-credentials--seed-data)
9. [Tests](#-tests)
10. [Docker](#-docker)
11. [Production deployment](#-production-deployment)
12. [Screenshots](#-screenshots)
13. [Future improvements](#-future-improvements)

---

## 🧭 Product overview

Nexora Analytics is a **multi-tenant SaaS** with two cleanly separated experiences:

| Experience | URL | Description |
| --- | --- | --- |
| **Public marketing site** | `/`, `/features`, `/pricing`, `/about`, `/contact`, `/login`, `/register` | A premium SaaS landing experience used to explain and sell the product. |
| **Authenticated dashboard** | `/app/*` | Revenue, analytics, sales, customers, products, orders, reports, goals, team, integrations, notifications and settings — all role-gated. |

Target users: small businesses, startups, agencies, e-commerce brands, freelancers and operators who
need one place to understand **revenue, orders, customers, products and performance**.

## ✨ Features

**Marketing site**
- Full landing experience: hero with product mockup, trusted-by, feature sections with chart previews, how-it-works, benefits, testimonials, pricing, FAQ and CTA
- Functional auth pages with client + server validation and an invite-token flow

**Dashboard**
- **KPI cards** (Revenue, Orders, Customers, Conversion rate, AOV) with period-over-period deltas computed from real records
- **Charts**: revenue area/line with *daily/weekly/monthly/yearly* granularity, sales vs refunds, customer growth (new vs returning), revenue by category (donut + list), revenue by source, traffic & conversions, geographic performance
- **Global date-range filter** (today → custom range) that re-computes every page
- **Sales analytics** with region / channel / product / category filters and CSV export
- **Customer analytics**: segments (New / Returning / VIP / Inactive), retention, lifetime value, per-customer profiles with purchase history
- **Product performance table**: units, revenue, profit, margin, trend, inventory alerts + full CRUD
- **Orders**: search, filter, sort, pagination, detail view, **enforced status state machine** (stock is reserved for live orders and released on cancel), order creation
- **Reports**: 5 report types, preview, saved snapshots, CSV export
- **One-click CSV exports** of the filtered Orders, Customers and Products lists (`sales:export` permission, audited, formula-safe)
- **Goals**: revenue / orders / customers / profit targets with **live progress** computed from data
- **Team**: invite (shareable link), re-send/rotate invites, roles with owner-safety rails, activity, removal
- **Multi-workspace accounts**: a user invited to several organizations can switch between them from the account menu
- **Notifications**, **global search (⌘K)**, **settings** (currency, configurable low-stock threshold), **audit logs** (owner, filterable by action / resource / date)
- **Dark mode** (light / dark / system, persisted) and **responsive layouts** (375px → 4K)
- Loading skeletons, empty states, error states, toasts, confirmation dialogs everywhere

## 🧰 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS 3 · Recharts · Lucide icons · React Router 6 |
| Backend | Python 3.10+ · FastAPI · SQLAlchemy 2 · Pydantic v2 |
| Database | PostgreSQL 16 (SQLite for local dev/tests) |
| Auth | JWT access + rotating refresh tokens · bcrypt password hashing · RBAC |
| Infra | Docker · docker-compose · nginx (SPA + reverse proxy) · pytest · Vitest |

## 🏗 Architecture

```
Business-Analytics-SaaS-project/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py             # App factory, middleware, routing
│   │   ├── config.py           # pydantic-settings (env-driven)
│   │   ├── api/
│   │   │   ├── deps.py         # auth, tenant + RBAC dependencies
│   │   │   └── routes/         # one module per resource
│   │   ├── auth/               # JWT + hashing + permission matrix
│   │   ├── database/           # engine/session (SQLite ↔ PostgreSQL)
│   │   ├── models/             # SQLAlchemy ORM (15 tables)
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # analytics + bootstrap + seeder
│   │   └── utils/              # audit logging
│   ├── scripts/smoke_test.py   # end-to-end API smoke test
│   ├── scripts/audit_runtime.py  # runtime QA: user journeys + RBAC + tenancy
│   ├── tests/                  # pytest suite (auth/RBAC/tenancy/analytics)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/         # ui kit + layout (sidebar, topbar, modals…)
│   │   ├── charts/             # themed Recharts wrappers
│   │   ├── contexts/           # Auth, Theme, Toasts, DateRange
│   │   ├── hooks/              # useApi, useMutation, count-up…
│   │   ├── lib/                # utils, validation, date presets
│   │   ├── pages/marketing/    # public site
│   │   ├── pages/dashboard/    # /app/* pages
│   │   └── services/           # API client w/ silent token refresh
│   ├── Dockerfile + nginx.conf
│   └── package.json
├── docker-compose.yml          # postgres + api + web
├── .env.example                # env template
└── README.md
```

**Key design decisions**

- **Multi-tenancy** — every business row carries `organization_id`; the `get_membership` dependency scopes every query. Cross-tenant access returns 404/403 (covered by tests).
- **RBAC matrix** — `owner → admin → manager → analyst → viewer` map to 20 fine-grained permission keys persisted in `permissions` + `role_permissions` and enforced in the API layer, not the UI.
- **No fake analytics** — all KPIs are SQL aggregations over orders/customers/sales records (e.g. revenue = `SUM(order.total)` for realized statuses; conversion = `conversions / visitors` from the sales table). Percentage changes compare against the previous equal-length period.
- **One schema, two engines** — the ORM model is portable; SQLite powers frictionless local dev and tests, PostgreSQL powers Docker/production via `DATABASE_URL`.

## 🗄 Database schema

```
users ──< organization_members >── organizations
roles ──< role_permissions >── permissions        (RBAC)
organizations ──< categories ──< products
organizations ──< customers ──< orders ──< order_items ──> products
organizations ──< sales                    (daily per-product traffic & units)
organizations ──< revenue_records          (daily revenue by source)
organizations ──< goals | notifications | reports | audit_logs
```

Relationships use proper primary/foreign keys, indexes on tenant + hot columns
(`organization_id`, `placed_at`, `status`…), check-like validation at the API layer, and soft-safety
cascades (`SET NULL` for deleted products/customers so history survives).

## 🔌 API overview

Base URL `/api` — interactive docs at `/api/docs` (Swagger). All business endpoints require
`Authorization: Bearer <access_token>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` (includes `permissions` + `workspaces`) · `GET /auth/workspaces` · `POST /auth/switch-organization` · `POST /auth/logout` |
| Dashboard | `GET /dashboard/overview` (KPIs + zero-filled series at an auto-selected interval + top products + recent orders + low stock) |
| Analytics | `GET /analytics/revenue?start&end&interval` · `/analytics/sales` · `/analytics/customers` · `/analytics/products` · `/analytics/categories` · `/analytics/geographic` |
| Catalog | `GET/POST/PUT/DELETE /products[/{id}]` · `GET /products/export` (CSV) · `GET/POST /categories…` |
| Customers | `GET/POST /customers` · `GET /customers/{id}` (with history) · `PUT/DELETE` · `GET /customers/export` (CSV) |
| Orders | `GET/POST /orders` (filters incl. `customer_id`) · `GET /orders/{id}` · `PATCH /orders/{id}/status` (409 on illegal transition) · `GET /orders/export` (CSV) |
| Reports | `GET/POST /reports` · `GET /reports/{id}` · `GET /reports/{id}/export` (CSV) · `DELETE` |
| Goals / Team | `GET/POST/PUT/DELETE /goals…` · `GET /team` · `POST /team/invite` · `POST /team/{id}/resend` · `PUT /team/{id}/role` · `DELETE /team/{id}` |
| Notifications | `GET /notifications` · `POST /notifications/{id}/read` · `POST /notifications/read-all` |
| Other | `GET /search?q=` (categorized global search) · `GET/PUT /settings/…` · `GET /audit-logs?action&resource_type&start&end` · `GET /health` (`{status, database, version}`) |

Responses use consistent shapes: `Page<T> { items, total, page, page_size, pages }` for lists,
`{"detail": "human message"}` for errors with proper status codes (400/401/403/404/409/422/429/503).
Every response carries an `X-Request-ID` header (echoed from the request if supplied) plus
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.

**Order status state machine** (enforced server-side, mirrored in the UI):
`pending → processing | shipped | delivered | cancelled` · `processing → shipped | delivered | cancelled` ·
`shipped → delivered | cancelled | refunded` · `delivered → refunded` · `cancelled` / `refunded` are terminal.
Stock is held while an order is pending/processing/shipped/delivered and released when it is cancelled or refunded.

## 🚀 Getting started (local dev)

Prerequisites: **Python 3.10+** (3.11 recommended, used in Docker), **Node 18+**.

```bash
# 1) Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt     # or pip on Windows
.venv/bin/python -m app.services.seed             # creates tables + demo data
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev                                        # http://localhost:5173
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` to the backend.

**Other commands**

```bash
# backend tests + smoke test
cd backend && .venv/bin/python -m pytest
cd backend && PYTHONPATH=. .venv/bin/python scripts/smoke_test.py

# frontend checks
cd frontend && npm run typecheck && npm run test && npm run build
```

## 🔐 Demo credentials & seed data

The seeder creates the **Acme Inc** demo workspace with ~2 years of internally consistent data:
40+ products across 8 categories, 620 customers, thousands of orders with line items, daily sales
records (traffic/units/conversions), revenue records, goals and notifications — all generated with a
fixed random seed.

| Role | Email | Password |
| --- | --- | --- |
| Owner (demo) | `demo@nexora.app` | `DemoPassword123!` |
| Admin | `sarah@acme.demo` | `AdminPassword123!` |
| Manager | `marcus@acme.demo` | `ManagerPassword123!` |

> ⚠️ Demo credentials are for portfolio/testing only — never use them in production.

The seeder is idempotent: re-running `python -m app.services.seed` adds only what's missing, so you
can safely restart. Seed data is clearly separated from your own accounts: sign up with any other
email to get a fresh, empty organization.

## 🧪 Tests

| Suite | What it covers | How to run |
| --- | --- | --- |
| Backend (`backend/tests/`) | Registration/login/refresh/validation, RBAC for all 5 roles, **tenant isolation**, analytics math on controlled data, goal progress, date-range filtering, plus `test_regressions.py` covering every bug fixed in the audit (workspace switching, order state machine, stock release, uniqueness rules, CSV exports, LIKE escaping, low-stock threshold, audit filters…) | `cd backend && .venv/bin/python -m pytest` (53 tests) |
| Backend smoke | End-to-end CRUD + auth + export against the seeded DB | `python scripts/smoke_test.py` |
| Runtime QA | User journeys, invite flow, RBAC attempts, tenancy ID-swap, report exports | `PYTHONPATH=. python scripts/audit_runtime.py` |
| Frontend (Vitest) | Validators (incl. invite mode), date presets, date-range persistence, order-transition table, formatting, Badge/Button/Delta/ProgressBar/StatCard, **registration form validation flow** | `cd frontend && npm run test` (36 tests) |

## 🐳 Docker

```bash
cp .env.example .env        # set a real SECRET_KEY
docker compose up --build
```

- `web` → **http://localhost:3000** (nginx serves the SPA and proxies `/api`)
- `api` → FastAPI on the internal network (healthcheck-gated), seeds the demo workspace on first boot
- `db` → PostgreSQL 16 with a persistent volume

## ☁️ Production deployment

The project is deployment-ready for free tiers. Everything is env-driven with **no hard-coded secrets**.

**Database — any managed PostgreSQL** (e.g. Neon, Supabase, Railway):
Create a database and set `DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname`.

**Backend — Render/Railway/Fly.io** (Python worker, `uvicorn app.main:app`):
```bash
cd backend
pip install -r requirements.txt
python -m app.services.seed      # first boot only
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
Set `SECRET_KEY` (use `python3 -c "import secrets; print(secrets.token_hex(32))"`) and `CORS_ORIGINS` to your frontend domain.

**Frontend — Vercel/Netlify** (static SPA, build `npm run build`, output `dist`):
Add a rewrite of all routes to `/index.html` for client-side routing, and a proxy of `/api/*` to the
backend URL (or build with `VITE_API_URL=https://your-api.example`).

## 📸 Screenshots

| | |
| --- | --- |
| Marketing home | Hero with live-feel dashboard mockup, feature sections, pricing, FAQ |
| Dashboard overview | 5 KPI cards with deltas, revenue chart with D/W/M/Y switch, category donut, customer growth, top products, goal progress, recent orders |
| Analytics & Sales | Interval + chart-type controls, filters, traffic/conversion, geographic performance, CSV export |
| Products & Orders | Merged performance table (units/revenue/profit/margin/trend/stock), order statuses & detail |
| Team & Settings | Invite flow with shareable links, role matrix, audit log, appearance |

Both themes are fully supported. See `frontend/src/pages/` for source.

## ⚙️ Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | dev placeholder (warning logged) | JWT signing key — **must** be set in production |
| `DATABASE_URL` | `sqlite:///./nexora.db` | SQLAlchemy URL (SQLite for dev, `postgresql+psycopg://…` in Docker) |
| `APP_ENV` | `development` | Reported by `/api/health`; `production` tightens defaults |
| `CORS_ORIGINS` | localhost origins | JSON/CSV list of allowed browser origins |
| `RATE_LIMIT_ENABLED` | `true` | In-memory per-IP limiter for auth endpoints |
| `TRUST_PROXY_HEADERS` | `false` | Honour `X-Forwarded-For` for rate limiting — enable **only** behind a trusted reverse proxy (docker-compose sets it) |

See `INSPECTION_AND_IMPROVEMENTS_REPORT.md` for the full audit of the codebase, every defect found,
how each was fixed and which features were added.

## 🔮 Future improvements

- Payment processing (Stripe) on the Growth/Business plans
- Email delivery for invites/reports (SMTP provider)
- Scheduled report emails and PDF rendering
- Refresh-token denylist via Redis
- Row-level realtime sync (WebSockets) and CSV product/customer import
- Multi-currency order handling and internationalized number formats
- Integration connectors (Stripe/Shopify catalog currently showcased as roadmap)

---

Built as a demonstration of production-grade full-stack SaaS architecture: React + TypeScript +
Tailwind, FastAPI + PostgreSQL, multi-tenant RBAC, real computed analytics, Docker, tests, and docs.

> **MIT** — free to use and learn from.
