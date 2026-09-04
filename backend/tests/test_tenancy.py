"""Multi-tenancy isolation tests: organizations never see each other's data."""

from fastapi.testclient import TestClient

from tests.conftest import create_category, create_customer, create_product


def test_organizations_are_isolated(client: TestClient, auth_headers: dict, second_org_headers: dict):
    # Org A seeds data.
    cat = create_category(client, auth_headers, "Gadgets")
    create_product(client, auth_headers, "A-Product", price=99.0, category_id=cat["id"])
    create_customer(client, auth_headers, "Org A Buyer")

    # Org B sees nothing of A's.
    products_b = client.get("/api/products", headers=second_org_headers)
    assert products_b.status_code == 200
    assert products_b.json()["total"] == 0

    customers_b = client.get("/api/customers", headers=second_org_headers)
    assert customers_b.json()["total"] == 0

    overview_b = client.get("/api/dashboard/overview", headers=second_org_headers)
    assert overview_b.json()["kpis"]["total_customers"] == 0

    # Org A still sees its own data.
    products_a = client.get("/api/products", headers=auth_headers)
    assert products_a.json()["total"] == 1

    # Search is scoped too.
    assert client.get("/api/search?q=A-Product", headers=second_org_headers).json()["products"] == []
    assert len(client.get("/api/search?q=A-Product", headers=auth_headers).json()["products"]) == 1


def test_cross_org_resource_access_forbidden(client: TestClient, auth_headers: dict, second_org_headers: dict):
    product = create_product(client, auth_headers, "Secret Product")

    # Org B cannot fetch, update or delete Org A's product by id.
    assert client.get(f"/api/products/{product['id']}", headers=second_org_headers).status_code == 404
    assert client.put(f"/api/products/{product['id']}", headers=second_org_headers, json={"price": 1}).status_code == 404
    assert client.delete(f"/api/products/{product['id']}", headers=second_org_headers).status_code == 404

    customer = create_customer(client, auth_headers, "Secret Customer")
    assert client.get(f"/api/customers/{customer['id']}", headers=second_org_headers).status_code == 404


def test_order_cannot_reference_other_org_product(client: TestClient, auth_headers: dict, second_org_headers: dict):
    product = create_product(client, auth_headers, "Other Org Product")
    r = client.post(
        "/api/orders",
        headers=second_org_headers,
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert r.status_code == 400  # product not found in your organization


def test_team_isolated_per_org(client: TestClient, auth_headers: dict, second_org_headers: dict):
    team_a = client.get("/api/team", headers=auth_headers)
    team_b = client.get("/api/team", headers=second_org_headers)
    assert team_a.status_code == 200 and team_b.status_code == 200
    # Each org has exactly its own members.
    assert len(team_a.json()) == 1
    assert len(team_b.json()) == 1
    assert team_a.json()[0]["full_name"] != team_b.json()[0]["full_name"]