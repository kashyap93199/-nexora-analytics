"""Regression tests for bugs found in the project audit.

Each test documents the original defect so it can never silently return.
"""

from uuid import uuid4

from fastapi.testclient import TestClient

from tests.conftest import create_customer, create_product


def _register(client: TestClient, org_name: str, email: str | None = None) -> dict:
    email = email or f"user-{uuid4().hex[:8]}@corp.example"
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Regression User", "email": email, "password": "StrongPass123!", "organization_name": org_name},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth: dict) -> dict:
    return {"Authorization": f"Bearer {auth['access_token']}"}


# ---------------------------------------------------------------------------
# Registration / invitations
# ---------------------------------------------------------------------------

def test_two_orgs_with_the_same_name_can_both_register(client: TestClient):
    """BUG: identical org names produced identical slugs → 409 and an orphaned user."""
    name = f"Same Name {uuid4().hex[:6]}"
    first = _register(client, name)
    second = _register(client, name)
    assert first["organization"]["slug"] != second["organization"]["slug"]
    assert second["organization"]["name"] == name


def test_failed_registration_leaves_no_orphaned_user(client: TestClient):
    """BUG: a bad invite token committed the user before failing → email locked forever."""
    email = f"orphan-{uuid4().hex[:6]}@corp.example"
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Orphan Test", "email": email, "password": "StrongPass123!", "invite_token": "not-a-real-token"},
    )
    assert r.status_code == 404
    # The same email can still register normally afterwards.
    retry = client.post(
        "/api/auth/register",
        json={"full_name": "Orphan Test", "email": email, "password": "StrongPass123!", "organization_name": "Fresh Org"},
    )
    assert retry.status_code == 201, retry.text


def test_invite_can_only_be_claimed_by_the_invited_email(client: TestClient, auth_headers: dict):
    """BUG: anyone holding the invite link could join under any email address."""
    invited = f"invited-{uuid4().hex[:6]}@corp.example"
    token = client.post("/api/team/invite", headers=auth_headers, json={"email": invited, "role": "viewer"}).json()["invite_token"]

    hijack = client.post(
        "/api/auth/register",
        json={"full_name": "Some Body", "email": f"other-{uuid4().hex[:6]}@corp.example", "password": "StrongPass123!", "invite_token": token},
    )
    assert hijack.status_code == 403

    legit = client.post(
        "/api/auth/register",
        json={"full_name": "Invited Person", "email": invited.upper(), "password": "StrongPass123!", "invite_token": token},
    )
    assert legit.status_code == 201, legit.text
    assert legit.json()["role"] == "viewer"


def test_invite_registration_accepts_blank_org_name_from_ui(client: TestClient, auth_headers: dict):
    """BUG: the UI sends organization_name: "" with an invite → 422 (min_length=2)."""
    invited = f"blank-{uuid4().hex[:6]}@corp.example"
    token = client.post("/api/team/invite", headers=auth_headers, json={"email": invited, "role": "analyst"}).json()["invite_token"]
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Blank Org", "email": invited, "password": "StrongPass123!", "organization_name": "", "invite_token": token},
    )
    assert r.status_code == 201, r.text


def test_reinviting_pending_email_rotates_token_instead_of_duplicating(client: TestClient, auth_headers: dict):
    email = f"pending-{uuid4().hex[:6]}@corp.example"
    first = client.post("/api/team/invite", headers=auth_headers, json={"email": email, "role": "viewer"}).json()
    second = client.post("/api/team/invite", headers=auth_headers, json={"email": email, "role": "manager"}).json()
    assert first["member"]["id"] == second["member"]["id"]
    assert first["invite_token"] != second["invite_token"]
    assert second["member"]["role"] == "manager"
    pending = [m for m in client.get("/api/team", headers=auth_headers).json() if m["email"] == email]
    assert len(pending) == 1


# ---------------------------------------------------------------------------
# Multi-workspace membership (new feature + fix for unreachable memberships)
# ---------------------------------------------------------------------------

def test_existing_user_added_to_second_org_can_switch_workspaces(client: TestClient):
    """BUG: inviting an existing user created a membership they could never reach."""
    alice_email = f"alice-{uuid4().hex[:6]}@corp.example"
    alice = _register(client, "Alice Org", alice_email)
    bob = _register(client, "Bob Org")

    added = client.post("/api/team/invite", headers=_headers(bob), json={"email": alice_email, "role": "analyst"})
    assert added.status_code == 201, added.text
    assert added.json()["invite_token"] is None  # existing account: no link needed

    me = client.get("/api/auth/me", headers=_headers(alice)).json()
    assert me["organization"]["name"] == "Alice Org"
    assert {w["name"] for w in me["workspaces"]} == {"Alice Org", "Bob Org"}

    switched = client.post(
        "/api/auth/switch-organization",
        headers=_headers(alice),
        json={"organization_id": bob["organization"]["id"]},
    )
    assert switched.status_code == 200, switched.text
    assert switched.json()["organization"]["name"] == "Bob Org"
    assert switched.json()["role"] == "analyst"

    # New tokens are scoped to Bob Org, and refresh keeps that scope.
    me2 = client.get("/api/auth/me", headers=_headers(switched.json())).json()
    assert me2["organization"]["name"] == "Bob Org" and me2["role"] == "analyst"
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": switched.json()["refresh_token"]}).json()
    assert refreshed["organization"]["name"] == "Bob Org"

    # Cannot switch into an org you are not a member of.
    stranger = _register(client, "Stranger Org")
    denied = client.post("/api/auth/switch-organization", headers=_headers(alice), json={"organization_id": stranger["organization"]["id"]})
    assert denied.status_code == 404


def test_removed_member_token_falls_back_to_remaining_workspace(client: TestClient):
    alice_email = f"alice2-{uuid4().hex[:6]}@corp.example"
    alice = _register(client, "Alice Home", alice_email)
    bob = _register(client, "Bob Place")
    client.post("/api/team/invite", headers=_headers(bob), json={"email": alice_email, "role": "viewer"})
    switched = client.post("/api/auth/switch-organization", headers=_headers(alice), json={"organization_id": bob["organization"]["id"]}).json()

    member_id = next(m["id"] for m in client.get("/api/team", headers=_headers(bob)).json() if m["email"] == alice_email)
    assert client.delete(f"/api/team/{member_id}", headers=_headers(bob)).status_code == 200

    me = client.get("/api/auth/me", headers=_headers(switched)).json()
    assert me["organization"]["name"] == "Alice Home"


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

def test_discount_cannot_exceed_subtotal(client: TestClient, auth_headers: dict):
    """BUG: discount > subtotal produced negative tax and a negative order total."""
    product = create_product(client, auth_headers, "Discount Widget", price=10.0)
    r = client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}], "discount": 500})
    assert r.status_code == 400
    assert "Discount" in r.json()["detail"]


def test_order_numbers_are_unique_within_the_same_second(client: TestClient, auth_headers: dict):
    """BUG: order numbers were built from a second-resolution timestamp → duplicates."""
    product = create_product(client, auth_headers, "Bulk Widget", price=1.0, stock=100)
    numbers = set()
    for _ in range(5):
        r = client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}]})
        assert r.status_code == 201, r.text
        numbers.add(r.json()["order_number"])
    assert len(numbers) == 5


def test_cancelling_an_order_restores_stock(client: TestClient, auth_headers: dict):
    """BUG: stock was decremented on creation but never restored on cancel/refund."""
    product = create_product(client, auth_headers, "Stock Widget", price=5.0, stock=10)
    r = client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 3}]})
    assert r.status_code == 201, r.text
    assert client.get(f"/api/products/{product['id']}", headers=auth_headers).json()["stock"] == 7

    assert client.patch(f"/api/orders/{r.json()['id']}/status", headers=auth_headers, json={"status": "cancelled"}).status_code == 200
    assert client.get(f"/api/products/{product['id']}", headers=auth_headers).json()["stock"] == 10


def test_order_status_transitions_are_validated(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Flow Widget", price=5.0, stock=10)
    order_id = client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}]}).json()["id"]

    # pending → delivered is allowed; delivered → pending is not; delivered → refunded is.
    assert client.patch(f"/api/orders/{order_id}/status", headers=auth_headers, json={"status": "delivered"}).status_code == 200
    assert client.patch(f"/api/orders/{order_id}/status", headers=auth_headers, json={"status": "pending"}).status_code == 409
    assert client.patch(f"/api/orders/{order_id}/status", headers=auth_headers, json={"status": "refunded"}).status_code == 200
    # refunded is terminal.
    assert client.patch(f"/api/orders/{order_id}/status", headers=auth_headers, json={"status": "shipped"}).status_code == 409


def test_duplicate_lines_are_merged_for_stock_checks(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Merge Widget", price=5.0, stock=3)
    r = client.post(
        "/api/orders",
        headers=auth_headers,
        json={"items": [{"product_id": product["id"], "quantity": 2}, {"product_id": product["id"], "quantity": 2}]},
    )
    assert r.status_code == 400  # 4 requested, 3 available
    ok = client.post(
        "/api/orders",
        headers=auth_headers,
        json={"items": [{"product_id": product["id"], "quantity": 1}, {"product_id": product["id"], "quantity": 2}]},
    )
    assert ok.status_code == 201, ok.text
    assert len(ok.json()["items"]) == 1 and ok.json()["items"][0]["quantity"] == 3


def test_orders_can_be_filtered_by_customer(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Filter Widget", price=5.0, stock=10)
    customer = create_customer(client, auth_headers, "Filter Buyer")
    client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}], "customer_id": customer["id"]})
    client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}]})
    r = client.get(f"/api/orders?customer_id={customer['id']}", headers=auth_headers)
    assert r.json()["total"] == 1


# ---------------------------------------------------------------------------
# Catalog / customers uniqueness
# ---------------------------------------------------------------------------

def test_duplicate_sku_rejected_per_org(client: TestClient, auth_headers: dict, second_org_headers: dict):
    """BUG: the same SKU could be created any number of times."""
    r = client.post("/api/products", headers=auth_headers, json={"name": "One", "sku": "DUP-001", "price": 1, "cost": 0, "stock": 1})
    assert r.status_code == 201
    dup = client.post("/api/products", headers=auth_headers, json={"name": "Two", "sku": "dup-001", "price": 1, "cost": 0, "stock": 1})
    assert dup.status_code == 409
    # …but another organization may use the same SKU.
    other = client.post("/api/products", headers=second_org_headers, json={"name": "Three", "sku": "DUP-001", "price": 1, "cost": 0, "stock": 1})
    assert other.status_code == 201


def test_duplicate_customer_email_rejected_per_org(client: TestClient, auth_headers: dict):
    r = client.post("/api/customers", headers=auth_headers, json={"name": "First", "email": "same@corp.example"})
    assert r.status_code == 201
    dup = client.post("/api/customers", headers=auth_headers, json={"name": "Second", "email": "SAME@corp.example"})
    assert dup.status_code == 409


def test_duplicate_category_name_rejected(client: TestClient, auth_headers: dict):
    assert client.post("/api/categories", headers=auth_headers, json={"name": "Unique Cat"}).status_code == 201
    assert client.post("/api/categories", headers=auth_headers, json={"name": "unique cat"}).status_code == 409


# ---------------------------------------------------------------------------
# Goals / reports / analytics
# ---------------------------------------------------------------------------

def test_invalid_goal_update_does_not_persist_partial_changes(client: TestClient, auth_headers: dict):
    goal = client.post(
        "/api/goals",
        headers=auth_headers,
        json={"name": "Window", "type": "revenue", "target": 100, "starts_at": "2026-01-01T00:00:00", "ends_at": "2026-02-01T00:00:00"},
    ).json()
    bad = client.put(f"/api/goals/{goal['id']}", headers=auth_headers, json={"name": "Renamed", "ends_at": "2025-01-01T00:00:00"})
    assert bad.status_code == 400
    current = next(g for g in client.get("/api/goals", headers=auth_headers).json() if g["id"] == goal["id"])
    assert current["name"] == "Window"
    assert current["ends_at"].startswith("2026-02-01")


def test_report_type_filter_is_validated(client: TestClient, auth_headers: dict):
    assert client.get("/api/reports?type=bogus", headers=auth_headers).status_code == 422
    assert client.get("/api/reports?type=sales", headers=auth_headers).status_code == 200


def test_report_rejects_inverted_date_range(client: TestClient, auth_headers: dict):
    r = client.post("/api/reports", headers=auth_headers, json={"name": "Bad", "type": "sales", "start_date": "2026-03-01", "end_date": "2026-01-01"})
    assert r.status_code == 400


def test_top_products_are_sorted_by_revenue(client: TestClient, auth_headers: dict):
    """BUG: the dashboard 'Top products' panel returned the first 5 rows in insertion order."""
    cheap = create_product(client, auth_headers, "Cheap Thing", price=1.0, stock=100)
    pricey = create_product(client, auth_headers, "Pricey Thing", price=500.0, stock=100)
    client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": cheap["id"], "quantity": 1}], "status": "delivered"})
    client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": pricey["id"], "quantity": 1}], "status": "delivered"})

    top = client.get("/api/dashboard/overview", headers=auth_headers).json()["top_products"]
    assert top[0]["name"] == "Pricey Thing"
    assert top[0]["revenue"] >= top[-1]["revenue"]


def test_customer_avg_order_value_differs_from_ltv(client: TestClient, auth_headers: dict):
    """BUG: avg_order_value was computed with the same formula as avg_lifetime_value."""
    product = create_product(client, auth_headers, "AOV Widget", price=100.0, stock=100)
    create_customer(client, auth_headers, "Aov One")
    create_customer(client, auth_headers, "Aov Two")
    customer_id = client.get("/api/customers", headers=auth_headers).json()["items"][0]["id"]
    for _ in range(2):
        client.post("/api/orders", headers=auth_headers, json={"items": [{"product_id": product["id"], "quantity": 1}], "customer_id": customer_id, "status": "delivered"})

    metrics = client.get("/api/analytics/customers", headers=auth_headers).json()["metrics"]
    # AOV = 216 / 2 orders = 108 (100 + 8% tax); LTV = 216 / 2 customers = 108 → same here by coincidence,
    # so add a third customer to separate the two definitions.
    create_customer(client, auth_headers, "Aov Three")
    metrics = client.get("/api/analytics/customers", headers=auth_headers).json()["metrics"]
    assert abs(metrics["avg_order_value"] - 108.0) < 0.01
    assert abs(metrics["avg_lifetime_value"] - 216.0 / 3) < 0.01


# ---------------------------------------------------------------------------
# Team safety rails
# ---------------------------------------------------------------------------

def test_last_owner_cannot_be_demoted(client: TestClient, auth_headers: dict):
    me = client.get("/api/auth/me", headers=auth_headers).json()
    own_member = next(m for m in client.get("/api/team", headers=auth_headers).json() if m["user_id"] == me["user"]["id"])
    r = client.put(f"/api/team/{own_member['id']}/role", headers=auth_headers, json={"role": "admin"})
    assert r.status_code == 400


def test_health_reports_database_status(client: TestClient):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert "version" in body


def test_responses_carry_request_id_and_security_headers(client: TestClient):
    r = client.get("/api/health")
    assert r.headers.get("X-Request-ID")
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"


# ---------------------------------------------------------------------------
# Round 2: exports, search escaping, org settings, audit filters, dashboard# ---------------------------------------------------------------------------


def _product(client, headers, name, sku, **kw):
    """Create a product with an explicit SKU (conftest helper derives SKU from the name hash)."""
    payload = {"name": name, "sku": sku, "price": kw.get("price", 25.0), "cost": kw.get("cost", 10.0), "stock": kw.get("stock", 50), "category_id": kw.get("category_id")}
    r = client.post("/api/products", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_csv_exports_for_orders_customers_products(client: TestClient, auth_headers: dict):
    product = _product(client, auth_headers, "=SUM(1,2) Widget", "EXP-1", stock=10)
    customer = create_customer(client, auth_headers, "Export Buyer")
    r = client.post(
        "/api/orders",
        json={"customer_id": customer["id"], "items": [{"product_id": product["id"], "quantity": 2}], "channel": "online"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text

    for path, header in (
        ("/api/orders/export", "Order,Placed at,Status"),
        ("/api/customers/export", "Name,Email,Phone"),
        ("/api/products/export", "SKU,Product,Category"),
    ):
        resp = client.get(path, headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"].startswith("text/csv")
        assert "attachment; filename=" in resp.headers["content-disposition"]
        assert resp.text.startswith(header), resp.text[:80]

    # Formula-looking cells are neutralised (CSV injection).
    products_csv = client.get("/api/products/export", headers=auth_headers).text
    assert "'=SUM(1,2) Widget" in products_csv

    # Filters apply to exports too.
    filtered = client.get("/api/orders/export?status=cancelled", headers=auth_headers).text
    assert filtered.strip().count("\n") == 0  # header only

    # Exports are audited.
    logs = client.get("/api/audit-logs?action=exported", headers=auth_headers).json()
    assert {item["action"] for item in logs["items"]} >= {"orders.exported", "customers.exported", "products.exported"}


def test_export_requires_sales_export_permission(client: TestClient, auth_headers: dict):
    email = f"viewer-export-{uuid4().hex[:6]}@corp.example"
    r = client.post("/api/team/invite", json={"email": email, "role": "viewer"}, headers=auth_headers)
    assert r.status_code == 201, r.text
    auth = client.post(
        "/api/auth/register",
        json={"full_name": "View Only", "email": email, "password": "StrongPass123!", "invite_token": r.json()["invite_token"]},
    ).json()
    headers = _headers(auth)
    assert client.get("/api/orders/export", headers=headers).status_code == 403
    assert client.get("/api/customers/export", headers=headers).status_code == 403
    assert client.get("/api/products/export", headers=headers).status_code == 403
    assert client.get("/api/orders", headers=headers).status_code == 200


def test_search_escapes_like_wildcards(client: TestClient, auth_headers: dict):
    _product(client, auth_headers, "Plain Widget", "WC-1")
    _product(client, auth_headers, "100% Cotton", "WC-2")
    _product(client, auth_headers, "Under_score", "WC3")

    percent = client.get("/api/products?search=%25", headers=auth_headers).json()
    assert [p["name"] for p in percent["items"]] == ["100% Cotton"]

    underscore = client.get("/api/products?search=_", headers=auth_headers).json()
    assert {p["name"] for p in underscore["items"]} == {"Under_score"}

    global_search = client.get("/api/search?q=%25", headers=auth_headers).json()
    assert [p["name"] for p in global_search["products"]] == ["100% Cotton"]


def test_low_stock_threshold_is_configurable(client: TestClient, auth_headers: dict):
    _product(client, auth_headers, "Twenty", "LS-1", stock=20)
    _product(client, auth_headers, "Five", "LS-2", stock=5)

    overview = client.get("/api/dashboard/overview", headers=auth_headers).json()
    assert [p["name"] for p in overview["low_stock"]] == ["Five"]
    assert overview["low_stock"][0]["threshold"] == 15

    org = client.get("/api/settings/organization", headers=auth_headers).json()
    r = client.put(
        "/api/settings/organization",
        json={"name": org["name"], "currency": org["currency"], "low_stock_threshold": 25},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["low_stock_threshold"] == 25
    assert client.get("/api/auth/me", headers=auth_headers).json()["organization"]["low_stock_threshold"] == 25

    overview = client.get("/api/dashboard/overview", headers=auth_headers).json()
    assert {p["name"] for p in overview["low_stock"]} == {"Five", "Twenty"}

    bad = client.put("/api/settings/organization", json={"name": org["name"], "currency": "US", "low_stock_threshold": -1}, headers=auth_headers)
    assert bad.status_code == 422


def test_dashboard_interval_adapts_to_range(client: TestClient, auth_headers: dict):
    week = client.get("/api/dashboard/overview?start=2026-01-01&end=2026-01-07", headers=auth_headers).json()
    assert week["range"]["interval"] == "day"
    assert len(week["revenue_series"]["points"]) == 7
    year = client.get("/api/dashboard/overview?start=2025-01-01&end=2025-12-31", headers=auth_headers).json()
    assert year["range"]["interval"] == "month"
    assert len(year["revenue_series"]["points"]) == 12


def test_audit_log_supports_date_and_resource_filters(client: TestClient, auth_headers: dict):
    client.post("/api/categories", headers=auth_headers, json={"name": "Audit Cat", "description": "x"})
    logs = client.get("/api/audit-logs?resource_type=category", headers=auth_headers).json()
    assert logs["total"] >= 1
    assert all(item["resource_type"] == "category" for item in logs["items"])

    none = client.get("/api/audit-logs?start=2000-01-01&end=2000-01-02", headers=auth_headers).json()
    assert none["total"] == 0

    since_forever = client.get("/api/audit-logs?start=2000-01-01", headers=auth_headers).json()
    assert since_forever["total"] >= logs["total"]


def test_goal_order_progress_ignores_cancelled_orders(client: TestClient, auth_headers: dict):
    from datetime import date, timedelta

    product = _product(client, auth_headers, "Goal Widget", "GL-1", stock=50)
    customer = create_customer(client, auth_headers, "Goal Buyer")
    ids = []
    for _ in range(2):
        r = client.post("/api/orders", json={"customer_id": customer["id"], "items": [{"product_id": product["id"], "quantity": 1}]}, headers=auth_headers)
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    assert client.patch(f"/api/orders/{ids[0]}/status", json={"status": "cancelled"}, headers=auth_headers).status_code == 200

    today = date.today()
    r = client.post(
        "/api/goals",
        json={
            "name": "Ten orders",
            "type": "orders",
            "target": 10,
            "starts_at": (today - timedelta(days=1)).isoformat() + "T00:00:00",
            "ends_at": (today + timedelta(days=1)).isoformat() + "T23:59:59",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    goal = next(g for g in client.get("/api/goals", headers=auth_headers).json() if g["id"] == r.json()["id"])
    assert goal["progress"] == 1.0


# ---------------------------------------------------------------------------
# Auth header fallback (hosted preview proxies may strip ``Authorization``)
# ---------------------------------------------------------------------------


def test_access_token_accepted_via_fallback_header(client, auth_headers):
    token = auth_headers["Authorization"].split(" ", 1)[1]

    r = client.get("/api/auth/me", headers={"X-Access-Token": token})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"]

    # "Bearer " prefix is tolerated on the fallback header too.
    r = client.get("/api/auth/me", headers={"X-Access-Token": f"Bearer {token}"})
    assert r.status_code == 200, r.text

    # Standard header still wins and invalid fallback tokens are rejected.
    r = client.get("/api/auth/me", headers={"X-Access-Token": "not-a-token"})
    assert r.status_code == 401
    r = client.get("/api/auth/me")
    assert r.status_code == 401
