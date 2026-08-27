from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import UserPrincipal, get_current_user, require_admin
from app.models import Event
from app.schemas.events import EventCreate, EventOut, EventUpdate

router = APIRouter(prefix="/events", tags=["events"])


def _serialize(event: Event) -> EventOut:
    return EventOut.model_validate(event).model_copy(
        update={"product_count": len(event.products)}
    )


@router.get("", response_model=list[EventOut])
def list_events(
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(get_current_user),
):
    events = db.scalars(select(Event).order_by(Event.created_at.desc())).all()
    return [_serialize(e) for e in events]


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    event = Event(
        name=payload.name,
        date=payload.date,
        location=payload.location,
        description=payload.description,
        created_by_sub=user.sub,
        created_by_name=user.name,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _serialize(event)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("active", "ended"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'ended'")
    for key, value in data.items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return _serialize(event)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: UserPrincipal = Depends(require_admin),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
