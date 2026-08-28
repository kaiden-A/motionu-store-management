from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import UserPrincipal
from app.models import Event, Product
from app.schemas.public_preorders import FormPreOrderIn
from app.schemas.transactions import CartLine, CustomerIn, TransactionCreate
from app.services.transaction_service import checkout

FORM_SELLER_SUB = "form:google"
FORM_SELLER_NAME = "Google Form"


def create_form_preorder(db: Session, payload: FormPreOrderIn):
    event = db.get(Event, payload.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != "active":
        raise HTTPException(status_code=400, detail="Event is not accepting pre-orders")

    products = db.scalars(
        select(Product).where(Product.event_id == event.id)
    ).all()
    by_name = {p.name.strip().lower(): p for p in products}

    lines = []
    total = 0.0
    for line in payload.lines:
        product = by_name.get(line.name.strip().lower())
        if not product:
            valid = ", ".join(sorted(p.name for p in products)) or "(no products yet)"
            raise HTTPException(
                status_code=400,
                detail=f"Unknown product '{line.name}'. Valid products: {valid}",
            )
        lines.append(CartLine(ref_type="product", ref_id=product.id, qty=line.qty))
        total += product.price * line.qty
    total = round(total, 2)

    tx_payload = TransactionCreate(
        lines=lines,
        payment_method=payload.payment_method,
        order_type="preorder",
        amount_paid=total,
        customer=CustomerIn(
            name=payload.customer.name,
            email=payload.customer.email,
            contact=payload.customer.contact,
            notes=payload.customer.notes,
        ),
        expected_date=event.preorder_default_date or event.date,
        pickup_time_start=event.preorder_default_time_start,
        pickup_time_end=event.preorder_default_time_end,
    )

    user = UserPrincipal(
        sub=FORM_SELLER_SUB,
        name=FORM_SELLER_NAME,
        email="",
        roles=["member"],
    )
    return checkout(db, event.id, user, tx_payload)
