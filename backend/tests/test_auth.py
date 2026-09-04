"""Authentication tests: register, login, refresh, me, validation."""

from fastapi.testclient import TestClient


def test_register_creates_owner_org(client: TestClient):
    r = client.post(
        "/api/auth/register",
        json={
            "full_name": "Alice Wonder",
            "email": "alice@corp.example",
            "password": "SuperSecret1!",
            "organization_name": "Wonder Corp",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["role"] == "owner"
    assert body["user"]["email"] == "alice@corp.example"
    assert body["organization"]["name"] == "Wonder Corp"
    assert body["access_token"] and body["refresh_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["role"] == "owner"
    assert "dashboard:view" in me.json()["permissions"]
    assert "org:manage" in me.json()["permissions"]


def test_register_rejects_duplicate_email(client: TestClient):
    payload = {
        "full_name": "Dup User",
        "email": "dup@corp.example",
        "password": "SuperSecret1!",
        "organization_name": "Dup Org",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 409


def test_register_weak_password_rejected(client: TestClient):
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Weak", "email": "weak@corp.example", "password": "short", "organization_name": "Weak Org"},
    )
    assert r.status_code == 422


def test_login_success_and_wrong_password(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"full_name": "Login Test", "email": "login@corp.example", "password": "SuperSecret1!", "organization_name": "Login Org"},
    )
    ok = client.post("/api/auth/login", json={"email": "login@corp.example", "password": "SuperSecret1!"})
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = client.post("/api/auth/login", json={"email": "login@corp.example", "password": "wrong-password"})
    assert bad.status_code == 401


def test_refresh_rotates_tokens(client: TestClient):
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Refresh", "email": "refresh@corp.example", "password": "SuperSecret1!", "organization_name": "Refresh Org"},
    )
    refresh_token = r.json()["refresh_token"]
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]

    invalid = client.post("/api/auth/refresh", json={"refresh_token": "not-a-token"})
    assert invalid.status_code == 401


def test_protected_route_requires_token(client: TestClient):
    r = client.get("/api/dashboard/overview")
    assert r.status_code == 401


def test_invalid_token_rejected(client: TestClient):
    r = client.get("/api/dashboard/overview", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code == 401


def test_password_is_never_returned(client: TestClient, auth_headers: dict):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert "password" not in r.text
    assert "password_hash" not in r.text