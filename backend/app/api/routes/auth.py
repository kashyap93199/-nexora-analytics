"""Authentication endpoints."""

import re

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership
from app.auth.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database.db import get_db
from app.models import Organization, OrganizationMember, User
from app.schemas.auth import (
    AuthResponse,
    LoginIn,
    MessageOut,
    OrganizationOut,
    RefreshIn,
    RegisterIn,
    UserOut,
)
from app.services.bootstrap import sync_roles_and_permissions
from app.utils.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _org_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "organization"


def _auth_response(user: User, member: OrganizationMember) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
        organization=OrganizationOut.model_validate(member.organization),
        role=member.role,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()

    sync_roles_and_permissions(db)

    if payload.invite_token:
        member = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.invite_token == payload.invite_token, OrganizationMember.status == "pending")
            .first()
        )
        if member is None:
            db.delete(user)
            db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found or already used")
        member.user_id = user.id
        member.status = "active"
        member.invite_token = None
        org = member.organization
        write_audit(db, org.id, user.id, "member.accepted_invite", "organization", org.id)
    else:
        org_name = payload.organization_name or "My Organization"
        org = Organization(
            name=org_name,
            slug=_org_slug(org_name),
            plan="free",
            currency="USD",
        )
        db.add(org)
        db.flush()
        member = OrganizationMember(
            organization_id=org.id, user_id=user.id, role="owner", status="active"
        )
        db.add(member)
        write_audit(db, org.id, user.id, "organization.created", "organization", org.id)

    db.commit()
    db.refresh(member)
    return _auth_response(user, member)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    member = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id, OrganizationMember.status == "active")
        .order_by(OrganizationMember.id.asc())
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of any organization")

    from datetime import UTC, datetime

    member.last_active_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return _auth_response(user, member)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        decoded = decode_token(payload.refresh_token, expected_type=TOKEN_TYPE_REFRESH)
        user_id = int(decoded["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    member = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id, OrganizationMember.status == "active")
        .order_by(OrganizationMember.id.asc())
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of any organization")
    return _auth_response(user, member)


@router.get("/me", response_model=dict)
def me(
    user: User = Depends(get_current_user),
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    from app.models import Role

    role_obj = db.query(Role).filter(Role.name == member.role).first()
    permissions = sorted({p.key for p in role_obj.permissions}) if role_obj else []
    return {
        "user": UserOut.model_validate(user),
        "organization": OrganizationOut.model_validate(member.organization),
        "role": member.role,
        "permissions": permissions,
    }


@router.post("/logout", response_model=MessageOut)
def logout() -> MessageOut:
    # Stateless JWTs: the client discards tokens. Note in docs: production would
    # add a Redis-backed denylist for refresh tokens.
    return MessageOut(message="Logged out")