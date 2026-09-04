from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization_name: str | None = Field(default=None, min_length=2, max_length=120)
    invite_token: str | None = None

    @model_validator(mode="after")
    def org_name_required_without_invite(self) -> "RegisterIn":
        if self.invite_token is None and not self.organization_name:
            raise ValueError("organization_name is required when not accepting an invitation")
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


class OrganizationOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    currency: str

    model_config = {"from_attributes": True}


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