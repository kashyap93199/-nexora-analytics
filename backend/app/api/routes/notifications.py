"""Notification center endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_membership
from app.database.db import get_db
from app.models import Notification, OrganizationMember
from app.schemas.common import MessageOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _scope(member: OrganizationMember):
    """Org-wide notifications plus ones addressed to this user."""
    return or_(
        Notification.user_id.is_(None),
        Notification.user_id == member.user_id,
    )


@router.get("")
def list_notifications(
    unread_only: bool = False,
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Notification).filter(
        Notification.organization_id == member.organization_id, _scope(member)
    )
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    items = query.order_by(Notification.created_at.desc()).limit(100).all()
    unread = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.organization_id == member.organization_id,
            _scope(member),
            Notification.is_read.is_(False),
        )
        .scalar()
        or 0
    )
    return {
        "unread": unread,
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in items
        ],
    }


@router.post("/{notification_id}/read", response_model=MessageOut)
def mark_read(
    notification_id: int,
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> MessageOut:
    notification = db.query(Notification).filter(
        Notification.id == notification_id, Notification.organization_id == member.organization_id
    ).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return MessageOut(message="Marked as read")


@router.post("/read-all", response_model=MessageOut)
def mark_all_read(
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> MessageOut:
    db.query(Notification).filter(
        Notification.organization_id == member.organization_id,
        _scope(member),
        Notification.is_read.is_(False),
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return MessageOut(message="All notifications marked as read")