from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PaymentMethod = Literal["Cash", "Transfer", "E-Wallet", "Other"]
OrderType = Literal["immediate", "preorder"]
RefundType = Literal["full", "forfeit_deposit", "partial"]


class CartLine(BaseModel):
    ref_type: Literal["product", "combo"]
    ref_id: str
    qty: int = Field(ge=1)


class CustomerIn(BaseModel):
    name: str
    contact: str | None = None
    email: str | None = None
    notes: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        domain = cleaned.rsplit("@", 1)
        if len(domain) != 2 or not domain[0] or "." not in domain[1]:
            raise ValueError("Invalid email address")
        return cleaned.lower()


class TransactionCreate(BaseModel):
    lines: list[CartLine] = Field(min_length=1)
    payment_method: PaymentMethod = "Cash"
    order_type: OrderType = "immediate"
    amount_paid: float | None = None
    customer: CustomerIn | None = None
    expected_date: str | None = None
    pickup_time_start: str | None = None
    pickup_time_end: str | None = None

    @field_validator("pickup_time_start", "pickup_time_end")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        try:
            return datetime.strptime(value, "%H:%M").strftime("%H:%M")
        except ValueError:
            raise ValueError("Pickup time must be in HH:MM format")


class TransactionItemOut(BaseModel):
    ref_type: str
    ref_id: str
    name: str
    unit_price: float
    qty: int
    line_total: float


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    seller_sub: str
    seller_name: str
    timestamp: datetime
    order_type: OrderType
    status: str
    items: list[TransactionItemOut]
    total: float
    amount_paid: float
    payment_method: PaymentMethod
    customer_name: str | None = None
    customer_contact: str | None = None
    customer_email: str | None = None
    customer_notes: str | None = None
    expected_date: str | None = None
    pickup_time_start: str | None = None
    pickup_time_end: str | None = None
    fulfilled_at: datetime | None = None
    cancelled_at: datetime | None = None
    refund_amount: float | None = None
    refund_type: str | None = None

    @property
    def balance_due(self) -> float:
        return round(self.total - self.amount_paid, 2)


class PreOrderFulfillIn(BaseModel):
    payment_method: PaymentMethod | None = None


class PreOrderCancelIn(BaseModel):
    refund_type: RefundType = "full"
    refund_amount: float | None = None
