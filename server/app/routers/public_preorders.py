import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas.public_preorders import FormPreOrderIn
from app.schemas.transactions import TransactionOut
from app.services.form_preorder_service import create_form_preorder

router = APIRouter(prefix="/public/preorders", tags=["public"])


def _check_form_key(motionu_api_key: str | None) -> None:
    settings = get_settings()
    if not settings.form_api_key:
        raise HTTPException(status_code=503, detail="Form integration is not configured")
    if not motionu_api_key or not hmac.compare_digest(motionu_api_key, settings.form_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("", response_model=TransactionOut, status_code=201)
def create_form_preorder_endpoint(
    payload: FormPreOrderIn,
    motionu_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _check_form_key(motionu_api_key)
    tx = create_form_preorder(db, payload)
    return TransactionOut.model_validate(tx)
