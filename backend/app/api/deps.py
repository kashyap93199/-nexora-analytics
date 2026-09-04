"""FastAPI dependencies for authentication, multi-tenant org scoping and RBAC."""

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import TOKEN_TYPE_ACCESS, decode_token
from app.database.db import get_db
from app.models import OrganizationMember, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        payload = decode_token(credentials.credentials, expected_type=TOKEN_TYPE_ACCESS)
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
    return user


def get_membership(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationMember:
    """Resolve the user's active membership (current organization + role)."""
    member = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id, OrganizationMember.status == "active")
        .order_by(OrganizationMember.id.asc())
        .first()
    )
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


def role_has_permission(db: Session, role: str, permission: str) -> bool:
    from app.models import Role

    role_obj = db.query(Role).filter(Role.name == role).first()
    if role_obj is None:
        return False
    return any(p.key == permission for p in role_obj.permissions)


# Common query params ---------------------------------------------------------


def pagination_params(
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(25, ge=1, le=200),
) -> tuple[int, int]:
    return page, page_size