"""Audit log endpoints."""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import pagination_params, require_permission
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
    user_ids = {row.user_id for row in rows if row.user_id is not None}
    users = (
        {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    )
    items = [
        {
            "id": row.id,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "details": json.loads(row.details) if row.details else None,
            "user_name": users.get(row.user_id, "System") if row.user_id is not None else "System",
            "created_at": row.created_at,
        }
        for row in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size, pages=(total + page_size - 1) // page_size)