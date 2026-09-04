"""Audit log endpoints."""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_membership, pagination_params, require_permission
from app.auth.permissions import P_AUDIT_VIEW
from app.database.db import get_db
from app.models import AuditLog, OrganizationMember, User
from app.schemas.common import Page

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    action: str | None = Query(None, max_length=120),
    pagination: tuple[int, int] = Depends(pagination_params),
    member: OrganizationMember = Depends(require_permission(P_AUDIT_VIEW)),
    db: Session = Depends(get_db),
) -> Page:
    page, page_size = pagination
    query = db.query(AuditLog).filter(AuditLog.organization_id == member.organization_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for row in rows:
        user = db.get(User, row.user_id)
        items.append(
            {
                "id": row.id,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "details": json.loads(row.details) if row.details else None,
                "user_name": user.full_name if user else "System",
                "created_at": row.created_at,
            }
        )
    return Page(items=items, total=total, page=page, page_size=page_size, pages=(total + page_size - 1) // page_size)