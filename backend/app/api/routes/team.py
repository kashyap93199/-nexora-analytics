"""Team management: members list, invites, role changes, removal."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.auth.permissions import P_TEAM_MANAGE, P_TEAM_VIEW
from app.database.db import get_db
from app.models import Notification, OrganizationMember, User
from app.schemas.auth import MemberOut
from app.schemas.common import MessageOut
from app.schemas.settings import InviteIn, RoleUpdate
from app.utils.audit import write_audit

router = APIRouter(prefix="/team", tags=["team"])


def _to_out(member: OrganizationMember) -> MemberOut:
    return MemberOut(
        id=member.id,
        user_id=member.user_id,
        full_name=member.user.full_name if member.user else "Invited",
        email=member.user.email if member.user else (member.invite_email or "pending@invite"),
        role=member.role,
        status=member.status,
        last_active_at=member.last_active_at,
        created_at=member.created_at,
    )


def _get_target(db: Session, org_id: int, member_id: int) -> OrganizationMember:
    target = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.id == member_id, OrganizationMember.organization_id == org_id)
        .first()
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return target


def _owner_count(db: Session, org_id: int) -> int:
    return (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.role == "owner",
            OrganizationMember.status == "active",
        )
        .count()
    )


@router.get("", response_model=list[MemberOut])
def list_members(
    member: OrganizationMember = Depends(require_permission(P_TEAM_VIEW)),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    members = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == member.organization_id)
        .order_by(OrganizationMember.created_at.asc(), OrganizationMember.id.asc())
        .all()
    )
    return [_to_out(m) for m in members]


@router.post("/invite", response_model=dict, status_code=status.HTTP_201_CREATED)
def invite_member(
    payload: InviteIn,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> dict:
    email = payload.email.lower()
    org_id = member.organization_id

    # Existing account → add them straight away (they can switch workspaces).
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        existing_member = (
            db.query(OrganizationMember)
            .filter(OrganizationMember.organization_id == org_id, OrganizationMember.user_id == existing_user.id)
            .first()
        )
        if existing_member is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already a member")

        new_member = OrganizationMember(organization_id=org_id, user_id=existing_user.id, role=payload.role, status="active")
        db.add(new_member)
        db.flush()
        db.add(
            Notification(
                organization_id=org_id,
                user_id=existing_user.id,
                title="You were added to a team",
                message=f"You are now a {payload.role} at {member.organization.name}. Switch workspaces from your account menu.",
                type="team",
            )
        )
        db.commit()
        write_audit(db, org_id, member.user_id, "team.invited", "team", new_member.id, {"email": email, "role": payload.role})
        return {
            "message": f"{email} was added to your team",
            "invite_token": None,
            "member": _to_out(new_member),
        }

    # No account yet → pending invitation claimed at registration. Re-inviting
    # the same address refreshes the token/role instead of creating duplicates.
    pending = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.status == "pending",
            OrganizationMember.invite_email == email,
        )
        .first()
    )
    token = secrets.token_urlsafe(32)
    if pending is not None:
        pending.role = payload.role
        pending.invite_token = token
        new_member = pending
    else:
        new_member = OrganizationMember(
            organization_id=org_id,
            user_id=None,  # claimed when the invited email registers
            role=payload.role,
            status="pending",
            invite_token=token,
            invite_email=email,
        )
        db.add(new_member)

    db.commit()
    write_audit(db, org_id, member.user_id, "team.invited", "team", new_member.id, {"email": email, "role": payload.role})
    return {
        "message": f"Invitation created for {email}",
        "invite_token": token,
        "member": _to_out(new_member),
    }


@router.post("/{member_id}/resend", response_model=dict)
def resend_invite(
    member_id: int,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> dict:
    """Rotate the invite token of a pending invitation and return the new link token."""
    target = _get_target(db, member.organization_id, member_id)
    if target.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This member has already joined")
    target.invite_token = secrets.token_urlsafe(32)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "team.invite_resent", "team", target.id)
    return {"message": f"New invite link generated for {target.invite_email}", "invite_token": target.invite_token, "member": _to_out(target)}


@router.put("/{member_id}/role", response_model=MemberOut)
def change_role(
    member_id: int,
    payload: RoleUpdate,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> MemberOut:
    target = _get_target(db, member.organization_id, member_id)
    if target.id == member.id and payload.role != member.role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role")
    if target.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can change the owner's role")
    if payload.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can grant the owner role")
    if target.role == "admin" and payload.role != "admin" and member.role not in ("owner", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can change an admin's role")
    if target.role == "owner" and payload.role != "owner" and _owner_count(db, member.organization_id) <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An organization must keep at least one owner")

    previous = target.role
    if previous == payload.role:
        return _to_out(target)
    target.role = payload.role
    if target.user_id is not None:
        db.add(
            Notification(
                organization_id=member.organization_id,
                user_id=target.user_id,
                title="Your role was updated",
                message=f"You are now a {payload.role} at {member.organization.name}.",
                type="team",
            )
        )
    db.commit()
    db.refresh(target)
    write_audit(
        db, member.organization_id, member.user_id, "team.role_changed", "team", target.id,
        {"from": previous, "to": payload.role},
    )
    return _to_out(target)


@router.delete("/{member_id}", response_model=MessageOut)
def remove_member(
    member_id: int,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    target = _get_target(db, member.organization_id, member_id)
    if target.id == member.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove yourself")
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The owner cannot be removed")
    if target.role == "admin" and member.role not in ("owner", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can remove an admin")

    removed_email = target.user.email if target.user else target.invite_email
    db.delete(target)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "team.removed", "team", member_id, {"email": removed_email})
    return MessageOut(message="Member removed")
