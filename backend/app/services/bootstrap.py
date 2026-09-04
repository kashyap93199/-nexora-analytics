"""Ensure system roles and permissions exist in the database."""

from sqlalchemy.orm import Session

from app.auth.permissions import (
    ALL_PERMISSIONS,
    PERMISSION_DESCRIPTIONS,
    ROLE_DESCRIPTIONS,
    ROLE_PERMISSIONS,
)
from app.models import Permission, Role


def sync_roles_and_permissions(db: Session) -> None:
    permissions: dict[str, Permission] = {}
    for key in ALL_PERMISSIONS:
        perm = db.query(Permission).filter(Permission.key == key).first()
        if perm is None:
            perm = Permission(key=key, description=PERMISSION_DESCRIPTIONS.get(key, ""))
            db.add(perm)
        permissions[key] = perm
    db.flush()

    for role_name, perm_keys in ROLE_PERMISSIONS.items():
        role = db.query(Role).filter(Role.name == role_name).first()
        if role is None:
            role = Role(
                name=role_name,
                description=ROLE_DESCRIPTIONS.get(role_name, ""),
                is_system=True,
            )
            db.add(role)
            db.flush()
        role.permissions = [permissions[k] for k in perm_keys]
    db.commit()