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
from api.routes.push import send_push_to_restaurant

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


def _send_admin_push_notification(booking: PublicBookingRequest):
    """Send push notification to the restaurant admin when a new booking arrives."""
    full_name = f"{booking.guest_first_name} {booking.guest_last_name}".strip()
    date_str = booking.date.strftime("%d/%m/%Y")

    send_push_to_restaurant(
        restaurant_id=RESTAURANT_ID,
        title=f"Nouvelle réservation — {full_name}",
        body=f"{booking.guest_count} pers. le {date_str} à {booking.time}. À confirmer.",
        url="/reservations",
    )


@router.post("/public/book", response_model=PublicBookingResponse)
async def public_book(body: PublicBookingRequest):
    """Public endpoint for clients to request a reservation."""

    # Validate
    if not body.guest_first_name.strip():
        raise HTTPException(status_code=400, detail="Le prénom est obligatoire.")
    if not body.guest_phone:
        raise HTTPException(
            status_code=400,
            detail="Le numéro de téléphone est obligatoire pour réserver.",
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

    # Send push notification to admin
    _send_admin_push_notification(body)

    return PublicBookingResponse(
        status="pending",
        message="Votre demande de réservation a été enregistrée. Nous vous confirmerons dans les plus brefs délais.",
        date=body.date.isoformat(),
        time=body.time,
        guest_count=body.guest_count,
    )
