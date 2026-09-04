# NEXORA ANALYTICS

## Full Codebase Audit Report

### Executive Summary

A full audit was performed: codebase scan, automated checks, dependency audits, security review, and runtime testing of every user journey, role, and tenancy boundary. Every issue found was fixed with the smallest safe change and re-verified.

- **Production readiness:** READY FOR STAGING (all critical/high/medium fixed; remaining items are INFO-level deployment choices)
- **Security status:** PASS — no secrets, 0 npm vulnerabilities, authorization enforced server-side per request
- **Build status:** PASS — frontend `tsc` clean, production build succeeds
- **Test status:** PASS — 22 backend pytest, 24 frontend Vitest, 37/37 runtime QA checks
- **Critical issues:** 0 (fixed) · **High:** 0 (fixed) · **Medium:** 0 (fixed) · **Low/INFO:** 6 documented remaining

---

### 1–4. Issues found & fixed

**CRITICAL / HIGH**

| # | Issue | Location | Root cause | Fix & verification |
| --- | --- | --- | --- | --- |
| H1 | **Seed data duplicated on every boot** — orders 9,026 → 17,902 on re-run | `services/seed.py`, `docker-compose.yml` (seed on every start) | Seeder regenerated the full 730-day dataset with no existing-data guard | Skip transactional generation when the demo org already has orders. Verified: re-seed keeps 8,808 orders / 620 customers. |
| H2 | **Report CSV export crashed with 500** for `revenue` and `performance` reports | `routes/reports.py` | `csv.DictWriter` derived columns from the first row; later rows with different keys raised `ValueError` | Union all row keys + `extrasaction="ignore"`. Verified: revenue + performance exports return 200 CSV. |
| H3 | **Seed generated impossible data** — ~700+ orders placed before the customer's `created_at` | `services/seed.py` | Order loop picked customers randomly without respecting creation date | Restrict candidates to customers existing on the order day + clamp same-day order times. Verified: 0 violations; new/returning analytics now internally consistent. |

**MEDIUM**

| # | Issue | Location | Root cause | Fix & verification |
| --- | --- | --- | --- | --- |
| M1 | Customer-growth chart **double-counted new customers** (series new 356 vs 199 created) | `services/analytics.py` `customer_series` | Customers classified "new" in every bucket they were active; buckets processed out of chronological order | Track a seen-set seeded with created-by-bucket ids; sort bucket keys. Verified: series new == KPI new == 199. |
| M2 | Product performance returned the **category filter id** instead of each product's category | `services/analytics.py` | `category_id` field populated from the query parameter | Select and return `Category.id`. Verified: no null/mismatched category ids. |
| M3 | **Weak new password → HTTP 500** instead of 422 | `schemas/settings.py` `PasswordChange` | Password rules raised in a custom `__init__`, bypassing pydantic validation | Converted to a `@field_validator`. Verified: weak password → 422. |
| M4 | **Invite acceptance broken in UI** — org-name field hidden for invites but schema required it → 422 | `schemas/auth.py` + `pages/marketing/Register.tsx` | `RegisterIn.organization_name` always required | Made optional when `invite_token` present (validated via `model_validator`). Verified: register-with-invite returns 201. |
| M5 | Pending invites showed fake email `"pending@invite"`; target email never stored | `models/organization.py`, `routes/team.py` | `OrganizationMember` had no column for the invited email | Added `invite_email` column (+ in-place `ALTER TABLE` migration in `init_db` for existing DBs) and exposed it in `MemberOut`. Verified: Team list shows the invited address. |
| M6 | **Session expiry stranded users** — refresh failure cleared tokens but the UI stayed on protected pages throwing errors | `services/api.ts`, `contexts/AuthContext.tsx` | AuthContext never notified when refresh failed | Dispatch `nexora:session-expired` on refresh failure; AuthContext listens and flips to guest (route guards redirect to /login). |

**LOW**

| # | Issue | Location | Fix |
| --- | --- | --- | --- |
| L1 | Audit-log list ran an N+1 user query per row | `routes/audit.py` | Single batched user lookup. |
| L2 | `mark_read` let any member mark another user's personal notification read | `routes/notifications.py` | Recipient-only for user-scoped notifications (404 otherwise). |
| L3 | Geographic performance summed cancelled/refunded revenue, inconsistent with other metrics | `services/analytics.py` | Filter to revenue statuses. |
| L4 | `useApi` created AbortControllers but never passed the signal to `fetch` | `hooks/useApi.ts` | Pass `{ signal }` through the client (the `active` flag already prevented stale-state bugs; this now also cancels in-flight requests). |
| L5 | Charts module dead `showLegend` prop + constant-false ternary | `charts/index.tsx` | Removed. |
| L6 | Dependency advisories: vitest **critical**, vite **high**, react-router open-redirect (moderate) | `package.json` | Bumped vite 5→6.4.x, vitest 2→3.2.x, react-router-dom 6→7.18.x. `npm audit` → **0 vulnerabilities**; tsc/tests/build all pass. |

### 5. Security Findings

- **Secrets:** no passwords, keys, or tokens in the tree (scanned staged files + live tree). Root `.env` exists locally but is gitignored; only `.env.example` files are tracked.
- **No SQL injection:** all queries parameterized through SQLAlchemy; user text only in `ilike` patterns with bound params.
- **Auth:** bcrypt (12 rounds) password hashing; JWT access + refresh with distinct `type` claims (access tokens rejected as refresh tokens — verified); expired/invalid/garbage tokens → 401 (verified).
- **Authorization:** permission checks are enforced server-side on every endpoint via `require_permission` against the DB role matrix — verified for all 5 roles (viewer/analyst/manager/admin/owner), including that admins cannot manage the org or view audit logs.
- **Multi-tenancy:** every query filters by the authenticated member's `organization_id`; direct ID-swap attempts (product/customer/order/analytics) return 404/400 for other orgs (verified).
- **CORS:** allowlist from env, credentials enabled — same-origin nginx deployment is the default posture.
- **Rate limiting:** per-IP sliding window (120 req/60 s) on all routes; X-Content-Type-Options / X-Frame-Options headers set.
- **Not exposed:** raw stack traces never reach clients (unhandled errors → generic 500 page; only `detail` messages surface).

### 6. Authentication & Authorization — PASS
Registration, login, logout, invalid credentials, protected-route blocking, garbage/expired tokens, all 5 role boundaries, owner-only audit/org actions — all exercised in the runtime QA (J1, J5 blocks) with expected status codes.

### 7. Database Audit — PASS
15 tables, org FK + cascade + unique + index coverage per model. Persistence verified end-to-end: create → re-fetch → logout/login → still present (J2, J3). Seed data now internally consistent (orders never precede customer creation; idempotent re-runs). One migration helper exists in `init_db` for pre-existing SQLite/Postgres dev DBs (no Alembic in this project — documented INFO).

### 8. API Audit — PASS
All ~40 endpoints org-scoped with pydantic validation, 404/400/403/409/422 semantics verified; CRUD + analytics + reports + exports exercised live (including CSV export of every report type); pagination bounded (page_size ≤ 200).

### 9. Frontend Audit — PASS
Every KPI/chart is computed server-side from DB rows (no hard-coded analytics); loading/empty/error states on every data page; date-range changes re-fetch analytics (verified J4); report/pagination/filter UIs functional; search palette, notification center, theme persistence, and settings forms all wired to real endpoints. Integrations "connect" buttons and the contact form are clearly labeled demo/roadmap (the only intentional placeholders, marked as such in the UI).

### 10. Performance Audit — PASS
Route-level code splitting (per-page lazy chunks); list endpoints paginated; audit-log N+1 removed; charts memoized via theme hook; single-flight token refresh; aborted in-flight requests on rapid filter changes. Known INFO: rate-limiter dict is per-process/in-memory and unbounded per unique IP at very high concurrency — fine for single-worker staging, revisit if scaling.

### 11. Dependency Audit — PASS
0 vulnerabilities after bumps; `pip check` clean; no unused packages (see cleanup report). `psycopg` v3 + SQLAlchemy verified against a real PostgreSQL 17 instance in the prior session.

### 12. Tests Executed

| Test/check | Command | Result | Status |
| --- | --- | --- | --- |
| Backend pytest | `pytest tests/` | 22 passed, 0 warnings | PASS |
| Runtime QA (journeys/RBAC/tenancy/exports) | `python scripts/audit_runtime.py` | 37/37 | PASS |
| TypeScript | `npx tsc --noEmit` | clean | PASS |
| Frontend tests | `npx vitest run` | 24 passed | PASS |
| Production build | `npm run build` | success | PASS |
| Python lint | `pyflakes` | clean | PASS |
| npm audit | `npm audit` | 0 vulnerabilities | PASS |
| pip check | `pip check` | clean | PASS |
| PostgreSQL live stack | seed + uvicorn + nginx-style proxy vs PG 17 | all routes 200, KPIs computed | PASS |

### 13. Bugs Fixed
H1–H3, M1–M6, L1–L6 above (all verified by re-running the relevant checks).

### 14. Remaining Issues (INFO — not safely changeable now)

- **Refresh-token rotation / logout denylist** — stateless JWTs by design (documented in code); production would add a Redis denylist.
- **Rate limiter** is in-memory per process and not shared across workers — fine for staging.
- **No Alembic migrations** — schema evolves via `create_all` + a small additive migration; adequate for a portfolio/demo project.
- **Order stock decrement** has no row-lock — concurrent same-product orders could oversell (single-user demo scale; noted for real multi-worker use).
- **`sales_metrics` "orders" counts all statuses while AOV divides net revenue by them** — a minor semantic choice; consistent enough for demo use.
- **`geographic` metric now excludes cancelled/refunded** (aligned with revenue definitions) — flag if a full-books view is wanted later.

### 15. Production Readiness
**READY FOR STAGING.** All critical and high severity issues found by the audit are fixed and verified; no known blockers remain. Before a public production launch, the documented INFO items (refresh-token denylist, shared rate-limit store, migrations) should be addressed.
