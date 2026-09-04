"""Customer endpoints (organization-scoped)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_membership, pagination_params, require_permission
from app.auth.permissions import P_CUSTOMERS_MANAGE, P_CUSTOMERS_VIEW
from app.database.db import get_db
from app.models import Customer, Order, OrganizationMember
from app.schemas.commerce import CustomerCreate, CustomerOut, CustomerUpdate
from app.schemas.common import MessageOut, Page
from app.utils.audit import write_audit

router = APIRouter(prefix="/customers", tags=["customers"])


def _get_customer(db: Session, org_id: int, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.organization_id == org_id).first()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


def _enrich(customer: Customer, db: Session, org_id: int) -> CustomerOut:
    out = CustomerOut.model_validate(customer)
    total_spent, order_count = (
        db.query(func.coalesce(func.sum(Order.total), 0), func.count(Order.id))
        .filter(Order.customer_id == customer.id, Order.organization_id == org_id)
        .first()
    )
    out.total_spent = float(total_spent)
    out.order_count = int(order_count)
    return out


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
        like = f"%{search}%"
        query = query.filter(or_(Customer.name.ilike(like), Customer.email.ilike(like)))
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
        query = query.order_by(spend_subq.c.spent.desc() if order == "desc" else spend_subq.c.spent.asc())
    else:
        sort_col = getattr(Customer, sort)
        query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return Page(
        items=[_enrich(c, db, member.organization_id) for c in items],
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
    for key, value in payload.model_dump(exclude_unset=True).items():
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
    db.delete(customer)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "customer.deleted", "customer", customer_id)
    return MessageOut(message="Customer deleted")