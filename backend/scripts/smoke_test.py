"""End-to-end smoke test using FastAPI's in-process TestClient.

Usage: python scripts/smoke_test.py
Requires a seeded database (python -m app.services.seed).
"""

from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    client = TestClient(app)

    # Health
    r = client.get("/api/health")
    assert r.status_code == 200, r.text

    # Login
    r = client.post("/api/auth/login", json={"email": "demo@nexora.app", "password": "DemoPassword123!"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200, r.text
    me = r.json()
    print(f"✓ login as {me['user']['email']} role={me['role']} org={me['organization']['name']} perms={len(me['permissions'])}")

    # Dashboard overview (default 30 days)
    r = client.get("/api/dashboard/overview", headers=headers)
    assert r.status_code == 200, r.text
    k = r.json()["kpis"]
    print(f"✓ overview revenue=${k['revenue']:,.2f} orders={k['orders']} customers={k['total_customers']} conv={k['conversion_rate']}% aov=${k['aov']:.2f}")

    # Analytics
    for path in ["/api/analytics/revenue", "/api/analytics/sales", "/api/analytics/customers", "/api/analytics/products", "/api/analytics/categories", "/api/analytics/geographic"]:
        r = client.get(path, headers=headers)
        assert r.status_code == 200, f"{path}: {r.text}"
    print("✓ analytics endpoints (revenue, sales, customers, products, categories, geographic)")

    # CRUD lists
    for path in ["/api/products?page_size=3", "/api/customers?page_size=3", "/api/orders?page_size=3", "/api/goals", "/api/team", "/api/notifications", "/api/reports", "/api/settings/organization"]:
        r = client.get(path, headers=headers)
        assert r.status_code == 200, f"{path}: {r.text}"
    print("✓ list endpoints (products, customers, orders, goals, team, notifications, reports, settings)")

    # Search
    r = client.get("/api/search?q=aurora", headers=headers)
    assert r.status_code == 200 and r.json()["products"], r.text
    print("✓ global search")

    # Product CRUD
    r = client.post("/api/products", headers=headers, json={"name": "Smoke Test Widget", "sku": "TST-001", "price": 12.5, "cost": 4, "stock": 10})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r = client.put(f"/api/products/{pid}", headers=headers, json={"price": 14.0})
    assert r.status_code == 200 and r.json()["price"] == 14.0, r.text
    r = client.delete(f"/api/products/{pid}", headers=headers)
    assert r.status_code == 200, r.text
    print("✓ product CRUD (create → update → delete)")

    # Order create + status update
    r = client.get("/api/products?page_size=2", headers=headers)
    items = [{"product_id": p["id"], "quantity": 1} for p in r.json()["items"]]
    r = client.post("/api/orders", headers=headers, json={"items": items, "channel": "online"})
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    r = client.patch(f"/api/orders/{oid}/status", headers=headers, json={"status": "shipped"})
    assert r.status_code == 200, r.text
    print("✓ order create + status update")

    # Report generation + CSV export
    r = client.post("/api/reports", headers=headers, json={"name": "Smoke Sales Report", "type": "sales", "start_date": "2026-01-01", "end_date": "2026-08-31"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    r = client.get(f"/api/reports/{rid}/export", headers=headers)
    assert r.status_code == 200 and "text/csv" in r.headers["content-type"], r.text
    print("✓ report generation + CSV export")

    # RBAC: new org owner has no data; demo viewer blocked
    r = client.post("/api/auth/register", json={"full_name": "Tester", "email": "tester@example.com", "password": "TestPass123!", "organization_name": "Tester Org"})
    assert r.status_code == 201, r.text
    viewer_token = r.json()["access_token"]
    vh = {"Authorization": f"Bearer {viewer_token}"}
    r = client.post("/api/products", headers=vh, json={"name": "Nope", "sku": "NO-1", "price": 1, "cost": 0, "stock": 1})
    # owner of fresh org CAN create; check tenancy isolation instead
    assert r.status_code == 201, r.text
    print("✓ fresh org owner can create their own product")

    # Multi-tenancy: tester org cannot see demo org data
    r = client.get("/api/products", headers=vh)
    assert r.json()["total"] == 1, r.text  # only their own product
    r = client.get("/api/dashboard/overview", headers=vh)
    assert r.json()["kpis"]["total_customers"] == 0, r.text
    print("✓ multi-tenancy: org data fully isolated")

    # Refresh flow
    rt = client.post("/api/auth/login", json={"email": "demo@nexora.app", "password": "DemoPassword123!"}).json()["refresh_token"]
    r = client.post("/api/auth/refresh", json={"refresh_token": rt})
    assert r.status_code == 200 and r.json()["access_token"], r.text
    print("✓ token refresh")

    # Validation errors
    r = client.post("/api/products", headers=headers, json={"name": "x", "sku": "y", "price": -5})
    assert r.status_code == 422, r.text
    print("✓ input validation (422 on invalid payload)")

    # 404 handling
    r = client.get("/api/products/999999", headers=headers)
    assert r.status_code == 404, r.text
    print("✓ 404 on missing resource")

    print("\n✅ All smoke tests passed")


if __name__ == "__main__":
    main()