from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class EventBase(BaseModel):
    name: str
    date: str | None = None
    location: str | None = None
    description: str | None = None
    preorder_default_date: str | None = None
    preorder_default_time_start: str | None = None
    preorder_default_time_end: str | None = None

    @field_validator("preorder_default_time_start", "preorder_default_time_end")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        try:
            return datetime.strptime(value, "%H:%M").strftime("%H:%M")
        except ValueError:
            raise ValueError("Time must be in HH:MM format")


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: str | None = None
    date: str | None = None
    location: str | None = None
    description: str | None = None
    status: str | None = None
    preorder_default_date: str | None = None
    preorder_default_time_start: str | None = None
    preorder_default_time_end: str | None = None

    @field_validator("preorder_default_time_start", "preorder_default_time_end")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        try:
            return datetime.strptime(value, "%H:%M").strftime("%H:%M")
        except ValueError:
            raise ValueError("Time must be in HH:MM format")


class EventOut(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    created_by_sub: str
    created_by_name: str
    created_at: datetime
    product_count: int = 0
