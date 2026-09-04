from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base

# Order statuses
ORDER_STATUSES = ("pending", "processing", "shipped", "delivered", "cancelled", "refunded")
CUSTOMER_SEGMENTS = ("new", "returning", "vip", "inactive")
CHANNELS = ("online", "in_store", "wholesale", "partner")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    city: Mapped[str | None] = mapped_column(String(80))
    region: Mapped[str | None] = mapped_column(String(80), index=True)
    country: Mapped[str | None] = mapped_column(String(80))
    segment: Mapped[str] = mapped_column(String(20), default="new", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True, nullable=False)
    last_order_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    orders = relationship("Order", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    order_number: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)
    channel: Mapped[str] = mapped_column(String(30), default="online", index=True, nullable=False)
    region: Mapped[str | None] = mapped_column(String(80), index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    shipping: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0, index=True)
    placed_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    customer = relationship("Customer", back_populates="orders")
    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_name: Mapped[str] = mapped_column(String(160), nullable=False)  # snapshot
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class SalesRecord(Base):
    """Daily per-product performance: units, revenue, refunds, traffic.

    Powers conversion rate and granular sales analytics without faking numbers.
    """

    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    date: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    region: Mapped[str] = mapped_column(String(80), default="", index=True, nullable=False)
    channel: Mapped[str] = mapped_column(String(30), default="online", index=True, nullable=False)
    units_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gross_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    refunds: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    visitors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conversions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class RevenueRecord(Base):
    """Daily revenue per source (orders, subscriptions, services)."""

    __tablename__ = "revenue_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(40), default="orders", index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)