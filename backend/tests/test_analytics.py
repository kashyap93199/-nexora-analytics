"""Analytics tests: metrics are computed from database records, not hard-coded.

We build a small controlled dataset through the API and assert exact numbers.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.models import SalesRecord

from tests.conftest import create_customer, create_product


def _seed_orders(client: TestClient, headers: dict, product_id: int, customer_id: int) -> None:
    """Three orders: 2 delivered, 1 cancelled. Delivered total = 50 + 50 = 100."""
    for _ in range(2):
        r = client.post("/api/orders", headers=headers, json={"items": [{"product_id": product_id, "quantity": 1}], "channel": "online", "status": "delivered"})
        assert r.status_code == 201, r.text
    r = client.post("/api/orders", headers=headers, json={"items": [{"product_id": product_id, "quantity": 1}], "channel": "online", "status": "cancelled"})
    assert r.status_code == 201, r.text


def _add_sales_record(db: Session, org_id: int, product_id: int, conversions: int, visitors: int) -> None:
    db.add(
        SalesRecord(
            organization_id=org_id,
            product_id=product_id,
            date=datetime.now(UTC).replace(tzinfo=None),
            region="Europe",
            channel="online",
            units_sold=conversions,
            gross_revenue=float(conversions * 25),
            refunds=0,
            visitors=visitors,
            conversions=conversions,
        )
    )
    db.commit()


def test_kpi_calculations_from_orders(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Calc Widget", price=25.0)
    create_customer(client, auth_headers, "Calc Buyer")
    customers = client.get("/api/customers", headers=auth_headers).json()
    customer_id = customers["items"][0]["id"]

    _seed_orders(client, auth_headers, product["id"], customer_id)

    with SessionLocal() as db:
        me = client.get("/api/auth/me", headers=auth_headers).json()
        _add_sales_record(db, me["organization"]["id"], product["id"], conversions=5, visitors=100)

    r = client.get("/api/dashboard/overview", headers=auth_headers)
    k = r.json()["kpis"]

    # Order totals: 2 delivered × $25 × 1.08 tax = $27 each → revenue $54.
    # (tax 8% on $25 → $27.00 per order)
    expected_revenue = round(25 * 1.08, 2) * 2
    assert abs(k["revenue"] - expected_revenue) < 0.01, k
    assert k["orders"] == 2  # cancelled order excluded from revenue count
    assert abs(k["aov"] - expected_revenue / 2) < 0.01, k

    # Conversion rate from sales records: 5/100 = 5%.
    assert abs(k["conversion_rate"] - 5.0) < 0.01, k


def test_customer_metrics(client: TestClient, auth_headers: dict):
    create_customer(client, auth_headers, "Cust One")
    create_customer(client, auth_headers, "Cust Two")

    r = client.get("/api/analytics/customers", headers=auth_headers)
    body = r.json()
    assert body["metrics"]["total_customers"] == 2
    assert body["metrics"]["new_customers"] == 2
    assert body["metrics"]["segments"]["new"] == 2
    assert body["metrics"]["avg_lifetime_value"] == 0.0  # no orders yet


def test_product_performance_margin(client: TestClient, auth_headers: dict):
    # Price 100, cost 40 → margin 60% on each unit sold.
    product = create_product(client, auth_headers, "Margin Widget", price=100.0, cost=40.0)
    create_customer(client, auth_headers, "Margin Buyer")
    customer_id = client.get("/api/customers", headers=auth_headers).json()["items"][0]["id"]
    _seed_orders(client, auth_headers, product["id"], customer_id)

    r = client.get("/api/analytics/products", headers=auth_headers)
    rows = r.json()["performance"]
    assert len(rows) == 1
    row = rows[0]
    assert row["units_sold"] == 2  # only delivered orders counted
    assert abs(row["revenue"] - 200.0) < 0.01
    assert abs(row["profit"] - (200.0 - 2 * 40.0)) < 0.01
    assert abs(row["margin"] - 60.0) < 0.01


def test_goals_progress_tracks_revenue(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Goal Widget", price=10.0)
    create_customer(client, auth_headers, "Goal Buyer")
    customer_id = client.get("/api/customers", headers=auth_headers).json()["items"][0]["id"]
    _seed_orders(client, auth_headers, product["id"], customer_id)

    from datetime import date, timedelta

    goal = client.post(
        "/api/goals",
        headers=auth_headers,
        json={
            "name": "Test Revenue Goal",
            "type": "revenue",
            "target": 21.6,  # exactly the two delivered orders (10 * 1.08 * 2)
            "starts_at": (date.today() - timedelta(days=7)).isoformat(),
            "ends_at": (date.today() + timedelta(days=7)).isoformat(),
        },
    )
    assert goal.status_code == 201, goal.text
    body = goal.json()
    assert abs(body["progress"] - 21.6) < 0.01
    assert abs(body["progress_pct"] - 100.0) < 0.01


def test_date_range_filters(client: TestClient, auth_headers: dict):
    product = create_product(client, auth_headers, "Range Widget", price=10.0)
    create_customer(client, auth_headers, "Range Buyer")
    customer_id = client.get("/api/customers", headers=auth_headers).json()["items"][0]["id"]
    _seed_orders(client, auth_headers, product["id"], customer_id)

    # Range in the past → zero revenue.
    r = client.get("/api/dashboard/overview?start=2020-01-01&end=2020-01-31", headers=auth_headers)
    assert r.json()["kpis"]["revenue"] == 0.0

    # Full range → revenue present.
    r = client.get("/api/dashboard/overview?start=2020-01-01&end=2030-12-31", headers=auth_headers)
    assert r.json()["kpis"]["revenue"] > 0