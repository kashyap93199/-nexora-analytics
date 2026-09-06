from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base

# Association table: which permissions a role grants.
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    permissions = relationship(
        "Permission", secondary=role_permissions, lazy="selectin", backref="roles"
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(40), default="free", nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    # Products at or below this stock level are flagged as "low stock".
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=15, server_default="15", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(40), default="viewer", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active | pending
    invite_token: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    invite_email: Mapped[str | None] = mapped_column(String(255))  # email the invite was sent to (pending only)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    resource_id: Mapped[int | None] = mapped_column()
    details: Mapped[dict | None] = mapped_column(Text, default=None)  # JSON-encoded
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True, nullable=False)