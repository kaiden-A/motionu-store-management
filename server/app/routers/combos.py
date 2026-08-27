from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import UserPrincipal, get_current_user, require_admin
from app.models import Combo, ComboItem, Event, Product
from app.schemas.combos import ComboCreate, ComboItemOut, ComboOut, ComboUpdate
from app.services.transaction_service import product_remaining

router = APIRouter(tags=["combos"])


def _serialize(combo: Combo, products: dict[str, Product]) -> ComboOut:
    return ComboOut(
        id=combo.id,
        event_id=combo.event_id,
        name=combo.name,
        price=combo.price,
        handed_over=combo.handed_over,
        reserved=combo.reserved,
        items=[
            ComboItemOut(
                product_id=ci.product_id,
                qty=ci.qty,
                product_name=products[ci.product_id].name,
                price=products[ci.product_id].price,
                available=product_remaining(products[ci.product_id]),
            )
            for ci in combo.items
        ],
    )


def _event_products(db: Session, event_id: str) -> dict[str, Product]:
    rows = db.scalars(select(Product).where(Product.event_id == event_id)).all()
    return {p.id: p for p in rows}


def _get_combo(db: Session, combo_id: str) -> Combo:
    combo = db.scalars(
        select(Combo)
        .options(joinedload(Combo.items))
        .where(Combo.id == combo_id)
    ).unique().one_or_none()
    if not combo:
        raise HTTPException(status_code=404, detail="Combo not found")
    return combo


@router.get("/events/{event_id}/combos", response_model=list[ComboOut])
def list_combos(
    event_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(get_current_user),
):
    if not db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    combos = db.scalars(
        select(Combo)
        .options(joinedload(Combo.items))
        .where(Combo.event_id == event_id)
        .order_by(Combo.name)
    ).unique().all()
    products = _event_products(db, event_id)
    return [_serialize(c, products) for c in combos]


@router.post("/events/{event_id}/combos", response_model=ComboOut, status_code=201)
def create_combo(
    event_id: str,
    payload: ComboCreate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    if not db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    products = _event_products(db, event_id)
    for item in payload.items:
        if item.product_id not in products:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found in this event")

    combo = Combo(event_id=event_id, name=payload.name, price=payload.price)
    combo.items = [
        ComboItem(product_id=item.product_id, qty=item.qty) for item in payload.items
    ]
    db.add(combo)
    db.commit()
    db.refresh(combo)
    return _serialize(_get_combo(db, combo.id), products)


@router.patch("/combos/{combo_id}", response_model=ComboOut)
def update_combo(
    combo_id: str,
    payload: ComboUpdate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    combo = _get_combo(db, combo_id)
    products = _event_products(db, combo.event_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        combo.name = data["name"]
    if "price" in data:
        combo.price = data["price"]
    if "items" in data:
        for item in data["items"]:
            if item.product_id not in products:
                raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found in this event")
        combo.items = [
            ComboItem(product_id=item.product_id, qty=item.qty) for item in data["items"]
        ]
    db.commit()
    db.refresh(combo)
    return _serialize(_get_combo(db, combo.id), products)


@router.delete("/combos/{combo_id}", status_code=204)
def delete_combo(
    combo_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    combo = _get_combo(db, combo_id)
    db.delete(combo)
    db.commit()

