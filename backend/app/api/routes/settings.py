"""Account and organization settings."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, require_permission
from app.auth.permissions import P_ORG_MANAGE
from app.auth.security import hash_password, verify_password
from app.database.db import get_db
from app.models import Organization, OrganizationMember, User
from app.schemas.auth import MessageOut, UserOut
from app.schemas.settings import EmailUpdate, OrgUpdate, PasswordChange, ProfileUpdate
from app.utils.audit import write_audit

router = APIRouter(prefix="/settings", tags=["settings"])


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/email", response_model=UserOut)
def update_email(
    payload: EmailUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    email = payload.email.lower()
    if email == user.email:
        return UserOut.model_validate(user)
    if db.query(User).filter(User.email == email, User.id != user.id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    previous = user.email
    user.email = email
    db.commit()
    db.refresh(user)
    for m in user.memberships:
        if m.status == "active":
            write_audit(db, m.organization_id, user.id, "user.email_changed", "user", user.id, {"from": previous, "to": email})
    return UserOut.model_validate(user)


@router.put("/password", response_model=MessageOut)
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different from the current one")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    for m in user.memberships:
        if m.status == "active":
            write_audit(db, m.organization_id, user.id, "user.password_changed", "user", user.id)
    return MessageOut(message="Password updated")


@router.get("/organization", response_model=dict)
def get_organization(
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    org = db.get(Organization, member.organization_id)
    member_count = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == member.organization_id, OrganizationMember.status == "active")
        .count()
    )
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "currency": org.currency,
        "low_stock_threshold": org.low_stock_threshold,
        "member_count": member_count,
    }


@router.put("/organization", response_model=dict)
def update_organization(
    payload: OrgUpdate,
    member: OrganizationMember = Depends(require_permission(P_ORG_MANAGE)),
    db: Session = Depends(get_db),
) -> dict:
    org = db.get(Organization, member.organization_id)
    changes: dict = {}
    if org.name != payload.name.strip():
        changes["name"] = {"from": org.name, "to": payload.name.strip()}
    if org.currency != payload.currency.upper():
        changes["currency"] = {"from": org.currency, "to": payload.currency.upper()}
    org.name = payload.name.strip()
    org.currency = payload.currency.upper()
    if payload.low_stock_threshold is not None and payload.low_stock_threshold != org.low_stock_threshold:
        changes["low_stock_threshold"] = {"from": org.low_stock_threshold, "to": payload.low_stock_threshold}
        org.low_stock_threshold = payload.low_stock_threshold
    db.commit()
    db.refresh(org)
    write_audit(db, member.organization_id, member.user_id, "organization.updated", "organization", org.id, changes or None)
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "currency": org.currency,
        "low_stock_threshold": org.low_stock_threshold,
    }