from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, require_admin
from app.models import Event, Transaction
from app.schemas.transactions import (
    PreOrderCancelIn,
    PreOrderFulfillIn,
    TransactionOut,
)
from app.services.transaction_service import (
    cancel_transaction,
    fulfill_transaction,
    mark_ready,
)

router = APIRouter(prefix="/preorders", tags=["preorders"])


def _serialize(tx: Transaction) -> TransactionOut:
    return TransactionOut.model_validate(tx)


@router.get("", response_model=list[TransactionOut])
def list_preorders(
    event_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    stmt = (
        select(Transaction)
        .where(Transaction.status.in_(("preorder_pending", "preorder_ready")))
        .order_by(Transaction.expected_date.is_(None), Transaction.expected_date, Transaction.timestamp)
    )
    if event_id:
        if not db.get(Event, event_id):
            raise HTTPException(status_code=404, detail="Event not found")
        stmt = stmt.where(Transaction.event_id == event_id)
    txs = db.scalars(stmt).all()
    return [_serialize(t) for t in txs]


@router.post("/transactions/{tx_id}/fulfill", response_model=TransactionOut)
def fulfill(
    tx_id: str,
    payload: PreOrderFulfillIn | None = None,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return _serialize(fulfill_transaction(db, tx_id, user, payload))


@router.post("/transactions/{tx_id}/ready", response_model=TransactionOut)
def ready(
    tx_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return _serialize(mark_ready(db, tx_id, user))


@router.post("/transactions/{tx_id}/cancel", response_model=TransactionOut)
def cancel(
    tx_id: str,
    payload: PreOrderCancelIn,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return _serialize(cancel_transaction(db, tx_id, user, payload))
