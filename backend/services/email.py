"""Email transactionnel via Brevo (Sendinblue) — réutilise la BREVO_API_KEY déjà en place pour les SMS."""

import logging
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email_via_brevo(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
    sender_email: str,
    sender_name: str = "Le 5 — Site web",
    reply_to_email: Optional[str] = None,
    reply_to_name: Optional[str] = None,
) -> bool:
    """Envoie un email via Brevo. Retourne True si succès, False sinon."""
    if not settings.brevo_api_key:
        logger.warning("BREVO_API_KEY manquante — email non envoyé")
        return False

    payload: dict = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content,
    }

    if reply_to_email:
        payload["replyTo"] = {"email": reply_to_email, "name": reply_to_name or reply_to_email}

    headers = {
        "accept": "application/json",
        "api-key": settings.brevo_api_key,
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(BREVO_EMAIL_URL, json=payload, headers=headers)
            if r.status_code in (200, 201):
                return True
            logger.error("Brevo email error %s: %s", r.status_code, r.text)
            return False
    except Exception as e:
        logger.exception("Brevo email exception: %s", e)
        return False
