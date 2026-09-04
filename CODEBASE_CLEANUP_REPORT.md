# NEXORA ANALYTICS — Codebase Cleanup Report

Scope: remove dead code, unused imports/dependencies and unnecessary files; tighten Docker hygiene; align docs with reality. No features were added, removed, or redesigned.

---

## Files Removed

| File | Why |
| --- | --- |
| *(root) `package-lock.json`* | Stray artifact from an early scaffolding `npm install` at the repo root — there is no root `package.json`. The real lockfile is `frontend/package-lock.json`. |
| `.no-scrollbar` CSS utility in `frontend/src/index.css` | Defined but referenced nowhere in the codebase (verified by full-tree grep). `.tabular` kept — it is used. |

No other files were removed: every component, page, hook, schema, route, model, script and config was traced to a live reference before keeping it.

## Files Added

| File | Why |
| --- | --- |
| `backend/.dockerignore` | Stop host `.venv/`, `__pycache__/`, `*.db`, `.env` from being shipped in the Docker build context. |
| `frontend/.dockerignore` | Stop host `node_modules/`, `dist/`, `.env` from being copied into the image by `COPY . .` (this previously overwrote the fresh `npm install` inside the build). |
| `CODEBASE_CLEANUP_REPORT.md` | This report. |

## Dependencies Removed

**None.** Both dependency trees were audited against actual imports:

- **npm (7 runtime)** — `react`, `react-dom`, `react-router-dom`, `recharts`, `lucide-react`, `date-fns`, `clsx` all imported by ≥1 source file. Dev deps are all build/test tooling in use.
- **Python (9 runtime)** — `fastapi`, `sqlalchemy`, `pydantic`, `pydantic-settings`, `PyJWT`, `bcrypt`, `email-validator` (used implicitly by `EmailStr`), `psycopg[binary]` (PostgreSQL driver used via the `DATABASE_URL`), `uvicorn` (the ASGI runtime). Dev deps `pytest`, `httpx`, `pytest-cov` used by the test suite.
- Upgraded earlier in this session (see audit report): `vite` 5→6, `vitest` 2→3, `react-router-dom` 6→7, `@vitejs/plugin-react` → 4.7 — resolving all 7 npm advisories (1 critical, 1 high) to **0 vulnerabilities**.

## Code Removed

- **18 unused Python imports** across 11 files (verified by `pyflakes`, each confirmed unused before removal):
  - `app/api/routes/{analytics,dashboard,goals,orders,products,reports,team,audit,customers}.py` — unused `get_membership` imports (routes use `require_permission`).
  - `app/api/routes/team.py` — unused `fastapi.Query`.
  - `app/api/routes/orders.py` — unused `MessageOut`.
  - `app/api/routes/auth.py` — unused `sqlalchemy.or_` and an unused local `role_has_permission` import.
  - `app/api/routes/settings.py` — unused `P_SETTINGS_MANAGE`.
  - `app/api/routes/customers.py` — unused `datetime` import.
  - `tests/test_rbac.py` — duplicate `TestClient` import.
  - `tests/conftest.py` — unused `Product`/`Category` imports.
- **`charts/index.tsx`** — dead `showLegend` prop on `LineAreaChart` (no caller passed it) and a constant-false ternary (`stacked && false ? 0 : …` → `[4, 4, 0, 0]`).
- **`auth.py` `me()` handler** — removed a redundant `role_obj = None` initialization and dead local import; simplified to a direct query.

## Warnings Fixed

- `datetime.utcnow()` deprecation in `tests/test_analytics.py` (the last remaining one in the codebase) → `datetime.now(UTC).replace(tzinfo=None)`.
- Backend warning count went from 1 → **0**; `pyflakes` is fully clean except the intentional `# noqa: F401` metadata import in `app/database/db.py` (required so SQLAlchemy registers all models with `Base.metadata`).

## Refactoring Performed

No gratuitous restructuring. Meaningful changes only:

- **Seed idempotency + data realism** (`services/seed.py`): the seeder now skips transactional data generation when the demo organization already has orders (previously every `docker compose up` on a persistent volume **doubled the dataset** — 9,026 → 17,902 orders). Orders are also now only ever assigned to customers who existed on the order day and never before the customer's `created_at` (0 violations; previously ~700+), which the new/returning customer analytics rely on.
- **`customer_series` rewrite** (`services/analytics.py`): new-customer buckets are now counted exactly once (previously double-counted across buckets because customers were classified "new" in every bucket they were active); buckets are processed in strict chronological order.
- **`product_performance`** now reports each product's real `category_id` (it was echoing the category *filter* parameter).
- **Report CSV export** (`routes/reports.py`) unions all row keys instead of deriving columns from the first row (revenue/performance exports crashed with a 500 `ValueError`).
- **Invite flow**: pending team invitations now store the invited email (`organization_members.invite_email` + tiny in-place migration in `init_db`), so the Team page no longer shows the placeholder `pending@invite`, and `RegisterIn.organization_name` is optional when an invite token is present (invite acceptance previously 422'd because the UI hides the org-name field).
- **Audit logs** route replaced per-row user lookups with a single batched query (kills N+1 on paginated pages).

## Remaining Warnings (intentional)

| Warning | Reason it stays |
| --- | --- |
| `db.py:52` "imported but unused" (`from app import models`) | Required side-effect import so `Base.metadata.create_all` sees every table. Marked `# noqa: F401`. |
| ESLint `react-hooks/exhaustive-deps` disables in `useCountUp` / `useApi` | Deliberate: `display` in deps would re-trigger the animation each frame; the `path` string in `useApi` is already an exact dependency. Both carry explanatory comments. |
| `pyproject.toml` `[tool.ruff]` block | Declarative config for contributors who install ruff; inert otherwise. |

## Verification

| Check | Result |
| --- | --- |
| Python lint (`pyflakes`) | PASS (0 findings beyond the documented `noqa`) |
| Backend pytest | PASS — 22/22 |
| Runtime QA script (`scripts/audit_runtime.py`) | PASS — 37/37 (journeys, invite flow, RBAC, tenancy ID-swap, exports) |
| TypeScript (`tsc --noEmit`) | PASS |
| Frontend Vitest | PASS — 24/24 |
| Production build (`npm run build`) | PASS |
| `npm audit` | PASS — 0 vulnerabilities |
| `pip check` | PASS — no broken requirements |

## Final Assessment

**Codebase cleanliness: 9/10** — no dead code, no unused imports, no unused dependencies, single source of truth for roles/permissions/colors, both dependency trees lean.

**Maintainability: 9/10** — routes are one module per resource with org-scoped queries and audit logging; pages share a small UI kit; analytics live in one service module. Remaining debt (documented in the audit report) is mostly INFO-level.

**Production readiness: 8.5/10** — all critical/high audit issues fixed and verified; remaining items are deployment-context choices (rate limiter memory profile, refresh-token denylist, SQLite-only local dev), all documented in `PROJECT_AUDIT_REPORT.md`.
