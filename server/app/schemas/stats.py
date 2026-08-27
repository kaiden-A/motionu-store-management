from datetime import datetime

from pydantic import BaseModel


class SummaryStats(BaseModel):
    revenue_collected: float
    order_value: float
    outstanding: float
    transactions: int
    items_sold: int
    avg_sale: float
    pending_preorders: int


class TopSeller(BaseModel):
    name: str
    revenue: float
    qty: int


class CumulativePoint(BaseModel):
    index: int
    timestamp: datetime
    cumulative: float


class StatsResponse(BaseModel):
    scope: str
    summary: SummaryStats
    top_sellers: list[TopSeller]
    cumulative: list[CumulativePoint]
