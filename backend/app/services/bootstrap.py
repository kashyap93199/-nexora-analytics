"""Ensure system roles and permissions exist in the database.

Idempotent and safe to run concurrently: when several Uvicorn workers start
at once against an empty database, every worker runs this during the app
lifespan. All inserts use INSERT ... ON CONFLICT DO NOTHING so the worker
that loses the race simply inserts nothing instead of crashing on a UNIQUE
constraint violation.
"""

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.auth.permissions import (
    ALL_PERMISSIONS,
    PERMISSION_DESCRIPTIONS,
    ROLE_DESCRIPTIONS,
    ROLE_PERMISSIONS,
)
from app.models import Permission, Role
from app.models.organization import role_permissions


def _insert_ignore(db: Session, table, rows: list[dict]) -> None:
    """Insert rows, skipping any that would violate a unique constraint.

    Executes the dialect's ``INSERT ... ON CONFLICT DO NOTHING`` so
    concurrent workers racing the same insert no-op instead of crashing.
    """
    if not rows:
        return
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    db.execute(insert(table).values(rows).on_conflict_do_nothing())


def sync_roles_and_permissions(db: Session) -> None:
    """Create missing system permissions/roles and reconcile the role matrix.

    The role matrix in ``app.auth.permissions`` is the source of truth: on
    every startup each system role is granted exactly the permissions listed
    there (stale grants are revoked, missing ones added). Permission rows are
    only ever created, never modified or removed.
    """
    # Insert any missing permission rows (conflict-safe under concurrency).
    _insert_ignore(
        db,
        Permission,
        [{"key": key, "description": PERMISSION_DESCRIPTIONS.get(key, "")} for key in ALL_PERMISSIONS],
    )

    # Insert any missing role rows (conflict-safe under concurrency).
    _insert_ignore(
        db,
        Role,
        [{"name": name, "description": ROLE_DESCRIPTIONS.get(name, ""), "is_system": True} for name in ROLE_PERMISSIONS],
    )

    # Reconcile each role's grants with the matrix. The desired and current
    # sets are computed from a single read, then only the difference is
    # written: inserts are DO NOTHING and deletes of already-removed rows
    # match nothing, so concurrent workers always converge on the same state.
    permission_id_by_key = {
        key: pid for pid, key in db.execute(select(Permission.id, Permission.key)).all()
    }
    role_id_by_name = {name: rid for rid, name in db.execute(select(Role.id, Role.name)).all()}
    existing_pairs = set(
        db.execute(select(role_permissions.c.role_id, role_permissions.c.permission_id)).all()
    )
    desired_pairs = {
        (role_id_by_name[name], permission_id_by_key[key])
        for name, keys in ROLE_PERMISSIONS.items()
        for key in keys
    }

    for role_id, permission_id in existing_pairs - desired_pairs:
        db.execute(
            delete(role_permissions).where(
                role_permissions.c.role_id == role_id,
                role_permissions.c.permission_id == permission_id,
            )
        )
    _insert_ignore(
        db,
        role_permissions,
        [
            {"role_id": role_id, "permission_id": permission_id}
            for role_id, permission_id in desired_pairs - existing_pairs
        ],
    )

    db.commit()
