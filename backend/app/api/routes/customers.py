"""Customer endpoints (organization-scoped)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import pagination_params, require_permission
from app.auth.permissions import P_CUSTOMERS_MANAGE, P_CUSTOMERS_VIEW, P_SALES_EXPORT
from app.database.db import get_db
from app.models import Customer, Order, OrganizationMember
from app.schemas.commerce import CustomerCreate, CustomerOut, CustomerUpdate
from app.schemas.common import MessageOut, Page
from app.utils.audit import write_audit
from app.utils.csv_export import csv_response
from app.utils.query import icontains

router = APIRouter(prefix="/customers", tags=["customers"])


def _get_customer(db: Session, org_id: int, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.organization_id == org_id).first()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


def _spend_stats(db: Session, org_id: int, customer_ids: list[int]) -> dict[int, tuple[float, int]]:
    """One grouped query for (total_spent, order_count) per customer (no N+1)."""
    if not customer_ids:
        return {}
    rows = (
        db.query(Order.customer_id, func.coalesce(func.sum(Order.total), 0), func.count(Order.id))
        .filter(Order.organization_id == org_id, Order.customer_id.in_(customer_ids))
        .group_by(Order.customer_id)
        .all()
    )
    return {cid: (float(spent), int(count)) for cid, spent, count in rows}


def _enrich(customer: Customer, db: Session, org_id: int, stats: dict[int, tuple[float, int]] | None = None) -> CustomerOut:
    out = CustomerOut.model_validate(customer)
    if stats is None:
        stats = _spend_stats(db, org_id, [customer.id])
    out.total_spent, out.order_count = stats.get(customer.id, (0.0, 0))
    return out


def _assert_email_available(db: Session, org_id: int, email: str, exclude_id: int | None = None) -> None:
    """Customer emails are unique within an organization (409 on duplicates)."""
    query = db.query(Customer.id).filter(Customer.organization_id == org_id, func.lower(Customer.email) == email.lower())
    if exclude_id is not None:
        query = query.filter(Customer.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"A customer with email '{email}' already exists")


@router.get("/export")
def export_customers(
    search: str | None = Query(None, max_length=120),
    segment: str | None = Query(None, pattern="^(new|returning|vip|inactive)$"),
    region: str | None = Query(None, max_length=80),
    member: OrganizationMember = Depends(require_permission(P_SALES_EXPORT)),
    db: Session = Depends(get_db),
):
    """Download the (filtered) customer list with lifetime spend as CSV."""
    query = db.query(Customer).filter(Customer.organization_id == member.organization_id)
    if search:
        query = query.filter(or_(icontains(Customer.name, search), icontains(Customer.email, search)))
    if segment:
        query = query.filter(Customer.segment == segment)
    if region:
        query = query.filter(Customer.region == region)
    customers = query.order_by(Customer.created_at.desc(), Customer.id.desc()).limit(10_000).all()
    stats = _spend_stats(db, member.organization_id, [c.id for c in customers])
    rows = [
        {
            "Name": c.name,
            "Email": c.email,
            "Phone": c.phone or "",
            "City": c.city or "",
            "Region": c.region or "",
            "Country": c.country or "",
            "Segment": c.segment,
            "Orders": stats.get(c.id, (0.0, 0))[1],
            "Total spent": stats.get(c.id, (0.0, 0))[0],
            "Customer since": c.created_at.date().isoformat(),
            "Last order": c.last_order_at.date().isoformat() if c.last_order_at else "",
        }
        for c in customers
    ]
    fieldnames = ["Name", "Email", "Phone", "City", "Region", "Country", "Segment", "Orders", "Total spent", "Customer since", "Last order"]
    write_audit(db, member.organization_id, member.user_id, "customers.exported", "customer", None, {"rows": len(rows)})
    return csv_response(rows, fieldnames, "customers")


@router.get("", response_model=Page[CustomerOut])
def list_customers(
    search: str | None = Query(None, max_length=120),
    segment: str | None = Query(None, pattern="^(new|returning|vip|inactive)$"),
    region: str | None = Query(None, max_length=80),
    sort: str = Query("created_at", pattern="^(name|created_at|total_spent|last_order_at)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    pagination: tuple[int, int] = Depends(pagination_params),
    member: OrganizationMember = Depends(require_permission(P_CUSTOMERS_VIEW)),
    db: Session = Depends(get_db),
) -> Page[CustomerOut]:
    page, page_size = pagination
    query = db.query(Customer).filter(Customer.organization_id == member.organization_id)
    if search:
        query = query.filter(or_(icontains(Customer.name, search), icontains(Customer.email, search)))
    if segment:
        query = query.filter(Customer.segment == segment)
    if region:
        query = query.filter(Customer.region == region)

    total = query.count()
    if sort == "total_spent":
        spend_subq = (
            db.query(Order.customer_id, func.sum(Order.total).label("spent"))
            .filter(Order.organization_id == member.organization_id)
            .group_by(Order.customer_id)
            .subquery()
        )
        query = query.outerjoin(spend_subq, spend_subq.c.customer_id == Customer.id)
        spent = func.coalesce(spend_subq.c.spent, 0)
        query = query.order_by(spent.desc() if order == "desc" else spent.asc(), Customer.id.asc())
    else:
        sort_col = getattr(Customer, sort)
        query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc(), Customer.id.asc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    stats = _spend_stats(db, member.organization_id, [c.id for c in items])
    return Page(
        items=[_enrich(c, db, member.organization_id, stats) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    member: OrganizationMember = Depends(require_permission(P_CUSTOMERS_MANAGE)),
    db: Session = Depends(get_db),
) -> CustomerOut:
    _assert_email_available(db, member.organization_id, payload.email)
    customer = Customer(organization_id=member.organization_id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    write_audit(db, member.organization_id, member.user_id, "customer.created", "customer", customer.id)
    return _enrich(customer, db, member.organization_id)


@router.get("/{customer_id}", response_model=dict)
def get_customer(
    customer_id: int,
    member: OrganizationMember = Depends(require_permission(P_CUSTOMERS_VIEW)),
    db: Session = Depends(get_db),
) -> dict:
    customer = _get_customer(db, member.organization_id, customer_id)
    orders = (
        db.query(Order)
        .filter(Order.customer_id == customer.id, Order.organization_id == member.organization_id)
        .order_by(Order.placed_at.desc())
        .all()
    )
    return {
        "customer": _enrich(customer, db, member.organization_id),
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "total": float(o.total),
                "placed_at": o.placed_at,
                "channel": o.channel,
                "items_count": sum(i.quantity for i in o.items),
            }
            for o in orders
        ],
    }


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    member: OrganizationMember = Depends(require_permission(P_CUSTOMERS_MANAGE)),
    db: Session = Depends(get_db),
) -> CustomerOut:
    customer = _get_customer(db, member.organization_id, customer_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("email"):
        _assert_email_available(db, member.organization_id, data["email"], exclude_id=customer.id)
    for key, value in data.items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    write_audit(db, member.organization_id, member.user_id, "customer.updated", "customer", customer.id)
    return _enrich(customer, db, member.organization_id)


@router.delete("/{customer_id}", response_model=MessageOut)
def delete_customer(
    customer_id: int,
    member: OrganizationMember = Depends(require_permission(P_CUSTOMERS_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    customer = _get_customer(db, member.organization_id, customer_id)
    name = customer.name
    db.delete(customer)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "customer.deleted", "customer", customer_id, {"name": name})
    return MessageOut(message="Customer deleted")