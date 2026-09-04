from datetime import datetime

from pydantic import BaseModel, Field


class GoalOut(BaseModel):
    id: int
    name: str
    type: str
    target: float
    period: str
    starts_at: datetime
    ends_at: datetime
    status: str
    progress: float | None = None  # current value
    progress_pct: float | None = None  # 0-100
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    type: str = Field(pattern="^(revenue|orders|customers|profit)$")
    target: float = Field(gt=0)
    period: str = Field(default="monthly", pattern="^(monthly|quarterly|yearly)$")
    starts_at: datetime
    ends_at: datetime


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    target: float | None = Field(default=None, gt=0)
    period: str | None = Field(default=None, pattern="^(monthly|quarterly|yearly)$")
    status: str | None = Field(default=None, pattern="^(active|completed|archived)$")
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportOut(BaseModel):
    id: int
    name: str
    type: str
    filters: dict
    status: str
    created_at: datetime
    created_by_name: str | None = None

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    type: str = Field(pattern="^(sales|revenue|customer|product|performance)$")
    start_date: datetime
    end_date: datetime
    filters: dict = Field(default_factory=dict)