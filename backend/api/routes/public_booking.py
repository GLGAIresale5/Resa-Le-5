"""
Public booking endpoint — called by the /reserver/[slug] page.

- Looks up the restaurant by slug (or restaurant_id for backwards compat)
- Creates a reservation with status 'pending' and source 'web'
- Sends a push notification to the restaurant owner
- Auto-assigns a table (or leaves unassigned if full — still creates the reservation)
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date

from core.config import settings
from supabase import create_client
from api.routes.reservations import _auto_assign_table
from api.routes.push import send_push_to_restaurant

router = APIRouter()

# Fallback for backwards compat (ancienne URL /reserver sans slug)
DEFAULT_RESTAURANT_ID = "60945098-cb17-4b47-8771-4b0110ec6d9d"


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


def _get_restaurant_by_slug_or_id(supabase, slug: Optional[str], restaurant_id: Optional[str]) -> dict:
    """Lookup restaurant by slug or ID. Raises 404 if not found."""
    fields = "id, name, slug, service_hours"
    if slug:
        result = supabase.table("restaurants").select(fields).eq("slug", slug).limit(1).execute()
    elif restaurant_id:
        result = supabase.table("restaurants").select(fields).eq("id", restaurant_id).limit(1).execute()
    else:
        # Fallback: Le 5
        result = supabase.table("restaurants").select(fields).eq("id", DEFAULT_RESTAURANT_ID).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")
    return result.data[0]


def _time_to_minutes(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _validate_time_within_service_hours(time_str: str, restaurant: dict):
    """Raise 400 if the requested time falls outside all configured service windows."""
    service_hours = restaurant.get("service_hours")
    if not service_hours or not isinstance(service_hours, dict):
        return  # No service hours configured — allow any time
    services = service_hours.get("services", [])
    if not services:
        return
    req_min = _time_to_minutes(time_str)
    for svc in services:
        start = _time_to_minutes(svc.get("start", "00:00"))
        end = _time_to_minutes(svc.get("end", "23:59"))
        if start <= req_min < end:
            return  # Within this service window
    svc_names = ", ".join(f"{s['name']} ({s['start']}–{s['end']})" for s in services)
    raise HTTPException(
        status_code=400,
        detail=f"L'horaire {time_str} est en dehors des services disponibles : {svc_names}",
    )


@router.post("/public/book", response_model=PublicBookingResponse)
async def public_book(
    body: PublicBookingRequest,
    slug: Optional[str] = Query(None),
    restaurant_id: Optional[str] = Query(None),
):
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

    # Lookup restaurant
    restaurant = _get_restaurant_by_slug_or_id(supabase, slug, restaurant_id)
    rest_id = restaurant["id"]

    # Validate time is within service hours
    _validate_time_within_service_hours(body.time, restaurant)

    full_name = f"{body.guest_first_name.strip()} {body.guest_last_name.strip()}".strip()

    # Try to auto-assign a table (non-blocking — still accept if no table available)
    assigned_table_id = None
    try:
        assigned_table_id = _auto_assign_table(
            supabase,
            restaurant_id=rest_id,
            guest_count=body.guest_count,
            res_date=body.date.isoformat(),
            res_time=body.time,
            duration=120,
        )
    except Exception:
        pass

    data = {
        "restaurant_id": rest_id,
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
    full_name_display = f"{body.guest_first_name} {body.guest_last_name}".strip()
    date_str = body.date.strftime("%d/%m/%Y")
    send_push_to_restaurant(
        restaurant_id=rest_id,
        title=f"Nouvelle réservation — {full_name_display}",
        body=f"{body.guest_count} pers. le {date_str} à {body.time}. À confirmer.",
        url="/reservations",
    )

    return PublicBookingResponse(
        status="pending",
        message="Votre demande de réservation a été enregistrée. Nous vous confirmerons dans les plus brefs délais.",
        date=body.date.isoformat(),
        time=body.time,
        guest_count=body.guest_count,
    )


@router.get("/public/restaurant")
async def get_public_restaurant_info(
    slug: Optional[str] = Query(None),
    restaurant_id: Optional[str] = Query(None),
):
    """Public endpoint to get restaurant info for the reservation page (name, service hours)."""
    supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    restaurant = _get_restaurant_by_slug_or_id(supabase, slug, restaurant_id)
    rest_id = restaurant["id"]

    # Fetch full restaurant info (only public-safe fields)
    full = supabase.table("restaurants").select("id, name, slug, service_hours").eq("id", rest_id).single().execute()
    if not full.data:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")

    return full.data
