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
) -> None:
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
    db.commit()