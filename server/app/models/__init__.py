import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_by_sub: Mapped[str] = mapped_column(String(200), nullable=False)
    created_by_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    products: Mapped[list["Product"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", passive_deletes=True
    )
    combos: Mapped[list["Combo"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", passive_deletes=True
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", passive_deletes=True
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Other")
    price: Mapped[float] = mapped_column(nullable=False, default=0)
    stock: Mapped[int] = mapped_column(nullable=False, default=0)
    handed_over: Mapped[int] = mapped_column(nullable=False, default=0)
    reserved: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="products")
    combo_items: Mapped[list["ComboItem"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", passive_deletes=True
    )


class Combo(Base):
    __tablename__ = "combos"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[float] = mapped_column(nullable=False, default=0)
    handed_over: Mapped[int] = mapped_column(nullable=False, default=0)
    reserved: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="combos")
    items: Mapped[list["ComboItem"]] = relationship(
        back_populates="combo", cascade="all, delete-orphan", passive_deletes=True
    )


class ComboItem(Base):
    __tablename__ = "combo_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    combo_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("combos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    qty: Mapped[int] = mapped_column(nullable=False, default=1)

    combo: Mapped[Combo] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="combo_items")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seller_sub: Mapped[str] = mapped_column(String(200), nullable=False)
    seller_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    order_type: Mapped[str] = mapped_column(String(20), nullable=False, default="immediate")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    items = mapped_column(JSONB, nullable=False, default=list)
    total: Mapped[float] = mapped_column(nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(nullable=False, default=0)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="Cash")
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_contact: Mapped[str | None] = mapped_column(String(300), nullable=True)
    customer_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    expected_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_amount: Mapped[float | None] = mapped_column(nullable=True)
    refund_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    event: Mapped[Event] = relationship(back_populates="transactions")
