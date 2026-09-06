"""Global search across customers, orders, products and reports."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.database.db import get_db
from app.models import Customer, Order, OrganizationMember, Product, Report
from app.utils.query import icontains

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(5, ge=1, le=20),
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    org_id = member.organization_id

    customers = (
        db.query(Customer)
        .filter(
            Customer.organization_id == org_id,
            or_(icontains(Customer.name, q), icontains(Customer.email, q)),
        )
        .limit(limit)
        .all()
    )
    orders = (
        db.query(Order)
        .filter(Order.organization_id == org_id, icontains(Order.order_number, q))
        .limit(limit)
        .all()
    )
    products = (
        db.query(Product)
        .filter(
            Product.organization_id == org_id,
            or_(icontains(Product.name, q), icontains(Product.sku, q)),
        )
        .limit(limit)
        .all()
    )
    reports = (
        db.query(Report)
        .filter(Report.organization_id == org_id, icontains(Report.name, q))
        .limit(limit)
        .all()
    )

    return {
        "query": q,
        "customers": [{"id": c.id, "name": c.name, "email": c.email, "segment": c.segment} for c in customers],
        "orders": [
            {"id": o.id, "order_number": o.order_number, "status": o.status, "total": float(o.total)}
            for o in orders
        ],
        "products": [
            {"id": p.id, "name": p.name, "sku": p.sku, "stock": p.stock, "price": float(p.price)}
            for p in products
        ],
        "reports": [{"id": r.id, "name": r.name, "type": r.type} for r in reports],
    }