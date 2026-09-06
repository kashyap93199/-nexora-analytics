"""Audit logging for sensitive actions."""

import json

from sqlalchemy.orm import Session

from app.models import AuditLog


def write_audit(
    db: Session,
    organization_id: int,
    user_id: int | None,
    action: str,
    resource_type: str = "",
    resource_id: int | None = None,
    details: dict | None = None,
    *,
    commit: bool = True,
) -> None:
    """Record an audit event.

    Pass ``commit=False`` when the caller is in the middle of a larger unit of
    work and wants the audit row to commit (or roll back) together with it.
    """
    db.add(
        AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=json.dumps(details) if details else None,
        )
    )
    if commit:
        db.commit()
