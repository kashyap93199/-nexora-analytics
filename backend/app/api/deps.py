"""FastAPI dependencies for authentication, multi-tenant org scoping and RBAC."""

import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import TOKEN_TYPE_ACCESS, decode_token
from app.database.db import get_db
from app.models import OrganizationMember, User

bearer_scheme = HTTPBearer(auto_error=False)

# Fallback header for the access token. Some hosted preview / tunnel proxies
# (e.g. sandbox preview URLs) strip the standard ``Authorization`` header before
# it reaches the app, which breaks every authenticated request even though the
# login itself succeeds. The frontend sends the token in both places.
ACCESS_TOKEN_HEADER = "x-access-token"


def extract_access_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """Return the raw bearer token from ``Authorization`` or the fallback header."""
    if credentials is not None and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials
    fallback = request.headers.get(ACCESS_TOKEN_HEADER, "").strip()
    if fallback.lower().startswith("bearer "):
        fallback = fallback[7:].strip()
    return fallback or None


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = extract_access_token(request, credentials)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token, expected_type=TOKEN_TYPE_ACCESS)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    # Remember which workspace this token was issued for (see get_membership).
    request.state.token_org_id = payload.get("org")
    return user


def resolve_membership(db: Session, user_id: int, organization_id: int | None) -> OrganizationMember | None:
    """Return the user's active membership for ``organization_id``.

    Falls back to the user's oldest active membership when no organization is
    requested (or the requested one is no longer accessible), so a stale token
    never strands a user who still belongs to some workspace.
    """
    base = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id, OrganizationMember.status == "active"
    )
    if organization_id is not None:
        member = base.filter(OrganizationMember.organization_id == organization_id).first()
        if member is not None:
            return member
    return base.order_by(OrganizationMember.id.asc()).first()


def get_membership(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationMember:
    """Resolve the user's active membership (current organization + role)."""
    member = resolve_membership(db, user.id, getattr(request.state, "token_org_id", None))
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of any organization",
        )
    return member


def require_permission(permission: str):
    """Dependency factory: 403 unless the member's role grants the permission."""

    def _checker(
        member: OrganizationMember = Depends(get_membership),
        db: Session = Depends(get_db),
    ) -> OrganizationMember:
        if not role_has_permission(db, member.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return member

    return _checker


def role_permissions(db: Session, role: str) -> set[str]:
    """All permission keys granted to a role name (empty set for unknown roles)."""
    from app.models import Role

    role_obj = db.query(Role).filter(Role.name == role).first()
    if role_obj is None:
        return set()
    return {p.key for p in role_obj.permissions}


def role_has_permission(db: Session, role: str, permission: str) -> bool:
    return permission in role_permissions(db, role)


# Common query params ---------------------------------------------------------


def pagination_params(
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(25, ge=1, le=200),
) -> tuple[int, int]:
    return page, page_size
