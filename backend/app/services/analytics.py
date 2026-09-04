"""Analytics computed from database records.

Every metric is derived from real rows (orders, customers, sales, revenue
records) within the requested date range. No hard-coded numbers.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Category,
    Customer,
    Goal,
    Order,
    OrderItem,
    Product,
    RevenueRecord,
    SalesRecord,
)

# Order statuses that count as realized revenue.
REVENUE_STATUSES = ("pending", "processing", "shipped", "delivered")
INTERVALS = ("day", "week", "month", "year")

DAY = timedelta(days=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _day(dt: datetime) -> datetime:
    return datetime.combine(dt.date(), time.min)


def _round(value: Decimal | float | int | None, digits: int = 2) -> float:
    if value is None:
        return 0.0
    return round(float(value), digits)


def period_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Inclusive [start, end] converted to naive-UTC datetimes."""
    return datetime.combine(start, time.min), datetime.combine(end, time.max)


def previous_period(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def bucket_key(dt: datetime, interval: str) -> str:
    d = dt.date()
    if interval == "day":
        return d.isoformat()
    if interval == "week":
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    if interval == "year":
        return str(d.year)
    return d.strftime("%Y-%m")


def bucket_label(dt: datetime, interval: str) -> str:
    d = dt.date()
    if interval == "day":
        return d.strftime("%b %d")
    if interval == "week":
        return "Wk " + d.strftime("%b %d")
    if interval == "year":
        return str(d.year)
    return d.strftime("%b %Y")


def _revenue_query(db: Session, org_id: int, start_dt: datetime, end_dt: datetime):
    return (
        db.query(Order)
        .filter(
            Order.organization_id == org_id,
            Order.status.in_(REVENUE_STATUSES),
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
        .with_entities(Order.placed_at, Order.total)
        .all()
    )


def _orders_query(db: Session, org_id: int, start_dt: datetime, end_dt: datetime):
    return (
        db.query(Order)
        .filter(
            Order.organization_id == org_id,
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
        .all()
    )


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

def kpis(db: Session, org_id: int, start: date, end: date) -> dict:
    start_dt, end_dt = period_bounds(start, end)
    prev_start, prev_end = previous_period(start, end)
    prev_start_dt, prev_end_dt = period_bounds(prev_start, prev_end)

    revenue_rows = _revenue_query(db, org_id, start_dt, end_dt)
    prev_revenue_rows = _revenue_query(db, org_id, prev_start_dt, prev_end_dt)

    revenue = _round(sum((r[1] for r in revenue_rows), Decimal("0")))
    prev_revenue = _round(sum((r[1] for r in prev_revenue_rows), Decimal("0")))

    orders = len(revenue_rows)
    prev_orders = len(prev_revenue_rows)

    new_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.organization_id == org_id, Customer.created_at >= start_dt, Customer.created_at <= end_dt)
        .scalar()
        or 0
    )
    prev_new_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.organization_id == org_id, Customer.created_at >= prev_start_dt, Customer.created_at <= prev_end_dt)
        .scalar()
        or 0
    )

    # Conversion rate from sales records (visitors / conversions).
    conv = (
        db.query(func.sum(SalesRecord.conversions), func.sum(SalesRecord.visitors))
        .filter(SalesRecord.organization_id == org_id, SalesRecord.date >= start_dt, SalesRecord.date <= end_dt)
        .first()
    )
    prev_conv = (
        db.query(func.sum(SalesRecord.conversions), func.sum(SalesRecord.visitors))
        .filter(SalesRecord.organization_id == org_id, SalesRecord.date >= prev_start_dt, SalesRecord.date <= prev_end_dt)
        .first()
    )
    conversions = int(conv[0] or 0)
    visitors = int(conv[1] or 0)
    prev_conversions = int(prev_conv[0] or 0)
    prev_visitors = int(prev_conv[1] or 0)
    conversion_rate = (conversions / visitors * 100) if visitors else 0.0
    prev_conversion_rate = (prev_conversions / prev_visitors * 100) if prev_visitors else 0.0

    aov = (revenue / orders) if orders else 0.0
    prev_aov = (prev_revenue / prev_orders) if prev_orders else 0.0

    profit = _round(
        sum((r[1] for r in revenue_rows), Decimal("0"))
        - _cost_of_orders(db, org_id, start_dt, end_dt)
    )

    def pct_change(current: float, previous: float) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)

    return {
        "revenue": revenue,
        "revenue_change": pct_change(revenue, prev_revenue),
        "orders": orders,
        "orders_change": pct_change(float(orders), float(prev_orders)),
        "new_customers": new_customers,
        "customers_change": pct_change(float(new_customers), float(prev_new_customers)),
        "total_customers": db.query(func.count(Customer.id)).filter(Customer.organization_id == org_id).scalar() or 0,
        "conversion_rate": _round(conversion_rate, 2),
        "conversion_change": _round(conversion_rate - prev_conversion_rate, 2),
        "aov": _round(aov),
        "aov_change": pct_change(aov, prev_aov),
        "profit": profit,
        "refunds": _round(
            db.query(func.sum(SalesRecord.refunds))
            .filter(SalesRecord.organization_id == org_id, SalesRecord.date >= start_dt, SalesRecord.date <= end_dt)
            .scalar()
            or 0
        ),
        "visitors": visitors,
        "conversions": conversions,
    }


def _cost_of_orders(db: Session, org_id: int, start_dt: datetime, end_dt: datetime) -> Decimal:
    """Cost of goods for revenue orders in range (unit cost x quantity)."""
    rows = (
        db.query(OrderItem.quantity, Product.cost)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .filter(
            Order.organization_id == org_id,
            Order.status.in_(REVENUE_STATUSES),
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
        .all()
    )
    return sum((Decimal(q) * (c or Decimal("0")) for q, c in rows), Decimal("0"))


# ---------------------------------------------------------------------------
# Series
# ---------------------------------------------------------------------------

def _bucketize(rows: list, interval: str, value_getter):
    """Group rows into ordered buckets by interval."""
    buckets: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        key = bucket_key(row[0], interval)
        if key not in buckets:
            buckets[key] = {"key": key, "label": bucket_label(row[0], interval), "value": 0.0, "count": 0}
            order.append(key)
        value_getter(buckets[key], row)
    return [buckets[k] for k in order]


def revenue_series(db: Session, org_id: int, start: date, end: date, interval: str = "month") -> dict:
    interval = interval if interval in INTERVALS else "month"
    start_dt, end_dt = period_bounds(start, end)
    rows = _revenue_query(db, org_id, start_dt, end_dt)

    series = _bucketize(
        rows, interval, lambda b, r: (b.__setitem__("value", _round(b["value"] + float(r[1]))), b.__setitem__("count", b["count"] + 1))
    )
    total = _round(sum((float(r[1]) for r in rows)))
    return {"interval": interval, "total": total, "points": series}


def sales_series(
    db: Session,
    org_id: int,
    start: date,
    end: date,
    interval: str = "month",
    region: str | None = None,
    channel: str | None = None,
    product_id: int | None = None,
    category_id: int | None = None,
) -> dict:
    interval = interval if interval in INTERVALS else "month"
    start_dt, end_dt = period_bounds(start, end)

    query = db.query(SalesRecord).filter(
        SalesRecord.organization_id == org_id,
        SalesRecord.date >= start_dt,
        SalesRecord.date <= end_dt,
    )
    if region:
        query = query.filter(SalesRecord.region == region)
    if channel:
        query = query.filter(SalesRecord.channel == channel)
    if product_id:
        query = query.filter(SalesRecord.product_id == product_id)
    if category_id:
        query = query.join(Product, Product.id == SalesRecord.product_id).filter(Product.category_id == category_id)

    rows = query.all()
    buckets: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        key = bucket_key(row.date, interval)
        if key not in buckets:
            buckets[key] = {"key": key, "label": bucket_label(row.date, interval), "gross": 0.0, "net": 0.0, "refunds": 0.0, "units": 0, "visitors": 0, "conversions": 0}
            order.append(key)
        b = buckets[key]
        b["gross"] = _round(b["gross"] + float(row.gross_revenue))
        b["refunds"] = _round(b["refunds"] + float(row.refunds))
        b["net"] = _round(b["gross"] - b["refunds"])
        b["units"] += row.units_sold
        b["visitors"] += row.visitors
        b["conversions"] += row.conversions

    return {
        "interval": interval,
        "points": [buckets[k] for k in order],
        "totals": {
            "gross": _round(sum(float(r.gross_revenue) for r in rows)),
            "net": _round(sum(float(r.gross_revenue) for r in rows) - sum(float(r.refunds) for r in rows)),
            "refunds": _round(sum(float(r.refunds) for r in rows)),
            "units": sum(r.units_sold for r in rows),
            "visitors": sum(r.visitors for r in rows),
            "conversions": sum(r.conversions for r in rows),
        },
    }


def customer_series(db: Session, org_id: int, start: date, end: date, interval: str = "month") -> dict:
    interval = interval if interval in INTERVALS else "month"
    start_dt, end_dt = period_bounds(start, end)

    # Customers created per bucket.
    created_rows = (
        db.query(Customer.created_at)
        .filter(Customer.organization_id == org_id, Customer.created_at >= start_dt, Customer.created_at <= end_dt)
        .all()
    )
    # Customers with an order per bucket (active in bucket).
    active_rows = (
        db.query(Order.placed_at, Order.customer_id)
        .filter(Order.organization_id == org_id, Order.placed_at >= start_dt, Order.placed_at <= end_dt, Order.customer_id.isnot(None))
        .all()
    )
    customers_before = set(
        cid
        for (cid,) in db.query(Customer.id).filter(Customer.organization_id == org_id, Customer.created_at < start_dt).all()
    )

    buckets: dict[str, dict] = {}
    order: list[str] = []
    active_in_bucket: dict[str, set] = {}

    for (created_at,) in created_rows:
        key = bucket_key(created_at, interval)
        if key not in buckets:
            buckets[key] = {"key": key, "label": bucket_label(created_at, interval), "new": 0, "returning": 0, "total": 0}
            order.append(key)
            active_in_bucket[key] = set()
        buckets[key]["new"] += 1

    # Assign each active customer to their bucket, split new vs returning.
    seen_new: set = set()
    for placed_at, customer_id in active_rows:
        key = bucket_key(placed_at, interval)
        if key not in buckets:
            buckets[key] = {"key": key, "label": bucket_label(placed_at, interval), "new": 0, "returning": 0, "total": 0}
            order.append(key)
            active_in_bucket[key] = set()
        active_in_bucket[key].add(customer_id)

    cumulative = 0
    for key in order:
        b = buckets[key]
        b_new = 0
        b_returning = 0
        for cid in active_in_bucket.get(key, set()):
            if cid in seen_new or cid in customers_before:
                b_returning += 1
            else:
                b_new += 1
                seen_new.add(cid)
        b["new"] += b_new
        b["returning"] = b_returning
        cumulative += b["new"]
        b["total"] = cumulative

    return {"interval": interval, "points": [buckets[k] for k in order]}


def revenue_by_category(db: Session, org_id: int, start: date, end: date) -> list[dict]:
    start_dt, end_dt = period_bounds(start, end)
    rows = (
        db.query(Category.name, func.sum(OrderItem.total))
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .join(Category, Category.id == Product.category_id)
        .filter(
            Order.organization_id == org_id,
            Order.status.in_(REVENUE_STATUSES),
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
        .group_by(Category.name)
        .order_by(func.sum(OrderItem.total).desc())
        .all()
    )
    return [{"name": name, "value": _round(total)} for name, total in rows]


def revenue_by_source(db: Session, org_id: int, start: date, end: date) -> list[dict]:
    start_dt, end_dt = period_bounds(start, end)
    rows = (
        db.query(RevenueRecord.source, func.sum(RevenueRecord.amount))
        .filter(RevenueRecord.organization_id == org_id, RevenueRecord.date >= start_dt, RevenueRecord.date <= end_dt)
        .group_by(RevenueRecord.source)
        .order_by(func.sum(RevenueRecord.amount).desc())
        .all()
    )
    return [{"name": name, "value": _round(total)} for name, total in rows]


def geographic_performance(db: Session, org_id: int, start: date, end: date) -> list[dict]:
    start_dt, end_dt = period_bounds(start, end)
    rows = (
        db.query(Order.region, func.count(Order.id), func.sum(Order.total))
        .filter(
            Order.organization_id == org_id,
            Order.region.isnot(None),
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
        .group_by(Order.region)
        .order_by(func.sum(Order.total).desc())
        .all()
    )
    return [{"region": r, "orders": c, "revenue": _round(t)} for r, c, t in rows]


def product_performance(
    db: Session, org_id: int, start: date, end: date, category_id: int | None = None
) -> list[dict]:
    start_dt, end_dt = period_bounds(start, end)
    prev_start, prev_end = previous_period(start, end)
    prev_start_dt, prev_end_dt = period_bounds(prev_start, prev_end)

    query = (
        db.query(
            Product.id,
            Product.name,
            Product.stock,
            Product.status,
            Product.price,
            Product.cost,
            Category.name,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.total),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(
            Order.organization_id == org_id,
            Order.status.in_(REVENUE_STATUSES),
            Order.placed_at >= start_dt,
            Order.placed_at <= end_dt,
        )
    )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    rows = query.group_by(Product.id, Product.name, Product.stock, Product.status, Product.price, Product.cost, Category.name).all()

    # Previous-period units for trend.
    prev_rows = (
        db.query(OrderItem.product_id, func.sum(OrderItem.quantity))
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.organization_id == org_id,
            Order.status.in_(REVENUE_STATUSES),
            Order.placed_at >= prev_start_dt,
            Order.placed_at <= prev_end_dt,
        )
        .group_by(OrderItem.product_id)
        .all()
    )
    prev_units = {pid: int(q) for pid, q in prev_rows}

    result = []
    for pid, name, stock, status, price, cost, cat_name, units, revenue in rows:
        units = int(units or 0)
        cat_name = cat_name or "Uncategorized"
        revenue = _round(revenue)
        cost_total = _round(Decimal(units) * (cost or Decimal("0")))
        profit = _round(revenue - cost_total)
        margin = (profit / revenue * 100) if revenue else 0.0
        prev = prev_units.get(pid, 0)
        trend = round((units - prev) / prev * 100, 1) if prev else (100.0 if units > 0 else 0.0)
        result.append(
            {
                "id": pid,
                "name": name,
                "category": cat_name,
                "category_id": category_id,
                "units_sold": units,
                "revenue": revenue,
                "profit": profit,
                "margin": _round(margin, 1),
                "trend": trend,
                "stock": stock,
                "status": status,
                "price": _round(price),
            }
        )
    return result


def sales_metrics(
    db: Session,
    org_id: int,
    start: date,
    end: date,
    region: str | None = None,
    channel: str | None = None,
    product_id: int | None = None,
    category_id: int | None = None,
) -> dict:
    series = sales_series(db, org_id, start, end, "day", region, channel, product_id, category_id)
    t = series["totals"]
    orders = db.query(func.count(Order.id)).filter(
        Order.organization_id == org_id,
        Order.placed_at >= period_bounds(start, end)[0],
        Order.placed_at <= period_bounds(start, end)[1],
    )
    if region:
        orders = orders.filter(Order.region == region)
    if channel:
        orders = orders.filter(Order.channel == channel)
    if product_id:
        orders = orders.join(OrderItem, OrderItem.order_id == Order.id).filter(OrderItem.product_id == product_id)
    order_count = orders.scalar() or 0

    conversion_rate = (t["conversions"] / t["visitors"] * 100) if t["visitors"] else 0.0
    return {
        "gross_revenue": t["gross"],
        "net_revenue": t["net"],
        "refunds": t["refunds"],
        "units_sold": t["units"],
        "orders": order_count,
        "aov": _round(t["net"] / order_count) if order_count else 0.0,
        "conversion_rate": _round(conversion_rate, 2),
        "visitors": t["visitors"],
        "conversions": t["conversions"],
    }


def customer_analytics(db: Session, org_id: int, start: date, end: date) -> dict:
    start_dt, end_dt = period_bounds(start, end)
    prev_start, prev_end = previous_period(start, end)
    prev_start_dt, prev_end_dt = period_bounds(prev_start, prev_end)

    total = db.query(func.count(Customer.id)).filter(Customer.organization_id == org_id).scalar() or 0
    new = db.query(func.count(Customer.id)).filter(
        Customer.organization_id == org_id, Customer.created_at >= start_dt, Customer.created_at <= end_dt
    ).scalar() or 0

    active_before = set(
        cid
        for (cid,) in db.query(Customer.id)
        .filter(Customer.organization_id == org_id, Customer.created_at < start_dt)
        .all()
    )
    active_in_period = set(
        cid
        for (cid,) in db.query(Order.customer_id)
        .filter(Order.organization_id == org_id, Order.placed_at >= start_dt, Order.placed_at <= end_dt, Order.customer_id.isnot(None))
        .distinct()
        .all()
    )
    returning = len(active_in_period & active_before)
    retained = len([cid for cid in active_before if cid in active_in_period])
    retention = (retained / len(active_before) * 100) if active_before else 0.0

    # Lifetime value: average total spend across all customers with orders.
    spend_rows = (
        db.query(Customer.id, func.coalesce(func.sum(Order.total), 0))
        .outerjoin(Order, (Order.customer_id == Customer.id) & (Order.organization_id == org_id))
        .filter(Customer.organization_id == org_id)
        .group_by(Customer.id)
        .all()
    )
    ltv = sum(v for _, v in spend_rows) / len(spend_rows) if spend_rows else 0.0

    order_freq_rows = (
        db.query(Order.customer_id, func.count(Order.id))
        .filter(Order.organization_id == org_id, Order.placed_at >= start_dt, Order.placed_at <= end_dt, Order.customer_id.isnot(None))
        .group_by(Order.customer_id)
        .all()
    )
    avg_order_frequency = (
        sum(c for _, c in order_freq_rows) / len(order_freq_rows) if order_freq_rows else 0.0
    )

    # Segments.
    segments = {
        seg: db.query(func.count(Customer.id))
        .filter(Customer.organization_id == org_id, Customer.segment == seg)
        .scalar()
        or 0
        for seg in ("new", "returning", "vip", "inactive")
    }

    prev_new = db.query(func.count(Customer.id)).filter(
        Customer.organization_id == org_id, Customer.created_at >= prev_start_dt, Customer.created_at <= prev_end_dt
    ).scalar() or 0

    def pct_change(cur: float, prev: float) -> float:
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return round((cur - prev) / prev * 100, 1)

    return {
        "total_customers": total,
        "new_customers": new,
        "new_customers_change": pct_change(float(new), float(prev_new)),
        "returning_customers": returning,
        "retention_rate": _round(retention, 1),
        "avg_lifetime_value": _round(ltv),
        "avg_order_frequency": _round(avg_order_frequency, 2),
        "segments": segments,
        "avg_order_value": _round(sum(v for _, v in spend_rows) / (total or 1)),
    }


def best_selling_products(db: Session, org_id: int, start: date, end: date, limit: int = 5) -> list[dict]:
    return product_performance(db, org_id, start, end)[:limit]


def top_products(db: Session, org_id: int, start: date, end: date, limit: int = 5) -> list[dict]:
    return product_performance(db, org_id, start, end)[:limit]


def low_stock_products(db: Session, org_id: int, limit: int = 10) -> list[dict]:
    rows = (
        db.query(Product)
        .filter(Product.organization_id == org_id, Product.status == "active", Product.stock <= 15)
        .order_by(Product.stock.asc())
        .limit(limit)
        .all()
    )
    return [{"id": p.id, "name": p.name, "stock": p.stock, "sku": p.sku} for p in rows]


def recent_orders(db: Session, org_id: int, limit: int = 8) -> list[dict]:
    rows = (
        db.query(Order)
        .filter(Order.organization_id == org_id)
        .order_by(Order.placed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name if o.customer else None,
            "status": o.status,
            "total": _round(o.total),
            "placed_at": o.placed_at,
        }
        for o in rows
    ]


def goal_progress(db: Session, org_id: int, goal: Goal) -> dict:
    start_dt, end_dt = period_bounds(goal.starts_at.date(), goal.ends_at.date())
    current: float = 0.0
    if goal.type == "revenue":
        rows = _revenue_query(db, org_id, start_dt, end_dt)
        current = _round(sum((r[1] for r in rows), Decimal("0")))
    elif goal.type == "orders":
        current = float(len(_orders_query(db, org_id, start_dt, end_dt)))
    elif goal.type == "customers":
        current = float(
            db.query(func.count(Customer.id))
            .filter(Customer.organization_id == org_id, Customer.created_at >= start_dt, Customer.created_at <= end_dt)
            .scalar()
            or 0
        )
    elif goal.type == "profit":
        revenue_rows = _revenue_query(db, org_id, start_dt, end_dt)
        revenue = sum((r[1] for r in revenue_rows), Decimal("0"))
        current = _round(revenue - _cost_of_orders(db, org_id, start_dt, end_dt))

    pct = round(current / float(goal.target) * 100, 1) if goal.target else 0.0
    return {"current": current, "target": _round(goal.target), "progress_pct": pct, "status": goal.status}