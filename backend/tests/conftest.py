"""Pytest fixtures: isolated SQLite DB and TestClient."""

import os
import tempfile

# Configure the test database BEFORE importing the app.
_tmpdir = tempfile.mkdtemp(prefix="nexora_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest  # noqa: E402
from uuid import uuid4  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.database.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Product  # noqa: E402
from app.services.bootstrap import sync_roles_and_permissions  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        sync_roles_and_permissions(db)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client: TestClient) -> dict:
    """Register a fresh org+owner with a unique email and return auth headers."""
    return _register_owner(client, f"owner-{uuid4().hex[:8]}@corp.example")


@pytest.fixture()
def second_org_headers(client: TestClient) -> dict:
    return _register_owner(client, f"rival-{uuid4().hex[:8]}@corp.example")


def _register_owner(client: TestClient, email: str) -> dict:
    org_name = f"{email.split('@')[0]} Org"
    r = client.post(
        "/api/auth/register",
        json={
            "full_name": f"Owner {email.split('@')[0]}",
            "email": email,
            "password": "StrongPass123!",
            "organization_name": org_name,
        },
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def register_role(client: TestClient, email: str, org_name: str) -> dict:
    r = client.post(
        "/api/auth/register",
        json={
            "full_name": email.split("@")[0].title(),
            "email": email,
            "password": "StrongPass123!",
            "organization_name": org_name,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def create_category(client: TestClient, headers: dict, name: str = "Widgets") -> dict:
    r = client.post("/api/categories", headers=headers, json={"name": name, "description": "test"})
    assert r.status_code == 201, r.text
    return r.json()


def create_product(client: TestClient, headers: dict, name: str = "Test Widget", price: float = 25.0, cost: float = 10.0, stock: int = 50, category_id: int | None = None) -> dict:
    r = client.post(
        "/api/products",
        headers=headers,
        json={"name": name, "sku": f"SKU-{abs(hash(name)) % 100000}", "price": price, "cost": cost, "stock": stock, "category_id": category_id},
    )
    assert r.status_code == 201, r.text
    return r.json()


def create_customer(client: TestClient, headers: dict, name: str = "Jane Doe") -> dict:
    r = client.post(
        "/api/customers",
        headers=headers,
        json={"name": name, "email": f"{name.lower().replace(' ', '.')}@corp.example", "region": "Europe"},
    )
    assert r.status_code == 201, r.text
    return r.json()