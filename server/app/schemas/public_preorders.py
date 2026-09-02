from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.transactions import CustomerIn, PaymentMethod


class FormCustomer(CustomerIn):
    email: str


class FormPreOrderLine(BaseModel):
    name: str = Field(min_length=1)
    qty: int = Field(ge=1)
    type: Literal["product", "combo"] = "product"


class FormPreOrderIn(BaseModel):
    event_id: str
    customer: FormCustomer
    lines: list[FormPreOrderLine] = Field(min_length=1)
    payment_method: PaymentMethod = "Other"
