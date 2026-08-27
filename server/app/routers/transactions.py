from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, get_current_user, require_admin
from app.models import Transaction
from app.schemas.transactions import TransactionCreate, TransactionOut
from app.services.transaction_service import checkout, void_transaction

router = APIRouter(tags=["transactions"])


def _serialize(tx: Transaction) -> TransactionOut:
    return TransactionOut.model_validate(tx)


@router.post("/events/{event_id}/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(
    event_id: str,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(get_current_user),
):
    tx = checkout(db, event_id, user, payload)
    return _serialize(tx)


@router.get("/events/{event_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    event_id: str,
    limit: int | None = Query(default=None, ge=1, le=500),
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(get_current_user),
):
    """All roles get recent activity (limit). Admins may omit limit for full history."""
    if limit is None and not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin role required for full history")
    stmt = (
        select(Transaction)
        .where(Transaction.event_id == event_id)
        .order_by(Transaction.timestamp.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    txs = db.scalars(stmt).all()
    return [_serialize(t) for t in txs]


@router.post("/transactions/{tx_id}/void", response_model=TransactionOut)
def void_transaction_endpoint(
    tx_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return _serialize(void_transaction(db, tx_id, user))
