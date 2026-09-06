"""Authentication endpoints."""

import re
import secrets

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_membership, resolve_membership, role_permissions
from app.auth.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    utcnow,
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
    SwitchOrganizationIn,
    UserOut,
    WorkspaceOut,
)
from app.services.bootstrap import sync_roles_and_permissions
from app.utils.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:100] or "organization"


def _unique_org_slug(db: Session, name: str) -> str:
    """Slugs are globally unique; two 'Acme Inc' workspaces must not collide."""
    base = _slugify(name)
    slug = base
    while db.query(Organization.id).filter(Organization.slug == slug).first() is not None:
        slug = f"{base}-{secrets.token_hex(3)}"
    return slug


def _auth_response(user: User, member: OrganizationMember) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id, member.organization_id),
        refresh_token=create_refresh_token(user.id, member.organization_id),
        user=UserOut.model_validate(user),
        organization=OrganizationOut.model_validate(member.organization),
        role=member.role,
    )


def _workspaces(db: Session, user_id: int) -> list[WorkspaceOut]:
    rows = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user_id, OrganizationMember.status == "active")
        .order_by(OrganizationMember.id.asc())
        .all()
    )
    return [
        WorkspaceOut(
            id=m.organization.id,
            name=m.organization.name,
            slug=m.organization.slug,
            plan=m.organization.plan,
            currency=m.organization.currency,
            role=m.role,
        )
        for m in rows
    ]


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    # Resolve the invitation *before* creating anything so a bad token never
    # leaves an orphaned user row behind.
    member: OrganizationMember | None = None
    if payload.invite_token:
        member = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.invite_token == payload.invite_token, OrganizationMember.status == "pending")
            .first()
        )
        if member is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found or already used")
        if member.invite_email and member.invite_email.lower() != email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation was sent to a different email address",
            )

    # Roles/permissions are synced at startup; this only matters for fresh
    # databases and is idempotent. Nothing is committed before the user exists.
    sync_roles_and_permissions(db)

    user = User(email=email, password_hash=hash_password(payload.password), full_name=payload.full_name.strip())
    db.add(user)
    db.flush()

    if member is not None:
        member.user_id = user.id
        member.status = "active"
        member.invite_token = None
        member.invite_email = None
        org = member.organization
        write_audit(db, org.id, user.id, "member.accepted_invite", "organization", org.id, commit=False)
    else:
        org_name = (payload.organization_name or "").strip() or "My Organization"
        org = Organization(name=org_name, slug=_unique_org_slug(db, org_name), plan="free", currency="USD")
        db.add(org)
        db.flush()
        member = OrganizationMember(organization_id=org.id, user_id=user.id, role="owner", status="active")
        db.add(member)
        write_audit(db, org.id, user.id, "organization.created", "organization", org.id, commit=False)

    # Single atomic commit: either the user + membership (+ org) all exist, or none do.
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

    member = resolve_membership(db, user.id, None)
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of any organization")

    member.last_active_at = utcnow()
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
    # Stay in the workspace the session was using (falls back if access was revoked).
    member = resolve_membership(db, user.id, decoded.get("org"))
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of any organization")
    return _auth_response(user, member)


@router.get("/me", response_model=dict)
def me(
    user: User = Depends(get_current_user),
    member: OrganizationMember = Depends(get_membership),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "user": UserOut.model_validate(user),
        "organization": OrganizationOut.model_validate(member.organization),
        "role": member.role,
        "permissions": sorted(role_permissions(db, member.role)),
        "workspaces": _workspaces(db, user.id),
    }


@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[WorkspaceOut]:
    """Every organization the current user can switch into."""
    return _workspaces(db, user.id)


@router.post("/switch-organization", response_model=AuthResponse)
def switch_organization(
    payload: SwitchOrganizationIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Issue tokens scoped to another organization the user is a member of."""
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == payload.organization_id,
            OrganizationMember.status == "active",
        )
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not a member of that organization")
    member.last_active_at = utcnow()
    db.commit()
    return _auth_response(user, member)


@router.post("/logout", response_model=MessageOut)
def logout() -> MessageOut:
    # Stateless JWTs: the client discards tokens. Note in docs: production would
    # add a Redis-backed denylist for refresh tokens.
    return MessageOut(message="Logged out")
