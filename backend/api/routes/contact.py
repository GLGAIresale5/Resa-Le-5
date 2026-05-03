"""
Endpoint public /contact — utilisé par :
- le formulaire de contact du site (mode='contact')
- le formulaire de privatisation (mode='privatisation')

Envoie un email vers settings.contact_email_to via Brevo.
Anti-spam : honeypot + rate limit en mémoire (suffisant pour un site vitrine).
"""

import html
import logging
import time
from collections import defaultdict, deque
from typing import Literal, Optional

import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from core.config import settings
from services.email import send_email_via_brevo

logger = logging.getLogger(__name__)

router = APIRouter()

# Rate limit : 3 messages / 10 min par IP
_ip_window: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=3))
_RATE_WINDOW_S = 600
_RATE_MAX = 3


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ContactRequest(BaseModel):
    mode: Literal["contact", "privatisation"]
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    message: str = Field(min_length=1, max_length=4000)
    # Privatisation only
    event_type: Optional[str] = Field(default=None, max_length=80)
    guest_count: Optional[int] = Field(default=None, ge=1, le=300)
    event_date: Optional[str] = Field(default=None, max_length=20)  # ISO yyyy-mm-dd
    # Honeypot
    website: Optional[str] = Field(default="", max_length=200)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v):
            raise ValueError("email invalide")
        return v


def _check_rate(ip: str) -> bool:
    now = time.time()
    history = _ip_window[ip]
    while history and now - history[0] > _RATE_WINDOW_S:
        history.popleft()
    if len(history) >= _RATE_MAX:
        return False
    history.append(now)
    return True


def _build_html(data: ContactRequest) -> tuple[str, str]:
    """Returns (subject, html_content)."""
    safe_name = html.escape(data.name)
    safe_email = html.escape(data.email)
    safe_phone = html.escape(data.phone or "—")
    safe_message = html.escape(data.message).replace("\n", "<br>")

    if data.mode == "privatisation":
        subject = f"[Le 5] Demande privatisation — {safe_name}"
        details = f"""
            <tr><td style="padding:6px 0;color:#888;">Type d'événement</td><td>{html.escape(data.event_type or '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Nombre de personnes</td><td>{data.guest_count or '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Date souhaitée</td><td>{html.escape(data.event_date or '—')}</td></tr>
        """
    else:
        subject = f"[Le 5] Message contact — {safe_name}"
        details = ""

    body = f"""
<!doctype html>
<html lang="fr"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f4ee;padding:24px;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d4;border-radius:10px;padding:28px">
  <h2 style="margin:0 0 4px;font-family:Georgia,serif;color:#111">Le 5 — {data.mode.capitalize()}</h2>
  <p style="margin:0 0 18px;color:#888;font-size:13px">Nouveau message via le site public.</p>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#888;width:40%">Nom</td><td>{safe_name}</td></tr>
    <tr><td style="padding:6px 0;color:#888">Email</td><td><a href="mailto:{safe_email}">{safe_email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#888">Téléphone</td><td>{safe_phone}</td></tr>
    {details}
  </table>
  <div style="margin-top:18px;padding-top:18px;border-top:1px solid #eee;font-size:14px;line-height:1.55">
    <p style="margin:0 0 6px;color:#888;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">Message</p>
    <p style="margin:0">{safe_message}</p>
  </div>
  <p style="margin-top:22px;font-size:12px;color:#aaa">Répondre directement à cet email pour contacter {safe_name}.</p>
</div>
</body></html>
"""
    return subject, body


@router.post("/contact")
async def submit_contact(payload: ContactRequest, request: Request):
    # Honeypot — bots remplissent souvent les champs cachés
    if payload.website:
        logger.info("Contact spam (honeypot triggered) name=%s", payload.name)
        return {"status": "ok"}  # silently drop

    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    if not _check_rate(client_ip):
        raise HTTPException(status_code=429, detail="Trop de messages envoyés, réessayez plus tard.")

    subject, html_body = _build_html(payload)

    sent = await send_email_via_brevo(
        to_email=settings.contact_email_to,
        to_name="Le 5",
        subject=subject,
        html_content=html_body,
        sender_email=settings.contact_email_from,
        sender_name="Le 5 — Site web",
        reply_to_email=payload.email,
        reply_to_name=payload.name,
    )

    if not sent:
        raise HTTPException(status_code=502, detail="L'envoi a échoué, réessayez ou appelez-nous au 09 83 94 46 00.")

    return {"status": "ok"}
