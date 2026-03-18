"""
Public booking endpoint — called by the /reserver page.

- Creates a reservation with status 'pending' and source 'web'
- Sends an email notification to the restaurant owner
- Auto-assigns a table (or leaves unassigned if full — still creates the reservation)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date

from core.config import settings
from supabase import create_client
from api.routes.reservations import _auto_assign_table

router = APIRouter()

RESTAURANT_ID = "60945098-cb17-4b47-8771-4b0110ec6d9d"


class PublicBookingRequest(BaseModel):
    guest_first_name: str
    guest_last_name: str = ""
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_count: int
    date: date
    time: str  # "HH:MM"
    notes: Optional[str] = None


class PublicBookingResponse(BaseModel):
    status: str  # "pending"
    message: str
    date: str
    time: str
    guest_count: int


def _send_notification_email(booking: PublicBookingRequest):
    """Send email notification to Baptiste via Resend."""
    if not settings.resend_api_key:
        return

    try:
        import resend

        resend.api_key = settings.resend_api_key

        full_name = f"{booking.guest_first_name} {booking.guest_last_name}".strip()
        date_str = booking.date.strftime("%A %d %B %Y")
        contact = booking.guest_phone or booking.guest_email or "Non renseigné"
        notes_html = f"<p><strong>Notes :</strong> {booking.notes}</p>" if booking.notes else ""

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1c1917; margin-bottom: 4px;">Nouvelle demande de réservation</h2>
            <p style="color: #78716c; margin-top: 0;">Via le site web — en attente de confirmation</p>
            <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #292524;">
                    <tr>
                        <td style="padding: 6px 0; color: #a8a29e;">Nom</td>
                        <td style="padding: 6px 0; font-weight: 600; text-align: right;">{full_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #a8a29e;">Couverts</td>
                        <td style="padding: 6px 0; font-weight: 600; text-align: right;">{booking.guest_count}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #a8a29e;">Date</td>
                        <td style="padding: 6px 0; font-weight: 600; text-align: right;">{date_str}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #a8a29e;">Heure</td>
                        <td style="padding: 6px 0; font-weight: 600; text-align: right;">{booking.time}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #a8a29e;">Contact</td>
                        <td style="padding: 6px 0; font-weight: 600; text-align: right;">{contact}</td>
                    </tr>
                </table>
                {notes_html}
            </div>
            <p style="color: #78716c; font-size: 13px;">
                Connectez-vous à votre dashboard GLG AI pour confirmer ou refuser cette réservation.
            </p>
        </div>
        """

        resend.Emails.send({
            "from": "Le 5 - Réservations <reservations@glg-ai.com>",
            "to": [settings.notification_email],
            "subject": f"Réservation web — {full_name} ({booking.guest_count} pers.) le {date_str} à {booking.time}",
            "html": html,
        })
    except Exception:
        # Don't fail the booking if email fails
        pass


@router.post("/public/book", response_model=PublicBookingResponse)
async def public_book(body: PublicBookingRequest):
    """Public endpoint for clients to request a reservation."""

    # Validate
    if not body.guest_first_name.strip():
        raise HTTPException(status_code=400, detail="Le prénom est obligatoire.")
    if not body.guest_phone and not body.guest_email:
        raise HTTPException(
            status_code=400,
            detail="Merci de renseigner un téléphone ou un email.",
        )
    if body.guest_count < 1 or body.guest_count > 30:
        raise HTTPException(status_code=400, detail="Nombre de convives invalide.")

    supabase = create_client(settings.supabase_url, settings.supabase_service_key)

    full_name = f"{body.guest_first_name.strip()} {body.guest_last_name.strip()}".strip()

    # Try to auto-assign a table (non-blocking — still accept if no table available)
    assigned_table_id = None
    try:
        assigned_table_id = _auto_assign_table(
            supabase,
            restaurant_id=RESTAURANT_ID,
            guest_count=body.guest_count,
            res_date=body.date.isoformat(),
            res_time=body.time,
            duration=120,
        )
    except Exception:
        pass

    data = {
        "restaurant_id": RESTAURANT_ID,
        "table_id": assigned_table_id,
        "guest_name": full_name,
        "guest_phone": body.guest_phone,
        "guest_email": body.guest_email,
        "guest_count": body.guest_count,
        "date": body.date.isoformat(),
        "time": body.time,
        "duration": 120,
        "source": "web",
        "status": "pending",
        "notes": body.notes,
    }

    response = supabase.table("reservations").insert(data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création de la réservation.")

    # Send notification email (async, non-blocking)
    _send_notification_email(body)

    return PublicBookingResponse(
        status="pending",
        message="Votre demande de réservation a été enregistrée. Nous vous confirmerons dans les plus brefs délais.",
        date=body.date.isoformat(),
        time=body.time,
        guest_count=body.guest_count,
    )
