"""RBAC tests: each role can/cannot perform the expected actions."""

from fastapi.testclient import TestClient

from uuid import uuid4

from fastapi.testclient import TestClient

from tests.conftest import create_product


def _add_member(client: TestClient, owner_headers: dict, email: str, role: str) -> dict:
    """Invite a new email into the owner's org and claim it via registration."""
    r = client.post("/api/team/invite", headers=owner_headers, json={"email": email, "role": role})
    assert r.status_code == 201, r.text
    invite_token = r.json()["invite_token"]
    assert invite_token, r.text
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": email.split("@")[0].title(),
            "email": email,
            "password": "StrongPass123!",
            "organization_name": "Unused",
            "invite_token": invite_token,
        },
    )
    assert reg.status_code == 201, reg.text
    assert reg.json()["role"] == role
    login = client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"})
    assert login.status_code == 200, login.text
    return login.json()


def test_viewer_is_read_only(client: TestClient, auth_headers: dict):
    login = _add_member(client, auth_headers, f"viewer-{uuid4().hex[:6]}@corp.example", "viewer")
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    # Can view.
    assert client.get("/api/products", headers=headers).status_code == 200
    assert client.get("/api/dashboard/overview", headers=headers).status_code == 200
    assert client.get("/api/reports", headers=headers).status_code == 200

    # Cannot write.
    assert client.post("/api/products", headers=headers, json={"name": "Nope", "sku": "N-1", "price": 1, "cost": 0, "stock": 1}).status_code == 403
    assert client.post("/api/customers", headers=headers, json={"name": "N", "email": "n@corp.example"}).status_code == 403
    assert client.post("/api/orders", headers=headers, json={"items": [{"product_id": 1, "quantity": 1}]}).status_code == 403
    assert client.post("/api/reports", headers=headers, json={"name": "R", "type": "sales", "start_date": "2026-01-01", "end_date": "2026-02-01"}).status_code == 403
    assert client.post("/api/goals", headers=headers, json={"name": "G", "type": "revenue", "target": 1000, "starts_at": "2026-01-01", "ends_at": "2026-02-01"}).status_code == 403
    assert client.post("/api/team/invite", headers=headers, json={"email": "x@corp.example", "role": "viewer"}).status_code == 403
    assert client.delete("/api/products/1", headers=headers).status_code == 403


def test_analyst_can_export_but_not_manage(client: TestClient, auth_headers: dict):
    login = _add_member(client, auth_headers, f"analyst-{uuid4().hex[:6]}@corp.example", "analyst")
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    # Can generate reports + export (sales:export, reports:create).
    r = client.post("/api/reports", headers=headers, json={"name": "Analyst Report", "type": "sales", "start_date": "2026-01-01", "end_date": "2026-02-01"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert client.get(f"/api/reports/{rid}/export", headers=headers).status_code == 200

    # Cannot manage products/customers/orders/goals.
    assert client.post("/api/products", headers=headers, json={"name": "Nope", "sku": "N-1", "price": 1, "cost": 0, "stock": 1}).status_code == 403
    assert client.post("/api/goals", headers=headers, json={"name": "G", "type": "revenue", "target": 1000, "starts_at": "2026-01-01", "ends_at": "2026-02-01"}).status_code == 403


def test_manager_can_manage_sales_data(client: TestClient, auth_headers: dict):
    login = _add_member(client, auth_headers, f"manager-{uuid4().hex[:6]}@corp.example", "manager")
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    product = create_product(client, auth_headers)
    r = client.post("/api/orders", headers=headers, json={"items": [{"product_id": product["id"], "quantity": 2}], "channel": "online"})
    assert r.status_code == 201, r.text
    assert client.patch(f"/api/orders/{r.json()['id']}/status", headers=headers, json={"status": "shipped"}).status_code == 200
    assert client.post("/api/goals", headers=headers, json={"name": "G", "type": "revenue", "target": 1000, "starts_at": "2026-01-01", "ends_at": "2026-02-01"}).status_code == 201

    # Cannot manage team or org settings.
    assert client.post("/api/team/invite", headers=headers, json={"email": "x@corp.example", "role": "viewer"}).status_code == 403
    assert client.put("/api/settings/organization", headers=headers, json={"name": "X", "currency": "EUR"}).status_code == 403


def test_only_owner_can_manage_organization(client: TestClient, auth_headers: dict):
    login = _add_member(client, auth_headers, f"admin-{uuid4().hex[:6]}@corp.example", "admin")
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    r = client.put("/api/settings/organization", headers=headers, json={"name": "Renamed", "currency": "EUR"})
    assert r.status_code == 403

    r = client.put("/api/settings/organization", headers=auth_headers, json={"name": "Renamed", "currency": "EUR"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_owner_can_view_audit_logs_admin_cannot(client: TestClient, auth_headers: dict):
    # Owner: allowed.
    assert client.get("/api/audit-logs", headers=auth_headers).status_code == 200

    login = _add_member(client, auth_headers, f"admin-{uuid4().hex[:6]}@corp.example", "admin")
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    # Admin lacks audit:view per the matrix.
    assert client.get("/api/audit-logs", headers=headers).status_code == 403