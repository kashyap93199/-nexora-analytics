from pydantic import BaseModel, EmailStr, Field, field_validator


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class EmailUpdate(BaseModel):
    email: EmailStr


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=72)  # bcrypt limit

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("New password must contain at least one number")
        if not any(c.isupper() for c in v):
            raise ValueError("New password must contain at least one uppercase letter")
        return v


class OrgUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    currency: str = Field(min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")  # ISO-4217 code
    low_stock_threshold: int | None = Field(None, ge=0, le=100_000)


class InviteIn(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(admin|manager|analyst|viewer)$")


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(owner|admin|manager|analyst|viewer)$")