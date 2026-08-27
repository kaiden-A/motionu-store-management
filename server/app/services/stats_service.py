from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Product, Transaction
from app.schemas.stats import CumulativePoint, StatsResponse, SummaryStats, TopSeller

EXCLUDED_STATUSES = ("cancelled", "voided")


def _base_scope_query(db: Session, event_id: str | None):
    stmt = select(Transaction)
    if event_id:
        stmt = stmt.where(Transaction.event_id == event_id)
    return stmt


def _load_transactions(db: Session, event_id: str | None, include_all: bool = False) -> list[Transaction]:
    stmt = _base_scope_query(db, event_id)
    if not include_all:
        stmt = stmt.where(Transaction.status.notin_(EXCLUDED_STATUSES))
    return list(db.scalars(stmt).all())


def compute_stats(db: Session, scope: str, event_id: str | None) -> StatsResponse:
    if scope == "event" and not event_id:
        raise ValueError("event_id required for event scope")

    txs = _load_transactions(db, event_id if scope == "event" else None)
    pending_stmt = select(func.count()).select_from(Transaction).where(
        Transaction.status.in_(("preorder_pending", "preorder_ready"))
    )
    if scope == "event":
        pending_stmt = pending_stmt.where(Transaction.event_id == event_id)
    pending = db.scalar(pending_stmt)

    revenue_collected = round(sum(t.amount_paid for t in txs), 2)
    order_value = round(sum(t.total for t in txs), 2)
    items_sold = sum(item["qty"] for t in txs for item in t.items)

    seller_map: dict[str, dict] = {}
    for t in txs:
        for item in t.items:
            entry = seller_map.setdefault(
                item["name"], {"revenue": 0.0, "qty": 0}
            )
            entry["revenue"] += item["line_total"]
            entry["qty"] += item["qty"]

    top_sellers = [
        TopSeller(name=name, revenue=round(d["revenue"], 2), qty=d["qty"])
        for name, d in sorted(seller_map.items(), key=lambda kv: kv[1]["revenue"], reverse=True)[:8]
    ]

    ordered = sorted(txs, key=lambda t: t.timestamp)
    cumulative = []
    running = 0.0
    for idx, t in enumerate(ordered, start=1):
        running += t.amount_paid
        cumulative.append(
            CumulativePoint(index=idx, timestamp=t.timestamp, cumulative=round(running, 2))
        )

    return StatsResponse(
        scope=scope,
        summary=SummaryStats(
            revenue_collected=revenue_collected,
            order_value=order_value,
            outstanding=round(order_value - revenue_collected, 2),
            transactions=len(txs),
            items_sold=items_sold,
            avg_sale=round(revenue_collected / len(txs), 2) if txs else 0,
            pending_preorders=pending or 0,
        ),
        top_sellers=top_sellers,
        cumulative=cumulative,
    )


def stock_table(db: Session, event_id: str) -> list[Product]:
    return list(db.scalars(select(Product).where(Product.event_id == event_id).order_by(Product.name)).all())
