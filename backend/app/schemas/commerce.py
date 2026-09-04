from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CustomerOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None
    city: str | None
    region: str | None
    country: str | None
    segment: str
    created_at: datetime
    last_order_at: datetime | None
    total_spent: float | None = None
    order_count: int | None = None

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=80)
    region: str | None = Field(default=None, max_length=80)
    country: str | None = Field(default=None, max_length=80)
    segment: str | None = Field(default=None, pattern="^(new|returning|vip|inactive)$")


class OrderItemOut(BaseModel):
    id: int
    product_id: int | None
    product_name: str
    quantity: int
    unit_price: float
    total: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    channel: str
    region: str | None
    subtotal: float
    discount: float
    tax: float
    shipping: float
    total: float
    placed_at: datetime
    customer_id: int | None
    customer_name: str | None = None
    customer_email: EmailStr | None = None
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}


class OrderCreateItem(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=999)


class OrderCreate(BaseModel):
    customer_id: int | None = None
    items: list[OrderCreateItem] = Field(min_length=1)
    channel: str = Field(default="online", pattern="^(online|in_store|wholesale|partner)$")
    region: str | None = Field(default=None, max_length=80)
    status: str = Field(default="pending", pattern="^(pending|processing|shipped|delivered|cancelled|refunded)$")
    discount: float = Field(default=0, ge=0)
    shipping: float = Field(default=0, ge=0)


class OrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|processing|shipped|delivered|cancelled|refunded)$")