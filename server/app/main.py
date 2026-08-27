from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import combos, events, preorders, products, stats, transactions

settings = get_settings()

app = FastAPI(
    title="PinPoint API",
    description="Event sales tracker — events, products, combos, transactions, pre-orders, stats.",
    version="0.1.0",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(events.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(combos.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(preorders.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
