from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, require_admin
from app.schemas.products import ProductOut
from app.schemas.stats import StatsResponse
from app.schemas.transactions import TransactionOut
from app.services.stats_service import compute_stats, stock_table

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(
    scope: str = Query(default="event", pattern="^(event|all)$"),
    event_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    try:
        return compute_stats(db, scope, event_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/stock", response_model=list[ProductOut])
def get_stock_table(
    event_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return [ProductOut.model_validate(p) for p in stock_table(db, event_id)]


@router.get("/transactions", response_model=list[TransactionOut])
def get_all_transactions(
    scope: str = Query(default="all", pattern="^(event|all)$"),
    event_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    """Full history for CSV export, across scope."""
    from sqlalchemy import select

    from app.models import Event, Transaction

    if scope == "event":
        if not event_id:
            raise HTTPException(status_code=400, detail="event_id required for event scope")
        if not db.get(Event, event_id):
            raise HTTPException(status_code=404, detail="Event not found")
        txs = db.scalars(
            select(Transaction).where(Transaction.event_id == event_id).order_by(Transaction.timestamp.desc())
        ).all()
    else:
        txs = db.scalars(select(Transaction).order_by(Transaction.timestamp.desc())).all()
    return [TransactionOut.model_validate(t) for t in txs]


@router.get("/export")
def export_csv(
    scope: str = Query(default="all", pattern="^(event|all)$"),
    event_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    """Server-generated CSV download of transaction history."""
    import csv
    import io
    from sqlalchemy import select

    from app.models import Transaction

    if scope == "event" and not event_id:
        raise HTTPException(status_code=400, detail="event_id required for event scope")
    stmt = select(Transaction).order_by(Transaction.timestamp.desc())
    if scope == "event":
        stmt = stmt.where(Transaction.event_id == event_id)
    txs = db.scalars(stmt).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Event", "Timestamp", "Seller", "Order type", "Status", "Items", "Total",
         "Amount paid", "Payment method", "Customer", "Contact", "Expected date",
         "Fulfilled at", "Refund type", "Refund amount"]
    )
    for t in txs:
        event = db.get(Event, t.event_id)
        writer.writerow(
            [
                event.name if event else "",
                t.timestamp.isoformat(),
                t.seller_name,
                t.order_type,
                t.status,
                "; ".join(f"{i['qty']}x {i['name']}" for i in t.items),
                f"{t.total:.2f}",
                f"{t.amount_paid:.2f}",
                t.payment_method,
                t.customer_name or "",
                t.customer_contact or "",
                t.expected_date or "",
                t.fulfilled_at.isoformat() if t.fulfilled_at else "",
                t.refund_type or "",
                f"{t.refund_amount:.2f}" if t.refund_amount is not None else "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="pinpoint-transactions.csv"'},
    )
