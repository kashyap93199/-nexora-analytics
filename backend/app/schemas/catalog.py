from datetime import datetime

from pydantic import BaseModel, Field


class CategoryOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    description: str
    price: float
    cost: float
    stock: int
    status: str
    category_id: int | None
    category_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    sku: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=2000)
    price: float = Field(ge=0)
    cost: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    status: str = Field(default="active", pattern="^(active|draft|archived)$")
    category_id: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    sku: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, pattern="^(active|draft|archived)$")
    category_id: int | None = None