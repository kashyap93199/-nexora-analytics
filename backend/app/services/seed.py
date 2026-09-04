"""Demo data seeder.

Generates a realistic multi-tenant dataset for the demo organization
("Acme Inc") so the dashboard looks populated immediately. All numbers are
generated with a fixed random seed and are internally consistent: order
totals match their line items, and sales/revenue records derive from the
same generated orders.

Run:  python -m app.services.seed   (from backend/)
"""

import random
from datetime import date, datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.permissions import ROLE_ADMIN, ROLE_MANAGER, ROLE_OWNER
from app.auth.security import hash_password
from app.database.db import SessionLocal, init_db
from app.models import (
    Category,
    Customer,
    Goal,
    Notification,
    Order,
    OrderItem,
    Organization,
    OrganizationMember,
    Product,
    RevenueRecord,
    SalesRecord,
    User,
)
from app.services.bootstrap import sync_roles_and_permissions

DEMO_ORG_NAME = "Acme Inc"
DEMO_EMAIL = "demo@nexora.app"
DEMO_PASSWORD = "DemoPassword123!"

FIRST_NAMES = [
    "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas",
    "Mia", "James", "Charlotte", "Henry", "Amelia", "Benjamin", "Harper", "Alexander", "Evelyn", "Daniel",
    "Grace", "Michael", "Chloe", "Samuel", "Ella", "David", "Lily", "Joseph", "Zoe", "Matthew",
    "Nora", "Andrew", "Riley", "Joshua", "Stella", "Nathan", "Aria", "Ryan", "Layla", "Jack",
    "Hannah", "Owen", "Aurora", "Dylan", "Camila", "Isaac", "Maya", "Caleb", "Ruby", "Hunter",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
]

REGIONS = [
    ("North America", ["New York", "Los Angeles", "Chicago", "Toronto", "Austin", "Seattle", "Miami"]),
    ("Europe", ["London", "Berlin", "Paris", "Madrid", "Amsterdam", "Dublin"]),
    ("Asia Pacific", ["Singapore", "Sydney", "Tokyo", "Melbourne", "Seoul"]),
    ("Latin America", ["São Paulo", "Mexico City", "Buenos Aires", "Bogotá"]),
    ("Middle East", ["Dubai", "Riyadh", "Tel Aviv"]),
    ("Africa", ["Johannesburg", "Nairobi", "Lagos"]),
]

CATEGORY_DEFS = [
    ("Electronics", "Gadgets, audio and smart devices"),
    ("Apparel", "Clothing and fashion essentials"),
    ("Home & Living", "Furniture, decor and kitchenware"),
    ("Beauty & Care", "Skincare, cosmetics and wellness"),
    ("Sports & Outdoors", "Fitness gear and outdoor equipment"),
    ("Accessories", "Bags, watches and jewelry"),
    ("Office & Stationery", "Desk essentials and supplies"),
    ("Toys & Kids", "Toys and children's products"),
]

PRODUCT_DEFS: dict[str, list[tuple[str, float, float]]] = {
    "Electronics": [
        ("Aurora Wireless Earbuds", 89.0, 38.0), ("Nova Smart Watch", 199.0, 92.0),
        ("Pulse Bluetooth Speaker", 59.0, 27.0), ("Volt Power Bank 20K", 39.0, 15.0),
        ("Echo USB-C Hub 7-in-1", 49.0, 21.0),
    ],
    "Apparel": [
        ("Cloud Cotton Tee", 24.0, 8.0), ("Drift Denim Jacket", 79.0, 34.0),
        ("Trail Running Shorts", 34.0, 12.0), ("Merino Crew Sweater", 68.0, 26.0),
        ("Everyday Joggers", 44.0, 16.0),
    ],
    "Home & Living": [
        ("Lumen Desk Lamp", 45.0, 19.0), ("Terrace Ceramic Vase", 32.0, 10.0),
        ("Haven Throw Blanket", 55.0, 22.0), ("Aroma Diffuser Pro", 42.0, 15.0),
        ("Bamboo Cutting Board Set", 36.0, 12.0),
    ],
    "Beauty & Care": [
        ("Glow Vitamin C Serum", 38.0, 11.0), ("Hydra Face Cream", 28.0, 8.0),
        ("Pure Argan Oil", 22.0, 7.0), ("Silk Hair Care Duo", 48.0, 17.0),
        ("Mineral SPF 50", 26.0, 9.0),
    ],
    "Sports & Outdoors": [
        ("Flex Yoga Mat", 35.0, 13.0), ("Apex Dumbbell Set", 120.0, 58.0),
        ("Summit Water Bottle", 25.0, 9.0), ("Trail Backpack 30L", 95.0, 44.0),
        ("Resistance Band Kit", 29.0, 10.0),
    ],
    "Accessories": [
        ("Metro Leather Wallet", 55.0, 21.0), ("Classic Wayfarer Sunglasses", 65.0, 25.0),
        ("Minimal Canvas Tote", 30.0, 11.0), ("Stainless Chronograph Watch", 149.0, 68.0),
        ("Silk Touch Scarf", 33.0, 12.0),
    ],
    "Office & Stationery": [
        ("Ergo Desk Chair", 249.0, 118.0), ("Focus Mechanical Keyboard", 99.0, 41.0),
        ("Grid Notebook Pack", 21.0, 7.0), ("Standing Desk Converter", 179.0, 82.0),
        ("Gel Pen Set", 14.0, 5.0),
    ],
    "Toys & Kids": [
        ("Build-a-Bot Kit", 49.0, 19.0), ("Wooden Puzzle Blocks", 27.0, 9.0),
        ("Stellar Telescope Jr", 79.0, 33.0), ("Plush Dino Collection", 24.0, 8.0),
        ("Magnetic Building Tiles", 39.0, 14.0),
    ],
}

CHANNEL_WEIGHTS = [("online", 62), ("in_store", 18), ("wholesale", 12), ("partner", 8)]
STATUS_WEIGHTS = [("pending", 6), ("processing", 10), ("shipped", 14), ("delivered", 70)]


def _at(d: date, hour: int = 10) -> datetime:
    return datetime.combine(d, time(hour=hour))


def _month_start(d: date) -> datetime:
    return datetime.combine(d.replace(day=1), time.min)


def _month_end(d: date) -> datetime:
    nxt = (d.replace(day=28) + timedelta(days=7)).replace(day=1)
    return datetime.combine(nxt - timedelta(days=1), time.max)


def seed_demo(db: Session) -> None:
    """Seed the demo workspace. Idempotent: re-running never duplicates data.

    Users/members/roles/categories/products are upserted; orders, customers,
    sales and revenue records are only generated when the demo organization
    has no orders yet (so `docker compose up` restarts do not double data).
    """
    rng = random.Random(42)
    today = date.today()
    start_date = today - timedelta(days=730)

    sync_roles_and_permissions(db)

    # ------------------------------------------------------------------ users
    demo_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if demo_user is None:
        demo_user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), full_name="Demo Owner")
        db.add(demo_user)
    admin_user = db.query(User).filter(User.email == "sarah@acme.demo").first()
    if admin_user is None:
        admin_user = User(email="sarah@acme.demo", password_hash=hash_password("AdminPassword123!"), full_name="Sarah Chen")
        db.add(admin_user)
    manager_user = db.query(User).filter(User.email == "marcus@acme.demo").first()
    if manager_user is None:
        manager_user = User(email="marcus@acme.demo", password_hash=hash_password("ManagerPassword123!"), full_name="Marcus Reid")
        db.add(manager_user)
    db.flush()

    # --------------------------------------------------------- organization
    org = db.query(Organization).filter(Organization.slug == "acme-inc").first()
    if org is None:
        org = Organization(name=DEMO_ORG_NAME, slug="acme-inc", plan="business", currency="USD")
        db.add(org)
        db.flush()
    for user, role in [(demo_user, ROLE_OWNER), (admin_user, ROLE_ADMIN), (manager_user, ROLE_MANAGER)]:
        existing = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.organization_id == org.id, OrganizationMember.user_id == user.id)
            .first()
        )
        if existing is None:
            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role=role, status="active"))
    if (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == org.id, OrganizationMember.status == "pending")
        .first()
        is None
    ):
        db.add(
            OrganizationMember(
                organization_id=org.id,
                user_id=None,
                role="analyst",
                status="pending",
                invite_token="demo-pending-invite-token",
            )
        )
    db.flush()

    # Skip transactional data generation if the demo org already has orders.
    org_has_data = (
        db.query(Order.id).filter(Order.organization_id == org.id).first() is not None
    )
    if org_has_data:
        db.commit()
        print("ℹ️  Demo workspace already seeded — skipping data generation (idempotent).")
        return

    # ------------------------------------------------------------- categories
    categories: dict[str, Category] = {}
    for name, description in CATEGORY_DEFS:
        cat = db.query(Category).filter(Category.organization_id == org.id, Category.name == name).first()
        if cat is None:
            cat = Category(organization_id=org.id, name=name, description=description)
            db.add(cat)
            db.flush()
        categories[name] = cat

    # --------------------------------------------------------------- products
    products: list[Product] = []
    existing_skus = {sku for (sku,) in db.query(Product.sku).filter(Product.organization_id == org.id).all()}
    for cat_name, defs in PRODUCT_DEFS.items():
        cat = categories[cat_name]
        for idx, (name, price, cost) in enumerate(defs, start=1):
            sku = f"{cat_name[:3].upper()}-{idx:03d}"
            if sku in existing_skus:
                continue
            existing_skus.add(sku)
            products.append(
                Product(
                    organization_id=org.id,
                    category_id=cat.id,
                    name=name,
                    sku=sku,
                    description=f"{name} — premium quality.",
                    price=price,
                    cost=cost,
                    stock=rng.randint(4, 180),
                    status="active",
                )
            )
    db.add_all(products)
    db.flush()
    products = db.query(Product).filter(Product.organization_id == org.id).all()

    # -------------------------------------------------------------- customers
    existing_emails = {c.email for c in db.query(Customer.email).filter(Customer.organization_id == org.id).all()}
    customers: list[Customer] = []
    while len(customers) < 620:
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        email = f"{first.lower()}.{last.lower()}{rng.randint(1, 99)}@example.com"
        if email in existing_emails:
            continue
        existing_emails.add(email)
        region_name, cities = rng.choice(REGIONS)
        customers.append(
            Customer(
                organization_id=org.id,
                name=f"{first} {last}",
                email=email,
                phone=f"+1{rng.randint(200, 989)}{rng.randint(1000000, 9999999)}",
                city=rng.choice(cities),
                region=region_name,
                country=region_name,
                created_at=_at(today - timedelta(days=rng.randint(0, 720))),
            )
        )
    db.add_all(customers)
    db.flush()
    customers = db.query(Customer).filter(Customer.organization_id == org.id).all()

    # ----------------------------------------------------------------- orders
    order_numbers = {on for (on,) in db.query(Order.order_number).filter(Order.organization_id == org.id).all()}
    customer_ids = [c.id for c in customers]
    customer_created = {c.id: c.created_at.date() for c in customers}
    customer_created_dt = {c.id: c.created_at for c in customers}

    order_batch: list[Order] = []
    per_day_units: dict[tuple[date, int], int] = {}
    per_day_revenue: dict[date, float] = {}
    seq = rng.randint(1000, 9999)

    day = start_date
    while day <= today:
        growth = 1.0 + (day - start_date).days / 730 * 1.1
        seasonal = 1.0 + 0.35 * (1 if day.month in (11, 12) else 0) - 0.18 * (1 if day.month == 1 else 0)
        weekend = 1.4 if day.weekday() >= 5 else 1.0
        count = max(2, int(round(6 * growth * seasonal * weekend)) + rng.randint(-3, 6))

        # Only customers that already existed on this day may order (keeps
        # created_at <= first order invariant that analytics rely on).
        eligible = [cid for cid in customer_ids if customer_created[cid] <= day]
        if not eligible:
            day += timedelta(days=1)
            continue

        for _ in range(count):
            placed_at = _at(day, rng.randint(8, 21)) + timedelta(minutes=rng.randint(0, 59), seconds=rng.randint(0, 59))
            candidate = rng.choice(eligible)
            if rng.random() < 0.7:
                fresh = [cid for cid in eligible if (day - customer_created[cid]).days <= 120]
                if fresh:
                    candidate = rng.choice(fresh)
            # Never place an order before the customer's account existed.
            placed_at = max(placed_at, customer_created_dt[candidate] + timedelta(minutes=1))

            region = db.query(Customer.region).filter(Customer.id == candidate).scalar()
            channel = rng.choices(*zip(*CHANNEL_WEIGHTS))[0]
            status = rng.choices(*zip(*STATUS_WEIGHTS))[0]
            if rng.random() < 0.05:
                status = "cancelled"
            elif rng.random() < 0.04:
                status = "refunded"

            chosen = rng.sample(products, rng.choices([1, 2, 3, 4], weights=[42, 34, 17, 7])[0])
            items = []
            subtotal = 0.0
            for product in chosen:
                qty = rng.choices([1, 2, 3], weights=[74, 20, 6])[0]
                line_total = round(float(product.price) * qty, 2)
                subtotal += line_total
                items.append(
                    OrderItem(
                        product_id=product.id,
                        product_name=product.name,
                        quantity=qty,
                        unit_price=float(product.price),
                        total=line_total,
                    )
                )
                key = (day, product.id)
                per_day_units[key] = per_day_units.get(key, 0) + qty

            discount = round(subtotal * rng.choice([0.0, 0.0, 0.05, 0.1]), 2)
            tax = round((subtotal - discount) * 0.08, 2)
            shipping = round(rng.choice([0.0, 0.0, 5.99, 9.99]), 2)
            total = round(subtotal - discount + tax + shipping, 2)

            seq += 1
            number = f"ORD-{day.strftime('%Y%m%d')}-{seq % 10000:04d}"
            while number in order_numbers:
                seq += 1
                number = f"ORD-{day.strftime('%Y%m%d')}-{seq % 10000:04d}"
            order_numbers.add(number)

            order = Order(
                organization_id=org.id,
                customer_id=candidate,
                order_number=number,
                status=status,
                channel=channel,
                region=region,
                subtotal=subtotal,
                discount=discount,
                tax=tax,
                shipping=shipping,
                total=total,
                placed_at=placed_at,
            )
            order.items = items  # cascade inserts line items
            order_batch.append(order)
            if status in ("pending", "processing", "shipped", "delivered"):
                per_day_revenue[day] = per_day_revenue.get(day, 0.0) + total
        day += timedelta(days=1)

    db.add_all(order_batch)

    # ------------------------------------------------------------------ sales
    sales_batch: list[SalesRecord] = []
    product_prices = {p.id: float(p.price) for p in products}
    for (sale_day, product_id), units in per_day_units.items():
        price = product_prices[product_id]
        gross = round(units * price, 2)
        refunds = round(gross * rng.choice([0.0, 0.0, 0.03, 0.06]), 2)
        conv_rate = rng.uniform(0.02, 0.05)
        sales_batch.append(
            SalesRecord(
                organization_id=org.id,
                product_id=product_id,
                date=_at(sale_day, 12),
                region=rng.choice(REGIONS)[0],
                channel=rng.choices(*zip(*CHANNEL_WEIGHTS))[0],
                units_sold=units,
                gross_revenue=gross,
                refunds=refunds,
                visitors=max(units, int(units / conv_rate)),
                conversions=units,
            )
        )
    db.add_all(sales_batch)

    # --------------------------------------------------------- revenue records
    revenue_batch: list[RevenueRecord] = []
    for d, amount in per_day_revenue.items():
        revenue_batch.append(RevenueRecord(organization_id=org.id, date=_at(d, 12), source="orders", amount=round(amount, 2)))
    day = start_date
    while day <= today:
        revenue_batch.append(
            RevenueRecord(organization_id=org.id, date=_at(day, 12), source="subscriptions", amount=round(320.0 + rng.uniform(-20, 40), 2))
        )
        if rng.random() < 0.12:
            revenue_batch.append(
                RevenueRecord(organization_id=org.id, date=_at(day, 12), source="services", amount=round(rng.uniform(150, 1200), 2))
            )
        day += timedelta(days=1)
    db.add_all(revenue_batch)

    db.commit()

    # ------------------------------------------------------------- segments
    spend = (
        db.query(Order.customer_id, func.sum(Order.total).label("spent"))
        .filter(Order.organization_id == org.id)
        .group_by(Order.customer_id)
        .all()
    )
    spent_by_customer = {cid: float(s) for cid, s in spend}
    last_order = (
        db.query(Order.customer_id, func.max(Order.placed_at).label("last"))
        .filter(Order.organization_id == org.id)
        .group_by(Order.customer_id)
        .all()
    )
    last_by_customer = {cid: last for cid, last in last_order}

    sorted_spend = sorted(spent_by_customer.items(), key=lambda kv: kv[1], reverse=True)
    vip_ids = {cid for cid, _ in sorted_spend[: int(len(sorted_spend) * 0.08)]}

    for customer in db.query(Customer).filter(Customer.organization_id == org.id).all():
        last = last_by_customer.get(customer.id)
        if customer.id in vip_ids:
            segment = "vip"
        elif last is None or (today - last.date()).days > 90:
            segment = "inactive"
        elif (today - customer.created_at.date()).days <= 60:
            segment = "new"
        else:
            segment = "returning"
        customer.segment = segment
        customer.last_order_at = last
    db.commit()

    # ---------------------------------------------------------------- goals
    if db.query(Goal).filter(Goal.organization_id == org.id).count() == 0:
        m_start, m_end = _month_start(today), _month_end(today)
        monthly_revenue = sum(v for d, v in per_day_revenue.items() if d.year == today.year and d.month == today.month)
        db.add_all(
            [
                Goal(organization_id=org.id, name="Monthly Revenue Goal", type="revenue", target=round(monthly_revenue * 1.2, -3), period="monthly", starts_at=m_start, ends_at=m_end, status="active", created_by=demo_user.id),
                Goal(organization_id=org.id, name="Monthly Orders Goal", type="orders", target=max(400, int(len(order_batch) / 24 * 1.15)), period="monthly", starts_at=m_start, ends_at=m_end, status="active", created_by=demo_user.id),
                Goal(organization_id=org.id, name="New Customers This Quarter", type="customers", target=420, period="quarterly", starts_at=_month_start(today - timedelta(days=90)), ends_at=m_end, status="active", created_by=demo_user.id),
                Goal(organization_id=org.id, name="Annual Profit Goal", type="profit", target=240_000, period="yearly", starts_at=datetime.combine(date(today.year, 1, 1), time.min), ends_at=datetime.combine(date(today.year, 12, 31), time.max), status="active", created_by=demo_user.id),
            ]
        )
        db.commit()

    # --------------------------------------------------------- notifications
    if db.query(Notification).filter(Notification.organization_id == org.id).count() == 0:
        low = (
            db.query(Product)
            .filter(Product.organization_id == org.id, Product.status == "active")
            .order_by(Product.stock.asc())
            .first()
        )
        notes = [
            Notification(organization_id=org.id, title="Welcome to Nexora Analytics", message="Your demo workspace is ready. Explore the dashboard, analytics and reports.", type="system", is_read=False),
            Notification(organization_id=org.id, title="Revenue target reached", message="You're on track to hit this month's revenue goal.", type="revenue", is_read=False),
            Notification(organization_id=org.id, title="Sales increased", message="Sales are up this week compared to the previous period.", type="sales", is_read=False),
            Notification(organization_id=org.id, title="Sarah Chen joined your team", message="Sarah Chen accepted the invitation as an Admin.", type="team", is_read=False),
        ]
        if low:
            notes.append(
                Notification(organization_id=org.id, title="Low inventory alert", message=f"'{low.name}' has only {low.stock} units left in stock.", type="inventory", is_read=False)
            )
        db.add_all(notes)
        db.commit()


def run_seed() -> None:
    """CLI entrypoint: python -m app.services.seed"""
    init_db()
    with SessionLocal() as db:
        seed_demo(db)
    print("✅ Demo data seeded:")
    print(f"   Organization : {DEMO_ORG_NAME}")
    print(f"   Owner login  : {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    run_seed()