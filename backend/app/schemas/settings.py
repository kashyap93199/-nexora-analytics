from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class EmailUpdate(BaseModel):
    email: EmailStr


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    def __init__(self, **data) -> None:  # noqa: D105
        super().__init__(**data)
        if not any(c.isdigit() for c in self.new_password):
            raise ValueError("New password must contain at least one number")
        if not any(c.isupper() for c in self.new_password):
            raise ValueError("New password must contain at least one uppercase letter")


class OrgUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    currency: str = Field(min_length=3, max_length=8)


class InviteIn(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(admin|manager|analyst|viewer)$")


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(owner|admin|manager|analyst|viewer)$")