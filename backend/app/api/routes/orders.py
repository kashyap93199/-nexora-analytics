"""Order endpoints: list, detail, create, status update."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import pagination_params, require_permission
from app.auth.permissions import P_ORDERS_MANAGE, P_ORDERS_VIEW
from app.database.db import get_db
from app.models import Customer, Order, OrderItem, OrganizationMember, Product
from app.schemas.commerce import OrderCreate, OrderOut, OrderStatusUpdate
from app.schemas.common import Page
from app.utils.audit import write_audit

router = APIRouter(prefix="/orders", tags=["orders"])

TAX_RATE = 0.08  # demo default tax rate


def _to_out(order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    if order.customer:
        out.customer_name = order.customer.name
        out.customer_email = order.customer.email
    return out


@router.get("", response_model=Page[OrderOut])
def list_orders(
    search: str | None = Query(None, max_length=120),
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|processing|shipped|delivered|cancelled|refunded)$"),
    channel: str | None = Query(None, pattern="^(online|in_store|wholesale|partner)$"),
    region: str | None = Query(None, max_length=80),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    sort: str = Query("placed_at", pattern="^(placed_at|total|status)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    pagination: tuple[int, int] = Depends(pagination_params),
    member: OrganizationMember = Depends(require_permission(P_ORDERS_VIEW)),
    db: Session = Depends(get_db),
) -> Page[OrderOut]:
    page, page_size = pagination
    query = db.query(Order).filter(Order.organization_id == member.organization_id)
    if search:
        like = f"%{search}%"
        query = query.outerjoin(Customer, Customer.id == Order.customer_id).filter(
            or_(Order.order_number.ilike(like), Customer.name.ilike(like), Customer.email.ilike(like))
        )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    if channel:
        query = query.filter(Order.channel == channel)
    if region:
        query = query.filter(Order.region == region)
    if start:
        query = query.filter(Order.placed_at >= start)
    if end:
        query = query.filter(Order.placed_at <= end)

    total = query.count()
    sort_col = getattr(Order, sort)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return Page(
        items=[_to_out(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    member: OrganizationMember = Depends(require_permission(P_ORDERS_MANAGE)),
    db: Session = Depends(get_db),
) -> OrderOut:
    customer = None
    if payload.customer_id:
        customer = db.get(Customer, payload.customer_id)
        if customer is None or customer.organization_id != member.organization_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer not found in your organization")

    items: list[OrderItem] = []
    subtotal = 0.0
    for line in payload.items:
        product = db.get(Product, line.product_id)
        if product is None or product.organization_id != member.organization_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {line.product_id} not found")
        if product.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' is not active")
        if product.stock < line.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Not enough stock for '{product.name}'")
        line_total = round(float(product.price) * line.quantity, 2)
        subtotal += line_total
        items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=line.quantity,
                unit_price=float(product.price),
                total=line_total,
            )
        )

    tax = round((subtotal - float(payload.discount)) * TAX_RATE, 2)
    total = round(subtotal - float(payload.discount) + tax + float(payload.shipping), 2)

    order = Order(
        organization_id=member.organization_id,
        customer_id=customer.id if customer else None,
        order_number=f"ORD-{int(datetime.now(UTC).timestamp())}-{member.organization_id}",
        status=payload.status,
        channel=payload.channel,
        region=payload.region or (customer.region if customer else None),
        subtotal=subtotal,
        discount=float(payload.discount),
        tax=tax,
        shipping=float(payload.shipping),
        total=total,
        placed_at=datetime.now(UTC).replace(tzinfo=None),
    )
    order.items = items
    db.add(order)

    # Decrement stock and bump customer last-order time.
    for line in payload.items:
        product = db.get(Product, line.product_id)
        if product:
            product.stock -= line.quantity
    if customer:
        customer.last_order_at = datetime.now(UTC).replace(tzinfo=None)

    db.commit()
    db.refresh(order)
    write_audit(db, member.organization_id, member.user_id, "order.created", "order", order.id)
    return _to_out(order)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    member: OrganizationMember = Depends(require_permission(P_ORDERS_VIEW)),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.query(Order).filter(Order.id == order_id, Order.organization_id == member.organization_id).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _to_out(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    member: OrganizationMember = Depends(require_permission(P_ORDERS_MANAGE)),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.query(Order).filter(Order.id == order_id, Order.organization_id == member.organization_id).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    order.status = payload.status
    db.commit()
    db.refresh(order)
    write_audit(db, member.organization_id, member.user_id, "order.status_updated", "order", order.id)
    return _to_out(order)