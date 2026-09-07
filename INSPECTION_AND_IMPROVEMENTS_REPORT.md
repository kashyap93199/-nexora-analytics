# Nexora Analytics — Full Project Inspection & Improvements Report

**Date:** 2026-09-06 · **Branch:** `arena/01a0762f-nexora-analytics` (from `main@a0c8385`)
**Scope:** complete read-through of backend + frontend + deployment, runtime reproduction of every suspected defect, fixes, new features, regression tests, documentation.

---

## 1. Executive summary

Nexora Analytics is a multi-tenant business-analytics SaaS (FastAPI + SQLAlchemy 2 + Pydantic v2 backend, React 18 + TypeScript + Vite + Tailwind + Recharts frontend, JWT auth with 5 roles / 20 permissions, Docker + nginx deployment). The architecture is sound and the previous audits (`PROJECT_AUDIT_REPORT.md`, `CODEBASE_CLEANUP_REPORT.md`) had already removed most cosmetic problems.

This inspection went one level deeper — **every finding below was reproduced by executing code**, not just by reading it — and found **21 genuine defects**, several of which were data-integrity or security problems:

| Severity | Count | Examples |
| --- | --- | --- |
| 🔴 Critical / data integrity | 6 | Registration left orphaned users on a conflict; invite tokens could be claimed by *any* email; users invited to a second workspace could never reach it; cancelled orders never returned stock; duplicate order numbers; negative order totals |
| 🟠 High | 7 | Duplicate SKUs / customer emails / categories accepted; AOV reported as LTV; unsorted "top products"; unvalidated report `type`; `datetime.UTC` breaking the advertised Python 3.10; rate-limiter memory leak + spoofable client IP; LIKE wildcards unescaped in search |
| 🟡 Medium / UX | 8 | Invite registration blocked by the UI validator; hard-coded `USD` in Goals panel; dashboard charts always bucketed by month; low-stock threshold hard-coded (in two places); order status UI offered illegal transitions; unguarded dashboard routes; product tiles computed from one page; date range lost on reload |

All 21 are fixed. In addition **9 features** were added (workspace switching, CSV exports for orders/customers/products, order state machine, configurable low-stock threshold, invite re-send, audit-log filters, adaptive chart granularity with zero-filled series, request-id / security headers, richer health check).

**Verification:** backend **53/53** pytest (22 original + 31 new regression tests), runtime QA script **37/37**, smoke test ✅, frontend `tsc` clean, **36/36** vitest (24 original + 12 new), production `vite build` ✅, and a live end-to-end run against the seeded demo database.

---

## 2. Project architecture (as inspected)

```
-nexora-analytics/
├── backend/                      FastAPI application (≈4.9k lines)
│   ├── app/main.py               app factory, middleware (rate limit, request-id, timing, security headers), error handlers, /api/health
│   ├── app/config.py             pydantic-settings (SECRET_KEY, DATABASE_URL, CORS, rate limit, TRUST_PROXY_HEADERS)
│   ├── app/database/db.py        engine/session, init_db() with lightweight "migrations" for legacy DBs
│   ├── app/models/               organization (+members, roles, permissions), user, catalog, commerce, engagement
│   ├── app/auth/                 bcrypt + PyJWT (access/refresh with `org` claim), permission constants
│   ├── app/api/deps.py           get_current_user → resolve_membership (token org → fallback), require_permission, pagination
│   ├── app/api/routes/           auth, dashboard, analytics, products, customers, orders, reports, goals, team,
│   │                             notifications, search, settings, audit
│   ├── app/services/analytics.py all KPI / series / segment maths (single source of truth for revenue statuses)
│   ├── app/services/seed.py      demo org "Acme Inc" (demo@nexora.app / DemoPassword123!)
│   ├── app/utils/                audit writer, csv_export (formula-safe), query (LIKE escaping)
│   ├── scripts/                  smoke_test.py, audit_runtime.py (37 journey/RBAC/tenancy checks)
│   └── tests/                    pytest suites (auth, rbac, tenancy, analytics, regressions)
├── frontend/                     React 18 + TS + Vite (≈8.6k lines)
│   ├── src/services/api.ts       fetch wrapper, token store, refresh-on-401, CSV download helper
│   ├── src/contexts/             Auth (me/permissions/workspaces, switchOrganization), DateRange (persisted), Theme, Toast
│   ├── src/components/layout/    DashboardLayout (sidebar, ⌘K search, notifications, account menu + workspace switcher)
│   ├── src/pages/dashboard/      Overview, Analytics, Sales, Customers(+Detail), Products, Orders(+Detail), Reports, Goals,
│   │                             Team, Integrations, Notifications, Settings
│   └── src/pages/marketing/      Home, Features, Pricing, About, Contact, Login, Register (invite mode)
├── docker-compose.yml            postgres:16 + api (uvicorn, 2 workers) + web (nginx :3000 → /api proxy)
└── README.md, .env.example, audit reports
```

**Tenancy model.** Every business table carries `organization_id`; every route resolves the caller's `OrganizationMember` and filters by it. Cross-tenant access returns 404 (verified by `tests/test_tenancy.py` and the runtime audit's ID-swap checks).

**RBAC.** `owner > admin > manager > analyst > viewer`, 20 permission keys synced into the DB at startup (`bootstrap.sync_roles_and_permissions`). `require_permission()` is used on every mutating route; the frontend mirrors it with `hasPermission()` for navigation and now for route guards too.

---

## 3. Defects found, reproduced and fixed

Each item lists: symptom → root cause → fix → test.

### 3.1 Authentication, registration & multi-tenancy

| # | Defect | Root cause | Fix | Test |
| --- | --- | --- | --- | --- |
| 1 | **Registering an org whose name already existed returned 409 and left an orphaned `users` row** (email then permanently "taken"). | Slug = `slugify(name)` with a UNIQUE constraint; user was committed before the org insert failed. | `_unique_org_slug()` appends a short suffix on collision; user + org + membership + audit row are written in **one transaction** (`write_audit(commit=False)`). | `test_two_orgs_with_the_same_name_can_both_register`, `test_failed_registration_leaves_no_orphaned_user` |
| 2 | **Invite tokens could be redeemed by any email address.** | Token lookup ignored `invite_email`. | Registration with a token now requires `email == invite_email` (403 otherwise). | `test_invite_can_only_be_claimed_by_the_invited_email` |
| 3 | **Invited users could not register from the UI**: `validateRegistration` demanded an org name (field hidden), and the backend rejected `organization_name: ""` with 422. | Front + back both treated org name as unconditionally required. | Backend: blank org/invite normalised to `None`, org required only when no token. Frontend: `validateRegistration(form, { requireOrganization: !inviteToken })`, payload omits the org. | `test_invite_registration_accepts_blank_org_name_from_ui`; vitest "does not require an organization name when joining via invitation" + Register page invite-mode test |
| 4 | **A user invited to a second organization could never reach it** — `get_membership` always picked the first membership. | No org context in the token. | Access/refresh tokens carry an `org` claim; `resolve_membership()` honours it (falls back to the oldest active membership if that membership was removed). New `GET /auth/workspaces` and `POST /auth/switch-organization`; `/auth/me` returns `workspaces[]`. UI: workspace switcher in the account menu. | `test_existing_user_added_to_second_org_can_switch_workspaces`, `test_removed_member_token_falls_back_to_remaining_workspace` |
| 5 | Re-inviting a pending email created a **second pending row** instead of rotating the token. | No existing-row check. | Pending re-invite rotates token/role; inviting an *existing user* activates them immediately and sends an in-app notification. | `test_reinviting_pending_email_rotates_token_instead_of_duplicating` |
| 6 | `datetime.UTC` used in routes → **ImportError on Python 3.10**, which the README advertises. | 3.11-only alias. | `utcnow()` helper in `auth/security.py`; routes use it. | import-time (all suites) |

### 3.2 Orders, inventory & money

| # | Defect | Root cause | Fix | Test |
| --- | --- | --- | --- | --- |
| 7 | **`discount > subtotal` produced negative tax and a negative total.** | No bound check. | 400 `"Discount cannot exceed the subtotal"`; all money maths moved to `Decimal`. | `test_discount_cannot_exceed_subtotal` |
| 8 | **Cancelling/refunding an order never restored stock**; any status could move to any other (delivered → pending…). | Status endpoint was a plain field update. | `ALLOWED_TRANSITIONS` state machine (409 on illegal move) and `STOCK_HOLDING_STATUSES`: stock is reserved while pending/processing/shipped/delivered and released on cancel/refund. UI stepper/menus only offer legal moves. | `test_cancelling_an_order_restores_stock`, `test_order_status_transitions_are_validated`; vitest `orderTransitions.test.ts` |
| 9 | **Duplicate order numbers** when two orders were created in the same second. | `ORD-%Y%m%d%H%M%S`. | `ORD-YYYYMMDD-XXXXXX` (random hex, retried until unique) + unique index `(organization_id, order_number)`. | `test_order_numbers_are_unique_within_the_same_second` |
| 10 | Two lines for the same product bypassed the stock check (each checked separately). | Per-line validation. | Duplicate lines are merged before validation. | `test_duplicate_lines_are_merged_for_stock_checks` |
| 11 | Orders list could not be filtered by customer (customer detail page had to fetch everything). | Missing param. | `GET /orders?customer_id=`. | `test_orders_can_be_filtered_by_customer` |

### 3.3 Catalog & customers

| # | Defect | Fix | Test |
| --- | --- | --- | --- |
| 12 | **Duplicate SKUs, customer emails and category names were accepted** within an org. | Case-insensitive 409 checks + unique DB index `(organization_id, sku)`; category must belong to the org. | `test_duplicate_sku_rejected_per_org`, `test_duplicate_customer_email_rejected_per_org`, `test_duplicate_category_name_rejected` |
| 13 | Customer list issued **one query per row** for spend/order counts (N+1). | Single grouped query (`_spend_stats`). | covered by existing customer tests |
| 14 | Goal update could **persist a partial change** when dates were invalid (mutated before validating). | Validate first, then assign. | `test_invalid_goal_update_does_not_persist_partial_changes` |

### 3.4 Analytics correctness

| # | Defect | Fix | Test |
| --- | --- | --- | --- |
| 15 | **"Top products" was not sorted** — it returned the first 5 rows in arbitrary order. | Sorted by revenue, then units. | `test_top_products_are_sorted_by_revenue` |
| 16 | **Average order value == lifetime value** on the Customers page (same number under two labels); LTV/AOV also counted cancelled & refunded orders. | `period_aov` = revenue / orders over `REVENUE_STATUSES` for the selected period; LTV restricted to the same statuses. | `test_customer_avg_order_value_differs_from_ltv` |
| 17 | Goal progress for `orders` counted cancelled/refunded orders (and loaded every row just to count). | `COUNT` over `REVENUE_STATUSES`. | `test_goal_order_progress_ignores_cancelled_orders` |
| 18 | Revenue-by-category **silently dropped uncategorised products** (inner join) so the donut didn't add up. | Outer join → "Uncategorized" slice. | runtime audit "product performance has category ids" + overview checks |
| 19 | Series had **gaps** (buckets with no data were omitted) and the customer "total" line started from 0 instead of the existing base. | `bucket_range()` / `_dense()` zero-fill every bucket in range; cumulative starts from customers created before the period. | `test_dashboard_interval_adapts_to_range` (7 daily points for a 7-day range, 12 for a year) |

### 3.5 Reports, search, validation

| # | Defect | Fix | Test |
| --- | --- | --- | --- |
| 20 | Report `type` filter unvalidated; inverted date ranges accepted; CSV filename built from the raw report name. | Regex-validated `type`, 400 on `end < start`, sanitised filename, shared formula-safe CSV writer. | `test_report_type_filter_is_validated`, `test_report_rejects_inverted_date_range` |
| 21 | **Search / list filters did not escape `%` and `_`** — searching `_` matched everything. | `utils/query.icontains()` escapes LIKE metacharacters everywhere (products, customers, orders, search, audit). | `test_search_escapes_like_wildcards` |

### 3.6 Platform, security & operations

| Area | Before | After |
| --- | --- | --- |
| Rate limiter | Unbounded dict (memory leak); trusted `X-Forwarded-For` unconditionally (spoofable). | Periodic sweep under a lock; XFF honoured only when `TRUST_PROXY_HEADERS=true` (set in docker-compose behind nginx). |
| Error handling | `IntegrityError` → 500 with stack trace; DB outage → 500. | 409 `"conflicts with an existing record"` / 503 `"database unavailable"`; `/api/health` reports `database` and `version`. |
| Headers | none | `X-Request-ID` (echoed/generated), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; request timing logged with the id. |
| Secrets | default `SECRET_KEY` silently accepted. | Startup warning when the default key is used. |
| Passwords | no upper bound → bcrypt silently truncates at 72 bytes. | `max_length=72` on register + change-password (front + back), "same password" rejected. |
| Team safety | owner could demote self; admins could promote to owner; last owner removable; no audit on removal. | Role-change rules (no self change, only owners touch the owner role, last owner protected, admin-on-admin rules), notifications on role change, audited removals. |
| Audit trail | deletes / email & password changes / exports not audited. | All audited with details. |
| Currency | free-text. | 3-letter ISO-4217 pattern, upper-cased. |
| Frontend routing | only `/app/overview` was permission-guarded — a viewer could deep-link to `/app/team` and see a page that 403'd on every request. | Every dashboard route wrapped in `Guarded permission=…`. |

---

## 4. Features added

| Feature | Backend | Frontend |
| --- | --- | --- |
| **Multi-workspace accounts** | `org` JWT claim, `GET /auth/workspaces`, `POST /auth/switch-organization`, `/auth/me.workspaces` | "Switch workspace" section in the account menu (shows role, active check-mark), `AuthContext.switchOrganization()` |
| **CSV exports** for Orders / Customers / Products (respect current filters, 10k-row cap, `sales:export` permission, audited, CSV-injection safe) | `GET /orders/export`, `/customers/export`, `/products/export`, shared `utils/csv_export.py` | "Export CSV" buttons on the three pages |
| **Order status state machine** | `ALLOWED_TRANSITIONS`, stock hold/release | Stepper + menus only offer legal moves, terminal-state messaging |
| **Configurable low-stock threshold** (was hard-coded 15 in backend *and* frontend) | `Organization.low_stock_threshold` (+ legacy migration), `PUT /settings/organization`, `low_stock[].threshold` | Settings field; Products page + dashboard use the org value |
| **Adaptive chart granularity** | `/dashboard/overview` picks day/week/month/year from range length and returns `range.interval`; all series zero-filled | Overview "Auto" interval option follows the server; manual override still re-queries |
| **Invite re-send / rotate** | `POST /team/{id}/resend` | Refresh icon on pending members copies a fresh link |
| **Audit-log filters** | `resource_type`, `start`, `end` params, stable ordering | — |
| **Persisted date range** | — | `sessionStorage`; relative presets re-derived from *today*, custom ranges kept, corrupt values ignored |
| **Ops hygiene** | request ids, security headers, health `database` check, 409/503 handlers, `TRUST_PROXY_HEADERS` | Vite `VITE_ALLOWED_HOSTS` for tunnelled previews |

API additions are backwards-compatible: existing response fields are unchanged; new fields (`permissions`, `workspaces`, `low_stock_threshold`, `range.interval`, `threshold`) were added.

---

## 5. Test results

| Suite | Command | Result |
| --- | --- | --- |
| Backend unit/integration | `cd backend && .venv/bin/python -m pytest` | **53 passed** (22 pre-existing + 31 new in `tests/test_regressions.py`) |
| Runtime QA journeys | `PYTHONPATH=. .venv/bin/python scripts/audit_runtime.py` | **37/37 checks passed** |
| Smoke test (seeded DB) | `.venv/bin/python scripts/smoke_test.py` | ✅ all steps |
| Frontend type-check | `npx tsc --noEmit` | clean |
| Frontend unit tests | `npx vitest run` | **36 passed** (24 pre-existing + 12 new) — now **48** after the theme refresh, see §9 |
| Production build | `npm run build` | ✅ (largest chunk 436 kB / 117 kB gzip — unchanged) |
| Live E2E (uvicorn + Vite proxy, seeded DB) | manual `curl` flows | login → `/auth/me` with workspaces → invite existing user to 2nd org → switch → analyst 403 on write → notification delivered → illegal order transition 409 → CSV export with headers → export audit entry ✓; legacy DB auto-migrated (`low_stock_threshold`, new indexes) |

New regression tests (backend): registration slug/orphan, invite email binding, blank-org invite, re-invite rotation, workspace switching ×2, discount bound, unique order numbers, stock restore, transition validation, merged lines, `customer_id` filter, SKU/email/category uniqueness, goal partial-update, report type/date validation, top-products sort, AOV≠LTV, last-owner demotion, health DB status, security headers, CSV exports ×2 (content + permission), LIKE escaping, low-stock threshold, adaptive interval, audit filters, goal order-progress.

New tests (frontend): invite-mode validation, 72-char password bound, Register page invite mode, `restoreRange` ×5, order-transition table ×4.

---

## 6. Files changed

**Backend (23 modified, 3 new)** — `app/main.py`, `config.py`, `api/deps.py`, `api/routes/{auth,orders,products,customers,goals,team,reports,settings,dashboard,audit,search}.py`, `auth/security.py`, `schemas/{auth,settings}.py`, `services/analytics.py`, `models/{catalog,commerce,organization}.py`, `database/db.py`, `utils/audit.py`; new `utils/csv_export.py`, `utils/query.py`, `tests/test_regressions.py`.

**Frontend (17 modified, 2 new)** — `App.tsx`, `types/index.ts`, `lib/validation.ts`, `services` (unchanged), `contexts/{AuthContext,DateRangeContext}.tsx`, `components/layout/DashboardLayout.tsx`, `pages/dashboard/{Overview,Analytics,Customers,Products,Orders,OrderDetail,Settings,Team}.tsx`, `pages/marketing/Register.tsx`, `vite.config.ts`, tests; new `contexts/__tests__/DateRangeContext.test.ts`, `pages/dashboard/__tests__/orderTransitions.test.ts`.

**Repo** — `README.md` (features, API table, configuration section, test counts), `.env.example` (`TRUST_PROXY_HEADERS`), `docker-compose.yml` (`TRUST_PROXY_HEADERS: "true"` for the api service).

No database reset is required: `init_db()` adds the new column and indexes to existing SQLite/Postgres databases at startup (unique indexes are skipped with a warning if legacy data violates them).

---

## 7. Remaining observations / recommendations (not changed)

These are judgement calls or larger pieces of work rather than defects; they are listed so the roadmap is honest.

1. **Product deletion cascades sales history.** Deleting a product removes its `SalesRecord`s and order lines, which changes historical KPIs. Recommended: soft-delete (`status = archived`) and block hard delete when orders reference the product.
2. **Email change is unverified.** `PUT /settings/email` switches the login email immediately; a verification link (needs an SMTP provider) would be safer.
3. **Report `filters` are stored but not applied** beyond the date range; region/channel filters in the report form are informational.
4. **Rate limiter is per-process.** With `--workers 2` each worker keeps its own counters; move to Redis for strict limits.
5. **No Content-Security-Policy** header yet — add one in nginx once the inline-style usage of the chart library is reviewed.
6. **Postgres port is published** in `docker-compose.yml` (`5432:5432`) for convenience; remove the mapping in production.
7. **Refresh tokens are stateless** (no denylist); logout is client-side. Redis-backed denylist is on the roadmap in the README.
8. **Integrations page is a catalogue only** (clearly labelled in the UI).

---

## 8. How to run everything

```bash
# Backend
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.services.seed          # demo data (demo@nexora.app / DemoPassword123!)
.venv/bin/uvicorn app.main:app --reload         # http://localhost:8000/api/docs
.venv/bin/python -m pytest                      # 53 tests
PYTHONPATH=. .venv/bin/python scripts/audit_runtime.py   # 37 runtime checks

# Frontend
cd frontend && npm install && npm run dev       # http://localhost:5173 (proxies /api → :8000)
npm run typecheck && npm run test && npm run build

# Docker
cp .env.example .env && docker compose up --build   # http://localhost:3000
```

---

## 9. Follow-up: accent themes & 3D depth design (dashboard visual refresh)

Requested after the audit: *"implement some theme colour and 3D design for an attractive dashboard"*. Everything is opt-out, persisted per device and degrades to the previous flat look.

### 9.1 What was added

| Area | Change |
| --- | --- |
| **Colour system** | `primary.*` in Tailwind now resolves to CSS variables (`rgb(var(--primary-600) / <alpha>)`), so every existing `bg-primary-600`, `text-primary-*`, `ring-primary-*` follows the active accent with no per-component edits. Six palettes (50–950 scales + a secondary `--accent-2` glow colour) are defined under `[data-accent="…"]` in `src/index.css`: **Indigo** (default, identical to the old blue), **Violet**, **Emerald**, **Rose**, **Sunset** (amber/orange), **Ocean**. |
| **Theme context** | `ThemeContext` gained `accent / setAccent / depth / setDepth` (+ `useThemeOptional`, `ACCENTS`, `ACCENT_META`, `isAccent`). Keys: `nexora-theme`, `nexora-accent`, `nexora-depth`. `index.html` applies `.dark`, `data-accent` and `data-depth` before first paint (no flash). While fixing this, a latent bug was found: in *system* mode the OS light↔dark switch never re-rendered because the listener set the same `"system"` state (React bails out). System dark-ness is now tracked as its own state and covered by a test. |
| **Appearance picker** | New `AppearancePicker` (topbar palette icon, `role="dialog"` popover): light/dark/auto tabs, accent swatches (`radiogroup`), 3D-depth switch. `AccentSwatches` + `DepthToggle` are reused on Settings → Appearance. |
| **3D depth mode** (`data-depth="on"`, default on) | Ambient radial background wash, layered `card-3d` elevation with glossy top edge and accent-tinted hover lift (`card-3d-hover`), gradient **hero KPI card** with light sweep, "coin" stat icons, gradient active nav item + sidebar shadow, glass topbar, gradient/glow primary buttons (`btn-3d`), glossy progress bars (`bar-3d`), 3D rank chips (`chip-3d`), and a **Welcome banner** on Overview with floating orbs and a perspective grid. |
| **Motion** | `useTilt` hook: pointer-tracking `rotateX/rotateY` tilt + radial highlight (`--mx/--my`) on stat cards; disabled when depth is off, when `prefers-reduced-motion` is set, or on coarse pointers. Staggered `rise-in` entrance for KPI cards (`index` prop). A global reduced-motion block neutralises all animations/transitions. |
| **Charts** | `useAccentColors()` reads the live palette from CSS variables; `CHART_COLORS.blue/violet` act as sentinels swapped for the accent by `useResolveColor()`, so existing chart call-sites recolour automatically. `useChartPalette()` gives an accent-led donut/legend palette. In depth mode, lines/areas/bars/donuts get SVG drop-shadow glow filters, gradient bar fills and rounded donut segments; tooltips use the glass style. |
| **StatCard** | Rewritten: `variant="hero"`, `sparkline` (inline SVG trend, exported `Sparkline`), `index` stagger, tilt + highlight. Overview passes 7-day revenue/orders/customer sparklines from the existing series data. |
| **Other UI** | `Card` gained `hover`; `Logo` uses a gradient wordmark; `Dropdown` accepts a `role`; tiles on Products / Customers / Sales / Analytics / Customer detail get the same elevation treatment. |

### 9.2 Files

New: `frontend/src/components/layout/AppearancePicker.tsx`, `frontend/src/components/dashboard/WelcomeBanner.tsx`, `frontend/src/hooks/useTilt.ts`, `frontend/src/contexts/__tests__/ThemeContext.test.tsx`.
Modified: `frontend/index.html`, `tailwind.config.ts`, `src/index.css`, `src/contexts/ThemeContext.tsx`, `src/charts/{index,ChartCard}.tsx`, `src/components/dashboard/StatCard.tsx`, `src/components/layout/{DashboardLayout,Logo}.tsx`, `src/components/ui/{Card,Button,base,Dropdown}.tsx`, `src/pages/dashboard/{Overview,Settings,Products,Customers,Sales,Analytics,CustomerDetail}.tsx`, `src/components/__tests__/ui.test.tsx`, `README.md`.

### 9.3 Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **48 passed** (36 previous + 12 new: accent/depth defaults, persistence, invalid-storage fallback, picker interaction, OS colour-scheme change ×2, StatCard hero/sparkline/stagger, sparkline gating, tilt on/off, `Sparkline` geometry ×2) |
| `npm run build` | ✅ — CSS 60.7 kB (11.2 kB gzip); all new utilities (`shadow-depth*`, `animate-rise-in/float`, `ease-spring`, arbitrary `[.card-3d:hover_&]` variants) emitted |
| Dev-server CSS | confirmed `.bg-primary-600 { background-color: rgb(var(--primary-600) / …) }` is what ships (a stale Tailwind config cache in the running Vite process had to be cleared with `--force`) |

Limitation: this sandbox has no browser binary (Chromium download is blocked), so the refresh was verified through the compiled CSS, unit tests and code review rather than screenshots — please eyeball the live preview in light + dark, and with depth off, once.

### 9.4 Notes for maintainers

- Adding a palette = one `[data-accent="name"]` block in `index.css` + an entry in `ACCENTS` / `ACCENT_META`.
- Anything that should lift in depth mode: add `card-3d card-3d-hover` (or use `<Card hover>`). Anything decorative should be `aria-hidden`.
- Depth mode is CSS-only apart from the tilt hook; turning it off (`nexora-depth=off`) restores the exact pre-refresh flat design.

---

## 10. Follow-up: login worked but the session did not stick behind the preview proxy

**Symptom (reported by the user):** the demo credentials were "not working" in the hosted preview. The API log told a different story: `POST /api/auth/login → 200`, then `GET /api/auth/me → 401`, `POST /api/auth/refresh → 200`, `GET /api/auth/me → 401` — so the password was accepted, but every *authenticated* request was rejected. The same flow via `curl` inside the sandbox returned 200.

**Root cause:** the hosted preview URL sits behind a proxy that strips the standard `Authorization` header before the request reaches the app. Requests that carry the token in the JSON body (login, refresh) succeed; anything that relies on `Authorization: Bearer …` fails, so the app bounces back to the login page and it *looks* like bad credentials.

**Fix (defence in depth, no behaviour change for normal deployments):**
- `frontend/src/services/api.ts` — `withAuth()` sends the access token as **both** `Authorization: Bearer <token>` and `X-Access-Token: <token>` (also for CSV downloads).
- `backend/app/api/deps.py` — `extract_access_token()` reads `Authorization` first and falls back to `X-Access-Token` (with or without a `Bearer ` prefix). Missing/invalid tokens still yield 401 with a `WWW-Authenticate: Bearer` challenge. CORS already allows all headers.
- Test: `test_access_token_accepted_via_fallback_header` (backend now **54 passed**).

Nothing else changes: the standard header still takes precedence, nginx/docker deployments forward both headers untouched.
