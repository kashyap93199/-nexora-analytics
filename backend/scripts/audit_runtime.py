"""Comprehensive runtime audit for Nexora Analytics (in-process TestClient).

Covers user journeys, RBAC, tenancy ID-swap, analytics correctness repros.
Run: PYTHONPATH=. .venv/bin/python /tmp/audit_runtime.py
"""
import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db")
os.environ["RATE_LIMIT_ENABLED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database.db import SessionLocal, init_db  # noqa: E402
from app.services import seed as seed_mod  # noqa: E402

init_db()
with SessionLocal() as db:
    seed_mod.seed_demo(db)

client = TestClient(app)
results = []


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'}  {name}  {detail}")


def headers(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def login(email: str, password: str) -> tuple[str, dict]:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()


# ── Journey 1: register → login → me → logout ─────────────────────────────
r = client.post("/api/auth/register", json={
    "full_name": "Journey User", "email": "journey@example.com",
    "password": "Journey123!", "organization_name": "Journey Org"})
check("J1 register", r.status_code == 201, r.text[:80])
jt, jauth = r.json()["access_token"], r.json()
r = client.get("/api/auth/me", headers=headers(jt))
check("J1 me", r.status_code == 200 and r.json()["role"] == "owner")
r = client.post("/api/auth/logout", headers=headers(jt))
check("J1 logout endpoint", r.status_code == 200)
# invalid creds
r = client.post("/api/auth/login", json={"email": "journey@example.com", "password": "wrong"})
check("J1 invalid creds rejected", r.status_code == 401)
# unauthenticated protected route
r = client.get("/api/dashboard/overview")
check("J1 protected route blocks anon", r.status_code in (401, 403))
# garbage token
r = client.get("/api/dashboard/overview", headers=headers("not.a.jwt"))
check("J1 garbage token rejected", r.status_code == 401)

# ── Journey 2: create product → persist across "refresh" (new request) ────
r = client.post("/api/products", headers=headers(jt), json={
    "name": "Audit Widget", "sku": "AUD-001", "price": 42.0, "cost": 10.0, "stock": 5, "status": "active"})
check("J2 create product", r.status_code == 201, r.text[:80])
pid = r.json()["id"]
r = client.get("/api/products?search=AUD-001", headers=headers(jt))
check("J2 product persisted after re-fetch", r.status_code == 200 and any(p["id"] == pid for p in r.json()["items"]))
# logout/login and still there
client.post("/api/auth/logout", headers=headers(jt))
tok2, _ = login("journey@example.com", "Journey123!")
r = client.get(f"/api/products/{pid}", headers=headers(tok2))
check("J2 product persists across logout/login", r.status_code == 200)

# ── Journey 3: create customer → create order → analytics change ──────────
r = client.post("/api/customers", headers=headers(tok2), json={
    "name": "Order Test Customer", "email": "order.test@example.com", "city": "Oslo", "region": "Europe"})
check("J3 create customer", r.status_code == 201, r.text[:80])
cid = r.json()["id"]
from datetime import date, timedelta  # noqa: E402
_rng_start = (date.today() - timedelta(days=20)).isoformat()
_rng_end = date.today().isoformat()
before = client.get(f"/api/dashboard/overview?start={_rng_start}&end={_rng_end}", headers=headers(tok2)).json()["kpis"]
r = client.post("/api/orders", headers=headers(tok2), json={
    "customer_id": cid, "items": [{"product_id": pid, "quantity": 2}], "channel": "online"})
check("J3 create order", r.status_code == 201, r.text[:80])
after = client.get(f"/api/dashboard/overview?start={_rng_start}&end={_rng_end}", headers=headers(tok2)).json()["kpis"]
check("J3 analytics reflect new order", after["revenue"] > before["revenue"] and after["orders"] > before["orders"],
      f"rev {before['revenue']} -> {after['revenue']}")

# ── Journey 4: date range changes analytics ────────────────────────────────
r30 = client.get(f"/api/dashboard/overview?start={(date.today() - timedelta(days=29)).isoformat()}&end={_rng_end}", headers=headers(tok2)).json()["kpis"]
r90 = client.get(f"/api/dashboard/overview?start={(date.today() - timedelta(days=89)).isoformat()}&end={_rng_end}", headers=headers(tok2)).json()["kpis"]
check("J4 wider date range shows more revenue", r90["revenue"] >= r30["revenue"],
      f"30d={r30['revenue']} vs 90d={r90['revenue']}")

# ── Journey 5: RBAC across roles ───────────────────────────────────────────
def invite_and_register(owner_tok: str, email: str, role: str) -> str:
    r = client.post("/api/team/invite", headers=headers(owner_tok), json={"email": email, "role": role})
    assert r.status_code == 201, r.text
    token = r.json().get("invite_token")
    if token:
        r = client.post("/api/auth/register", json={
            "full_name": f"{role.title()} User", "email": email,
            "password": "Member123!", "invite_token": token})
        assert r.status_code == 201, f"{email}: {r.text[:150]}"
        return r.json()["access_token"]
    # Existing account (demo users): log in directly.
    r = client.post("/api/auth/login", json={"email": email, "password": "Member123!"})
    assert r.status_code == 200, f"{email}: {r.text[:150]}"
    return r.json()["access_token"]

# invite four users to the journey org and register them via their invite token
tokens = {}
for role, email in [("viewer", "v@example.com"), ("analyst", "a@example.com"), ("manager", "m@example.com"), ("admin", "ad@example.com")]:
    tokens[email] = invite_and_register(tok2, email, role)

me = client.get("/api/auth/me", headers=headers(tokens["v@example.com"])).json()
check("J5 viewer role assigned", me["role"] == "viewer", me["role"])

# viewer: can view, cannot manage
r = client.post("/api/products", headers=headers(tokens["v@example.com"]), json={"name": "nope", "sku": "N-1", "price": 1})
check("J5 viewer cannot create product", r.status_code == 403)
r = client.get("/api/orders?page_size=1", headers=headers(tokens["v@example.com"]))
check("J5 viewer can view orders", r.status_code == 200)
# analyst: can export sales, cannot manage products/orders
r = client.get("/api/analytics/sales", headers=headers(tokens["a@example.com"]))
check("J5 analyst views sales", r.status_code == 200)
r = client.post("/api/orders", headers=headers(tokens["a@example.com"]), json={"items": [{"product_id": pid, "quantity": 1}]})
check("J5 analyst cannot create order", r.status_code == 403)
# manager: can manage orders, cannot manage team roles
r = client.post("/api/orders", headers=headers(tokens["m@example.com"]), json={"items": [{"product_id": pid, "quantity": 1}]})
check("J5 manager can create order", r.status_code == 201)
r = client.put(f"/api/team/{next(m['id'] for m in client.get('/api/team', headers=headers(tokens['m@example.com'])).json() if m['email']=='v@example.com')}/role",
               headers=headers(tokens["m@example.com"]), json={"role": "admin"})
check("J5 manager cannot change roles", r.status_code == 403)
# admin: can manage most things but NOT org or audit
r = client.put("/api/settings/organization", headers=headers(tokens["ad@example.com"]), json={"name": "Journey Org", "currency": "USD"})
check("J5 admin cannot manage org", r.status_code == 403)
r = client.get("/api/audit-logs", headers=headers(tokens["ad@example.com"]))
check("J5 admin cannot view audit logs", r.status_code == 403)
r = client.get("/api/audit-logs", headers=headers(tok2))
check("J5 owner can view audit logs", r.status_code == 200)

# ── Multi-tenancy: ID swap attacks ─────────────────────────────────────────
# org B (fresh) cannot touch org A resources
rb = client.post("/api/auth/register", json={
    "full_name": "Org B", "email": "orgb@example.com", "password": "Orgb123!", "organization_name": "Org B Analytics"})
check("T register org B", rb.status_code == 201, rb.text[:80])
tb = rb.json()["access_token"]
for path in [f"/api/products/{pid}", f"/api/customers/{cid}"]:
    r = client.get(path, headers=headers(tb))
    check(f"T org B blocked from {path}", r.status_code == 404, str(r.status_code))
r = client.get("/api/orders", headers=headers(tb))
check("T org B sees zero orders", r.status_code == 200 and r.json()["total"] == 0)
r = client.get("/api/dashboard/overview", headers=headers(tb))
check("T org B dashboard isolated", r.json()["kpis"]["total_customers"] == 0)
# org B cannot create order referencing org A product
r = client.post("/api/orders", headers=headers(tb), json={"items": [{"product_id": pid, "quantity": 1}]})
check("T org B cannot order org A product", r.status_code == 400)

# ── Targeted bug repros on DEMO org (rich data) ────────────────────────────
d, _ = login("demo@nexora.app", "DemoPassword123!")
dh = headers(d)

# 1) Report CSV export (revenue type — mixed key rows)
r = client.post("/api/reports", headers=dh, json={
    "name": "Audit Revenue Report", "type": "revenue", "start_date": "2026-01-01", "end_date": "2026-08-31"})
check("R revenue report created", r.status_code == 201, r.text[:80])
rid = r.json()["id"]
r = client.get(f"/api/reports/{rid}/export", headers=dh)
check("R revenue report CSV export 200", r.status_code == 200, f"status={r.status_code} {r.text[:100]}")
r = client.post("/api/reports", headers=dh, json={
    "name": "Audit Perf Report", "type": "performance", "start_date": "2026-01-01", "end_date": "2026-08-31"})
rid2 = r.json()["id"]
r = client.get(f"/api/reports/{rid2}/export", headers=dh)
check("R performance report CSV export 200", r.status_code == 200, f"status={r.status_code} {r.text[:100]}")

# 2) Weak password change → should be 422, not 500
r = client.put("/api/settings/password", headers=headers(tb), json={
    "current_password": "Orgb123!", "new_password": "weak"})
check("R weak new password returns 422", r.status_code == 422, f"status={r.status_code} {r.text[:120]}")

# 3) product_performance category_id matches actual product category
r = client.get("/api/analytics/products?start=2026-01-01&end=2026-08-31", headers=dh)
perf = r.json()["performance"]
bad = [p for p in perf if p["category_id"] is None]
check("R product performance has category ids", len(bad) == 0, f"{len(bad)} with null category_id")

# 4) customer_series: new counts must not exceed customers created in range
r = client.get("/api/analytics/customers?start=2026-01-01&end=2026-08-31&interval=month", headers=dh)
series = r.json()["series"]["points"]
total_new = sum(p["new"] for p in series)
r = client.get("/api/dashboard/overview?start=2026-01-01&end=2026-08-31", headers=dh)
created = r.json()["kpis"]["new_customers"]
check("R customer series new <= customers created", total_new <= created, f"series_new={total_new} created={created}")

# 5) registration with duplicate email
r = client.post("/api/auth/register", json={
    "full_name": "Dup", "email": "journey@example.com", "password": "Dup12345!", "organization_name": "Dup"})
check("R duplicate email rejected 409", r.status_code == 409, str(r.status_code))

# 6) expired/invalid token type (access used as refresh)
rt = client.post("/api/auth/login", json={"email": "demo@nexora.app", "password": "DemoPassword123!"}).json()["refresh_token"]
r = client.post("/api/auth/refresh", json={"refresh_token": d})
check("R access token rejected as refresh", r.status_code == 401, str(r.status_code))

print("\n=== SUMMARY ===")
fails = [n for n, ok, _ in results if not ok]
print(f"{len(results) - len(fails)}/{len(results)} checks passed")
if fails:
    print("FAILED:", fails)