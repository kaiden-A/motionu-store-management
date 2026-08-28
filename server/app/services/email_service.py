import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import get_settings
from app.models import Event, Transaction

logger = logging.getLogger("app.email")

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"


def _money(value: float) -> str:
    return f"RM {value:,.2f}"


@lru_cache
def _env() -> Environment:
    environment = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    environment.filters["money"] = _money
    return environment


def _render(template_name: str, title: str, **context) -> str:
    return _env().get_template(template_name).render(title=title, **context)


def _fmt_date(value: str | None) -> str:
    if not value:
        return "to be confirmed"
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%A, %d %B %Y")
    except ValueError:
        return value


def _fmt_time(value: str | None) -> str:
    if not value:
        return ""
    try:
        return datetime.strptime(value, "%H:%M").strftime("%I:%M %p").lstrip("0")
    except ValueError:
        return value


def _pickup_window(tx: Transaction) -> str:
    start = _fmt_time(tx.pickup_time_start)
    end = _fmt_time(tx.pickup_time_end)
    if start and end:
        return f"between {start} and {end}"
    if start:
        return f"at {start}"
    return ""


def _order_context(tx: Transaction) -> dict:
    return {
        "items": tx.items,
        "total": tx.total,
        "amount_paid": tx.amount_paid,
        "balance": round(tx.total - tx.amount_paid, 2),
    }


def _send_email(to_email: str, subject: str, html_content: str) -> None:
    settings = get_settings()
    if not settings.email_api or not settings.api_key:
        logger.warning("Email API not configured; skipping email to %s", to_email)
        return
    payload = {
        "toEmail": to_email,
        "subject": subject,
        "fromEmail": settings.email_from,
        "htmlContent": html_content,
    }
    try:
        resp = httpx.post(
            f"{settings.email_api.rstrip('/')}/api/v1/emails/send-html",
            json=payload,
            headers={"motionu-api-key": settings.api_key},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Email sent to %s (%s)", to_email, subject)
    except Exception as exc:
        logger.warning("Failed to send email to %s (%s): %s", to_email, subject, exc)


def send_preorder_confirmation(tx: Transaction, event: Event) -> None:
    if not tx.customer_email:
        return
    try:
        subject = "We've received your pre-order — Motion-U"
        html = _render(
            "preorder_confirmation.html",
            subject,
            first_name=(tx.customer_name or "").strip().split(" ")[0] or "there",
            expected_date=_fmt_date(tx.expected_date),
            pickup_window=_pickup_window(tx),
            event_name=event.name or "Motion-U event",
            **_order_context(tx),
        )
        _send_email(tx.customer_email, subject, html)
    except Exception as exc:
        logger.warning("Failed to build preorder confirmation email for %s: %s", tx.id, exc)


def send_ready_for_pickup(tx: Transaction, event: Event) -> None:
    if not tx.customer_email:
        return
    try:
        subject = "Your Motion-U order is ready for pickup!"
        html = _render(
            "ready_for_pickup.html",
            subject,
            first_name=(tx.customer_name or "").strip().split(" ")[0] or "there",
            expected_date=_fmt_date(tx.expected_date),
            pickup_window=_pickup_window(tx),
            event_name=event.name or "Motion-U",
            location=(event.location or "our booth").strip(),
            **_order_context(tx),
        )
        _send_email(tx.customer_email, subject, html)
    except Exception as exc:
        logger.warning("Failed to build ready-for-pickup email for %s: %s", tx.id, exc)


def send_incoming_preorder_notification(
    tx: Transaction,
    event: Event,
    member_emails: list[str],
) -> None:
    if not member_emails:
        return
    try:
        subject = "New pre-order received — Motion-U"
        html = _render(
            "incoming_preorder_notification.html",
            subject,
            customer_name=tx.customer_name or "Unknown",
            customer_email=tx.customer_email or "",
            customer_contact=tx.customer_contact or "",
            event_name=event.name or "Motion-U",
            location=(event.location or "").strip(),
            expected_date=_fmt_date(tx.expected_date),
            pickup_window=_pickup_window(tx),
            **_order_context(tx),
        )
        for email in member_emails:
            _send_email(email, subject, html)
    except Exception as exc:
        logger.warning("Failed to build incoming pre-order notification for %s: %s", tx.id, exc)


def send_fulfillment_thank_you(tx: Transaction, event: Event) -> None:
    if not tx.customer_email:
        return
    try:
        subject = "Thank you for choosing Motion-U!"
        html = _render(
            "fulfillment_thank_you.html",
            subject,
            first_name=(tx.customer_name or "").strip().split(" ")[0] or "there",
            **_order_context(tx),
        )
        _send_email(tx.customer_email, subject, html)
    except Exception as exc:
        logger.warning("Failed to build fulfillment thank-you email for %s: %s", tx.id, exc)
