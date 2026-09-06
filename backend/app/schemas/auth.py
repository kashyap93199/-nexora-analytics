from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt only hashes the first 72 bytes
    # The UI hides this field when accepting an invitation and may send "".
    organization_name: str | None = Field(default=None, max_length=120)
    invite_token: str | None = Field(default=None, max_length=120)

    @field_validator("organization_name", mode="before")
    @classmethod
    def blank_org_name_is_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("invite_token", mode="before")
    @classmethod
    def blank_token_is_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @model_validator(mode="after")
    def org_name_required_without_invite(self) -> "RegisterIn":
        if self.invite_token is None:
            if not self.organization_name:
                raise ValueError("organization_name is required when not accepting an invitation")
            if len(self.organization_name.strip()) < 2:
                raise ValueError("organization_name must be at least 2 characters")
        return self

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10)


class SwitchOrganizationIn(BaseModel):
    organization_id: int


class OrganizationOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    currency: str
    low_stock_threshold: int = 15

    model_config = {"from_attributes": True}


class WorkspaceOut(OrganizationOut):
    """An organization the user belongs to, with their role in it."""

    role: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: int
    user_id: int | None
    full_name: str
    email: str
    role: str
    status: str
    last_active_at: datetime | None
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
    organization: OrganizationOut
    role: str


class MessageOut(BaseModel):
    message: str
