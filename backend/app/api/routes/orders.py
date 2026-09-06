"""Order endpoints: list, detail, create, status update."""

import secrets
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import pagination_params, require_permission
from app.auth.permissions import P_ORDERS_MANAGE, P_ORDERS_VIEW, P_SALES_EXPORT
from app.auth.security import utcnow
from app.database.db import get_db
from app.models import Customer, Order, OrderItem, OrganizationMember, Product
from app.schemas.commerce import OrderCreate, OrderOut, OrderStatusUpdate
from app.schemas.common import Page
from app.utils.audit import write_audit
from app.utils.csv_export import csv_response
from app.utils.query import icontains

router = APIRouter(prefix="/orders", tags=["orders"])

TAX_RATE = Decimal("0.08")  # demo default tax rate
CENTS = Decimal("0.01")

# Statuses that hold inventory. Moving an order *out* of this set releases the
# stock it reserved; moving it back *in* re-reserves it.
STOCK_HOLDING_STATUSES = frozenset({"pending", "processing", "shipped", "delivered"})

# Allowed status transitions (a small, explicit state machine).
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"processing", "shipped", "delivered", "cancelled"}),
    "processing": frozenset({"shipped", "delivered", "cancelled"}),
    "shipped": frozenset({"delivered", "cancelled", "refunded"}),
    "delivered": frozenset({"refunded"}),
    "cancelled": frozenset(),  # terminal
    "refunded": frozenset(),  # terminal
}


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(CENTS, rounding=ROUND_HALF_UP)


def _to_out(order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    if order.customer:
        out.customer_name = order.customer.name
        out.customer_email = order.customer.email
    return out


def _new_order_number(db: Session, org_id: int, when: datetime) -> str:
    """Human-readable, unique-per-organization order number.

    Format: ORD-YYYYMMDD-XXXXXX (random suffix; retried on the vanishingly rare
    collision). Unlike a second-resolution timestamp this stays unique when
    several orders are created within the same second.
    """
    for _ in range(10):
        candidate = f"ORD-{when.strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
        exists = (
            db.query(Order.id)
            .filter(Order.organization_id == org_id, Order.order_number == candidate)
            .first()
        )
        if exists is None:
            return candidate
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not allocate an order number")


def _filtered_orders(
    db: Session,
    org_id: int,
    search: str | None,
    status_filter: str | None,
    channel: str | None,
    region: str | None,
    customer_id: int | None,
    start: datetime | None,
    end: datetime | None,
):
    query = db.query(Order).filter(Order.organization_id == org_id)
    if search:
        query = query.outerjoin(Customer, Customer.id == Order.customer_id).filter(
            or_(icontains(Order.order_number, search), icontains(Customer.name, search), icontains(Customer.email, search))
        )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    if channel:
        query = query.filter(Order.channel == channel)
    if region:
        query = query.filter(Order.region == region)
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    if start:
        query = query.filter(Order.placed_at >= start)
    if end:
        query = query.filter(Order.placed_at <= end)
    return query


@router.get("/export")
def export_orders(
    search: str | None = Query(None, max_length=120),
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|processing|shipped|delivered|cancelled|refunded)$"),
    channel: str | None = Query(None, pattern="^(online|in_store|wholesale|partner)$"),
    region: str | None = Query(None, max_length=80),
    customer_id: int | None = Query(None, ge=1),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    member: OrganizationMember = Depends(require_permission(P_SALES_EXPORT)),
    db: Session = Depends(get_db),
):
    """Download the (filtered) order list as CSV — capped at 10,000 rows."""
    query = _filtered_orders(db, member.organization_id, search, status_filter, channel, region, customer_id, start, end)
    orders = query.order_by(Order.placed_at.desc(), Order.id.desc()).limit(10_000).all()
    rows = [
        {
            "Order": o.order_number,
            "Placed at": o.placed_at.isoformat(sep=" ", timespec="minutes"),
            "Status": o.status,
            "Channel": o.channel,
            "Region": o.region or "",
            "Customer": o.customer.name if o.customer else "",
            "Customer email": o.customer.email if o.customer else "",
            "Items": sum(i.quantity for i in o.items),
            "Subtotal": float(o.subtotal),
            "Discount": float(o.discount),
            "Tax": float(o.tax),
            "Shipping": float(o.shipping),
            "Total": float(o.total),
        }
        for o in orders
    ]
    fieldnames = ["Order", "Placed at", "Status", "Channel", "Region", "Customer", "Customer email", "Items", "Subtotal", "Discount", "Tax", "Shipping", "Total"]
    write_audit(db, member.organization_id, member.user_id, "orders.exported", "order", None, {"rows": len(rows)})
    return csv_response(rows, fieldnames, "orders")


@router.get("", response_model=Page[OrderOut])
def list_orders(
    search: str | None = Query(None, max_length=120),
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|processing|shipped|delivered|cancelled|refunded)$"),
    channel: str | None = Query(None, pattern="^(online|in_store|wholesale|partner)$"),
    region: str | None = Query(None, max_length=80),
    customer_id: int | None = Query(None, ge=1),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    sort: str = Query("placed_at", pattern="^(placed_at|total|status)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    pagination: tuple[int, int] = Depends(pagination_params),
    member: OrganizationMember = Depends(require_permission(P_ORDERS_VIEW)),
    db: Session = Depends(get_db),
) -> Page[OrderOut]:
    page, page_size = pagination
    query = _filtered_orders(db, member.organization_id, search, status_filter, channel, region, customer_id, start, end)

    total = query.count()
    sort_col = getattr(Order, sort)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc(), Order.id.desc())
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

    # Merge duplicate product lines so stock checks see the real total quantity.
    quantities: dict[int, int] = {}
    for line in payload.items:
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity

    items: list[OrderItem] = []
    products: dict[int, Product] = {}
    subtotal = Decimal("0")
    for product_id, quantity in quantities.items():
        product = db.get(Product, product_id)
        if product is None or product.organization_id != member.organization_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {product_id} not found")
        if product.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' is not active")
        if product.stock < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough stock for '{product.name}' ({product.stock} available, {quantity} requested)",
            )
        unit_price = _money(product.price)
        line_total = _money(unit_price * quantity)
        subtotal += line_total
        products[product_id] = product
        items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=unit_price,
                total=line_total,
            )
        )

    discount = _money(payload.discount)
    if discount > subtotal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discount ({discount}) cannot exceed the order subtotal ({subtotal})",
        )
    shipping = _money(payload.shipping)
    tax = _money((subtotal - discount) * TAX_RATE)
    total = _money(subtotal - discount + tax + shipping)

    now = utcnow()
    order = Order(
        organization_id=member.organization_id,
        customer_id=customer.id if customer else None,
        order_number=_new_order_number(db, member.organization_id, now),
        status=payload.status,
        channel=payload.channel,
        region=payload.region or (customer.region if customer else None),
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        shipping=shipping,
        total=total,
        placed_at=now,
    )
    order.items = items
    db.add(order)

    # Reserve stock only for statuses that hold inventory; a cancelled/refunded
    # order created directly should not deplete the shelf.
    if payload.status in STOCK_HOLDING_STATUSES:
        for product_id, quantity in quantities.items():
            products[product_id].stock -= quantity
    if customer:
        customer.last_order_at = now

    db.commit()
    db.refresh(order)
    write_audit(
        db, member.organization_id, member.user_id, "order.created", "order", order.id,
        {"order_number": order.order_number, "total": float(order.total), "status": order.status},
    )
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

    previous = order.status
    if payload.status == previous:
        return _to_out(order)
    if payload.status not in ALLOWED_TRANSITIONS[previous]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change an order from '{previous}' to '{payload.status}'",
        )

    # Release or re-reserve inventory when the order crosses the holding boundary.
    was_holding = previous in STOCK_HOLDING_STATUSES
    will_hold = payload.status in STOCK_HOLDING_STATUSES
    if was_holding != will_hold:
        for item in order.items:
            if item.product_id is None:
                continue
            product = db.get(Product, item.product_id)
            if product is None:
                continue
            product.stock += item.quantity if was_holding else -item.quantity

    order.status = payload.status
    db.commit()
    db.refresh(order)
    write_audit(
        db, member.organization_id, member.user_id, "order.status_updated", "order", order.id,
        {"from": previous, "to": payload.status},
    )
    return _to_out(order)
