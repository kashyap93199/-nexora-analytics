"""Goal endpoints with progress computed from live data."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.auth.permissions import P_GOALS_MANAGE, P_GOALS_VIEW
from app.database.db import get_db
from app.models import Goal, OrganizationMember
from app.schemas.common import MessageOut
from app.schemas.engagement import GoalCreate, GoalOut, GoalUpdate
from app.services import analytics
from app.utils.audit import write_audit

router = APIRouter(prefix="/goals", tags=["goals"])


def _with_progress(db: Session, org_id: int, goal: Goal) -> GoalOut:
    out = GoalOut.model_validate(goal)
    progress = analytics.goal_progress(db, org_id, goal)
    out.progress = progress["current"]
    out.progress_pct = progress["progress_pct"]
    return out


@router.get("", response_model=list[GoalOut])
def list_goals(
    member: OrganizationMember = Depends(require_permission(P_GOALS_VIEW)),
    db: Session = Depends(get_db),
) -> list[GoalOut]:
    goals = (
        db.query(Goal)
        .filter(Goal.organization_id == member.organization_id)
        .order_by(Goal.ends_at.asc())
        .all()
    )
    return [_with_progress(db, member.organization_id, g) for g in goals]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    member: OrganizationMember = Depends(require_permission(P_GOALS_MANAGE)),
    db: Session = Depends(get_db),
) -> GoalOut:
    if payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ends_at must be after starts_at")
    goal = Goal(organization_id=member.organization_id, created_by=member.user_id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    write_audit(db, member.organization_id, member.user_id, "goal.created", "goal", goal.id)
    return _with_progress(db, member.organization_id, goal)


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    member: OrganizationMember = Depends(require_permission(P_GOALS_MANAGE)),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.organization_id == member.organization_id).first()
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    if goal.ends_at <= goal.starts_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ends_at must be after starts_at")
    db.commit()
    db.refresh(goal)
    write_audit(db, member.organization_id, member.user_id, "goal.updated", "goal", goal.id)
    return _with_progress(db, member.organization_id, goal)


@router.delete("/{goal_id}", response_model=MessageOut)
def delete_goal(
    goal_id: int,
    member: OrganizationMember = Depends(require_permission(P_GOALS_MANAGE)),
    db: Session = Depends(get_db),
) -> MessageOut:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.organization_id == member.organization_id).first()
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    db.delete(goal)
    db.commit()
    return MessageOut(message="Goal deleted")