from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, get_current_user, require_admin
from app.models import Combo, ComboItem, Event, Product
from app.schemas.products import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(tags=["products"])


def _serialize(product: Product) -> ProductOut:
    return ProductOut.model_validate(product)


@router.get("/events/{event_id}/products", response_model=list[ProductOut])
def list_products(
    event_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(get_current_user),
):
    if not db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    products = db.scalars(
        select(Product).where(Product.event_id == event_id).order_by(Product.name)
    ).all()
    return [_serialize(p) for p in products]


@router.post("/events/{event_id}/products", response_model=ProductOut, status_code=201)
def create_product(
    event_id: str,
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    if not db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    product = Product(
        event_id=event_id,
        name=payload.name,
        category=payload.category,
        price=payload.price,
        stock=payload.stock,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _serialize(product)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return _serialize(product)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.reserved > 0:
        raise HTTPException(
            status_code=400,
            detail="Product has reserved stock from open pre-orders — cancel those first",
        )
    used_in = db.scalars(
        select(Combo)
        .join(ComboItem)
        .where(ComboItem.product_id == product_id, Combo.event_id == product.event_id)
    ).all()
    if used_in:
        raise HTTPException(
            status_code=400,
            detail=f"Can't delete — used in combo \"{used_in[0].name}\". Remove it from combos first.",
        )
    db.delete(product)
    db.commit()
