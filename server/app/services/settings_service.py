from sqlalchemy.orm import Session

from app.models import Setting

MEMBER_NOTIFICATION_EMAILS_KEY = "member_notification_emails"


def get_setting(db: Session, key: str, default=None):
    row = db.get(Setting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


def get_member_emails(db: Session) -> list[str]:
    raw = get_setting(db, MEMBER_NOTIFICATION_EMAILS_KEY, [])
    if not isinstance(raw, list):
        return []
    return [e for e in raw if isinstance(e, str) and e.strip()]
