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


@router.get("", response_model=list[MemberOut])
def list_members(
    member: OrganizationMember = Depends(require_permission(P_TEAM_VIEW)),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    members = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == member.organization_id)
        .order_by(OrganizationMember.created_at.asc())
        .all()
    )
    return [_to_out(m) for m in members]


@router.post("/invite", response_model=dict, status_code=status.HTTP_201_CREATED)
def invite_member(
    payload: InviteIn,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> dict:
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        existing_member = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == member.organization_id,
                OrganizationMember.user_id == existing_user.id,
            )
            .first()
        )
        if existing_member and existing_member.status == "active":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already a member")
        if existing_member and existing_member.status == "pending":
            existing_member.role = payload.role
            existing_member.status = "active"
            existing_member.invite_token = None
            db.commit()
            return {
                "message": f"Invitation sent to {payload.email}",
                "invite_token": None,
                "member": _to_out(existing_member),
            }

    token = secrets.token_urlsafe(32)
    if existing_user:
        new_member = OrganizationMember(
            organization_id=member.organization_id,
            user_id=existing_user.id,
            role=payload.role,
            status="active",
        )
        db.add(new_member)
        db.flush()
        db.add(
            Notification(
                organization_id=member.organization_id,
                user_id=existing_user.id,
                title="You were added to a team",
                message=f"You are now a {payload.role} at {member.organization.name}.",
                type="team",
            )
        )
    else:
        new_member = OrganizationMember(
            organization_id=member.organization_id,
            user_id=None,  # claimed when the invited email registers
            role=payload.role,
            status="pending",
            invite_token=token,
            invite_email=payload.email.lower(),
        )
        db.add(new_member)

    db.commit()
    write_audit(db, member.organization_id, member.user_id, "team.invited", "team", new_member.id)
    return {
        "message": f"Invitation sent to {payload.email}",
        "invite_token": token if existing_user is None else None,
        "member": _to_out(new_member),
    }


@router.put("/{member_id}/role", response_model=MemberOut)
def change_role(
    member_id: int,
    payload: RoleUpdate,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> MemberOut:
    target = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.id == member_id, OrganizationMember.organization_id == member.organization_id)
        .first()
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.id == member.id and payload.role != "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot demote yourself")
    if target.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can change the owner's role")
    if payload.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner can grant the owner role")

    target.role = payload.role
    db.commit()
    db.refresh(target)
    write_audit(
        db, member.organization_id, member.user_id, "team.role_changed", "team", target.id,
        {"role": payload.role},
    )
    return _to_out(target)


@router.delete("/{member_id}", response_model=MessageOut)
def remove_member(
    member_id: int,
    member: OrganizationMember = Depends(require_permission(P_TEAM_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    target = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.id == member_id, OrganizationMember.organization_id == member.organization_id)
        .first()
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.id == member.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove yourself")
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The owner cannot be removed")
    db.delete(target)
    db.commit()
    write_audit(db, member.organization_id, member.user_id, "team.removed", "team", member_id)
    return MessageOut(message="Member removed")