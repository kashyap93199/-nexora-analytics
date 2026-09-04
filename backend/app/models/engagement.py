from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base

GOAL_TYPES = ("revenue", "orders", "customers", "profit")
GOAL_PERIODS = ("monthly", "quarterly", "yearly")
GOAL_STATUSES = ("active", "completed", "archived")


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # revenue | orders | customers | profit
    target: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    period: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    type: Mapped[str] = mapped_column(String(30), default="system", nullable=False)  # revenue|sales|inventory|team|order|report|system
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True, nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # sales|revenue|customer|product|performance
    filters: Mapped[str] = mapped_column(Text, default="{}", nullable=False)  # JSON-encoded filters
    data: Mapped[str] = mapped_column(Text, default="{}", nullable=False)  # JSON-encoded snapshot
    status: Mapped[str] = mapped_column(String(20), default="ready", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True, nullable=False)

    creator = relationship("User", lazy="joined")