from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, require_admin
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    member_notification_emails: list[str] = []

    @field_validator("member_notification_emails")
    @classmethod
    def validate_emails(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            value = value.strip().lower()
            if not value:
                continue
            domain = value.rsplit("@", 1)
            if len(domain) != 2 or not domain[0] or "." not in domain[1]:
                raise ValueError(f"Invalid email address: {value}")
            cleaned.append(value)
        return cleaned


class SettingsOut(BaseModel):
    member_notification_emails: list[str] = []


@router.get("", response_model=SettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    return SettingsOut(
        member_notification_emails=settings_service.get_member_emails(db)
    )


@router.put("", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    settings_service.set_setting(
        db,
        settings_service.MEMBER_NOTIFICATION_EMAILS_KEY,
        payload.member_notification_emails,
    )
    return SettingsOut(
        member_notification_emails=settings_service.get_member_emails(db)
    )
