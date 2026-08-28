from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.dependencies import UserPrincipal
from app.models import Combo, ComboItem, Event, Product, Transaction
from app.schemas.transactions import (
    PreOrderCancelIn,
    PreOrderFulfillIn,
    TransactionCreate,
)
from app.services.email_service import (
    send_fulfillment_thank_you,
    send_incoming_preorder_notification,
    send_preorder_confirmation,
    send_ready_for_pickup,
)
from app.services.settings_service import get_member_emails


def product_remaining(product: Product) -> int:
    return product.stock - product.handed_over - product.reserved


def _load_event(db: Session, event_id: str) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _load_transaction(db: Session, tx_id: str) -> Transaction:
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


def _lock_products(db: Session, product_ids: list[str]) -> dict[str, Product]:
    if not product_ids:
        return {}
    ids = sorted(set(product_ids))
    rows = db.scalars(
        select(Product).where(Product.id.in_(ids)).with_for_update()
    ).all()
    by_id = {p.id: p for p in rows}
    for pid in ids:
        if pid not in by_id:
            raise HTTPException(status_code=404, detail=f"Product {pid} not found")
    return by_id


def _load_combos(db: Session, combo_ids: list[str]) -> dict[str, Combo]:
    if not combo_ids:
        return {}
    ids = sorted(set(combo_ids))
    rows = db.scalars(
        select(Combo)
        .options(joinedload(Combo.items).joinedload(ComboItem.product))
        .where(Combo.id.in_(ids))
        .with_for_update()
    ).unique().all()
    by_id = {c.id: c for c in rows}
    for cid in ids:
        if cid not in by_id:
            raise HTTPException(status_code=404, detail=f"Combo {cid} not found")
    return by_id


def checkout(
    db: Session,
    event_id: str,
    user: UserPrincipal,
    payload: TransactionCreate,
) -> Transaction:
    event = _load_event(db, event_id)
    is_preorder = payload.order_type == "preorder"

    if is_preorder:
        if not payload.customer or not payload.customer.name.strip():
            raise HTTPException(status_code=400, detail="Customer name is required for pre-orders")

    product_ids = [l.ref_id for l in payload.lines if l.ref_type == "product"]
    combo_ids = [l.ref_id for l in payload.lines if l.ref_type == "combo"]
    combos = _load_combos(db, combo_ids)

    for combo in combos.values():
        if combo.event_id != event_id:
            raise HTTPException(status_code=400, detail=f"Combo {combo.name} does not belong to this event")
        for ci in combo.items:
            product_ids.append(ci.product_id)

    products = _lock_products(db, product_ids)

    # Stock validation (immediate sales respect the floor; pre-orders may backorder)
    for line in payload.lines:
        if line.ref_type == "product":
            product = products[line.ref_id]
            if not is_preorder and product_remaining(product) < line.qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough stock for {product.name} ({product_remaining(product)} left)",
                )
        else:
            combo = combos[line.ref_id]
            if not is_preorder:
                for ci in combo.items:
                    product = products[ci.product_id]
                    if product_remaining(product) < ci.qty * line.qty:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Not enough stock for combo {combo.name} ({product.name} short)",
                        )

    # Apply stock changes
    items = []
    total = 0.0
    for line in payload.lines:
        if line.ref_type == "product":
            product = products[line.ref_id]
            if is_preorder:
                product.reserved += line.qty
            else:
                product.handed_over += line.qty
            line_total = round(product.price * line.qty, 2)
            total += line_total
            items.append(
                {
                    "ref_type": "product",
                    "ref_id": product.id,
                    "name": product.name,
                    "unit_price": product.price,
                    "qty": line.qty,
                    "line_total": line_total,
                }
            )
        else:
            combo = combos[line.ref_id]
            if is_preorder:
                combo.reserved += line.qty
            else:
                combo.handed_over += line.qty
            for ci in combo.items:
                product = products[ci.product_id]
                if is_preorder:
                    product.reserved += ci.qty * line.qty
                else:
                    product.handed_over += ci.qty * line.qty
            line_total = round(combo.price * line.qty, 2)
            total += line_total
            items.append(
                {
                    "ref_type": "combo",
                    "ref_id": combo.id,
                    "name": combo.name,
                    "unit_price": combo.price,
                    "qty": line.qty,
                    "line_total": line_total,
                    "components": [{"product_id": ci.product_id, "qty": ci.qty} for ci in combo.items],
                }
            )

    total = round(total, 2)

    if is_preorder:
        amount_paid = total if payload.amount_paid is None else payload.amount_paid
        if amount_paid < 0 or amount_paid > total:
            raise HTTPException(status_code=400, detail="Amount paid must be between 0 and the total")
    else:
        amount_paid = total

    tx = Transaction(
        event_id=event_id,
        seller_sub=user.sub,
        seller_name=user.name,
        order_type=payload.order_type,
        status="preorder_pending" if is_preorder else "completed",
        items=items,
        total=total,
        amount_paid=amount_paid,
        payment_method=payload.payment_method,
        customer_name=payload.customer.name if payload.customer else None,
        customer_contact=payload.customer.contact if payload.customer else None,
        customer_email=payload.customer.email if payload.customer else None,
        customer_notes=payload.customer.notes if payload.customer else None,
        expected_date=payload.expected_date,
        pickup_time_start=payload.pickup_time_start,
        pickup_time_end=payload.pickup_time_end,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    if is_preorder:
        send_preorder_confirmation(tx, event)
        send_incoming_preorder_notification(tx, event, get_member_emails(db))
    return tx


def _restore_stock(
    products: dict[str, Product],
    combos: dict[str, Combo],
    items: list[dict],
    field: str,
) -> None:
    """field: 'handed_over' or 'reserved' — decrement both product and combo counters."""
    for item in items:
        if item["ref_type"] == "product":
            product = products.get(item["ref_id"])
            if product:
                setattr(product, field, getattr(product, field) - item["qty"])
        else:
            combo = combos.get(item["ref_id"])
            if combo:
                setattr(combo, field, getattr(combo, field) - item["qty"])
            for comp in item.get("components", []):
                product = products.get(comp["product_id"])
                if product:
                    setattr(product, field, getattr(product, field) - comp["qty"] * item["qty"])


def _load_restore_objects(db: Session, tx: Transaction):
    product_ids = []
    combo_ids = []
    for item in tx.items:
        if item["ref_type"] == "product":
            product_ids.append(item["ref_id"])
        else:
            combo_ids.append(item["ref_id"])
            product_ids.extend(c["product_id"] for c in item.get("components", []))
    products = _lock_products(db, product_ids)
    combos = _load_combos(db, combo_ids)
    return products, combos


def void_transaction(db: Session, tx_id: str, user: UserPrincipal) -> Transaction:
    tx = _load_transaction(db, tx_id)
    if tx.status not in ("completed", "fulfilled"):
        raise HTTPException(status_code=400, detail="Only completed or fulfilled transactions can be voided")
    products, combos = _load_restore_objects(db, tx)
    _restore_stock(products, combos, tx.items, "handed_over")
    tx.status = "voided"
    db.commit()
    db.refresh(tx)
    return tx


def fulfill_transaction(
    db: Session,
    tx_id: str,
    user: UserPrincipal,
    payload: PreOrderFulfillIn | None = None,
) -> Transaction:
    tx = _load_transaction(db, tx_id)
    if tx.status not in ("preorder_pending", "preorder_ready"):
        raise HTTPException(status_code=400, detail="Only pending pre-orders can be fulfilled")

    balance = round(tx.total - tx.amount_paid, 2)
    if balance > 0:
        if not payload or not payload.payment_method:
            raise HTTPException(
                status_code=400,
                detail="Collect the remaining balance and provide a payment method",
            )
        tx.amount_paid = tx.total

    products, combos = _load_restore_objects(db, tx)
    # Move reserved -> handed_over for every involved product and combo
    for item in tx.items:
        if item["ref_type"] == "product":
            product = products.get(item["ref_id"])
            if product:
                product.reserved -= item["qty"]
                product.handed_over += item["qty"]
        else:
            combo = combos.get(item["ref_id"])
            if combo:
                combo.reserved -= item["qty"]
                combo.handed_over += item["qty"]
            for comp in item.get("components", []):
                product = products.get(comp["product_id"])
                if product:
                    product.reserved -= comp["qty"] * item["qty"]
                    product.handed_over += comp["qty"] * item["qty"]

    tx.status = "fulfilled"
    tx.fulfilled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tx)
    send_fulfillment_thank_you(tx, _load_event(db, tx.event_id))
    return tx


def mark_ready(db: Session, tx_id: str, user: UserPrincipal) -> Transaction:
    tx = _load_transaction(db, tx_id)
    if tx.status != "preorder_pending":
        raise HTTPException(status_code=400, detail="Only pending pre-orders can be marked ready")
    tx.status = "preorder_ready"
    db.commit()
    db.refresh(tx)
    send_ready_for_pickup(tx, _load_event(db, tx.event_id))
    return tx


def cancel_transaction(
    db: Session,
    tx_id: str,
    user: UserPrincipal,
    payload: PreOrderCancelIn,
) -> Transaction:
    tx = _load_transaction(db, tx_id)
    if tx.status not in ("preorder_pending", "preorder_ready"):
        raise HTTPException(status_code=400, detail="Only pending pre-orders can be cancelled")

    products, combos = _load_restore_objects(db, tx)
    _restore_stock(products, combos, tx.items, "reserved")

    if payload.refund_type == "full":
        refund_amount = tx.amount_paid
    elif payload.refund_type == "forfeit_deposit":
        refund_amount = 0.0
    else:  # partial
        refund_amount = payload.refund_amount
        if refund_amount is None or refund_amount < 0 or refund_amount > tx.amount_paid:
            raise HTTPException(
                status_code=400,
                detail="Partial refund amount must be between 0 and the amount paid",
            )

    tx.status = "cancelled"
    tx.cancelled_at = datetime.now(timezone.utc)
    tx.refund_amount = refund_amount
    tx.refund_type = payload.refund_type
    db.commit()
    db.refresh(tx)
    return tx
