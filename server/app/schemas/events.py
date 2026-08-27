from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventBase(BaseModel):
    name: str
    date: str | None = None
    location: str | None = None
    description: str | None = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: str | None = None
    date: str | None = None
    location: str | None = None
    description: str | None = None
    status: str | None = None


class EventOut(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    created_by_sub: str
    created_by_name: str
    created_at: datetime
    product_count: int = 0
