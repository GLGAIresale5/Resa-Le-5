"""Auth routes — /auth/me and /auth/register-restaurant."""

import re
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from core.auth import get_current_user, get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])

# Service hours par défaut (service continu 12h-22h)
DEFAULT_SERVICE_HOURS = json.dumps({
    "services": [
        {"name": "Déjeuner", "start": "12:00", "end": "14:30"},
        {"name": "Dîner", "start": "19:00", "end": "22:30"},
    ],
    "slot_interval_minutes": 15,
})


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a restaurant name."""
    slug = name.lower().strip()
    # Remplacer les caractères accentués
    replacements = {
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "à": "a", "â": "a", "ä": "a",
        "ù": "u", "û": "u", "ü": "u",
        "î": "i", "ï": "i",
        "ô": "o", "ö": "o",
        "ç": "c", "'": "-", "'": "-",
    }
    for k, v in replacements.items():
        slug = slug.replace(k, v)
    # Garder uniquement lettres, chiffres, tirets
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


class RegisterRestaurantRequest(BaseModel):
    name: str


class UpdateToneProfileRequest(BaseModel):
    tone_profile: str


@router.get("/me")
async def me(user_id: str = Depends(get_current_user), slug: Optional[str] = Query(None)):
    """Return the current user's restaurant, filtered by slug if provided."""
    sb = get_supabase()
    query = sb.table("restaurants").select("id, name, slug, service_hours, modules, tone_profile").eq("owner_id", user_id)
    if slug:
        query = query.eq("slug", slug)
    result = query.execute()
    if not result.data:
        return {"user_id": user_id, "restaurant": None}
    return {"user_id": user_id, "restaurant": result.data[0]}


@router.get("/my-restaurants")
async def my_restaurants(user_id: str = Depends(get_current_user)):
    """Return all restaurants owned by the current user."""
    sb = get_supabase()
    result = sb.table("restaurants").select("id, name, slug, modules").eq("owner_id", user_id).execute()
    return {"user_id": user_id, "restaurants": result.data or []}


@router.post("/register-restaurant")
async def register_restaurant(
    body: RegisterRestaurantRequest,
    user_id: str = Depends(get_current_user),
):
    """Create a restaurant for the authenticated user."""
    sb = get_supabase()

    # Check if user already has a restaurant
    existing = sb.table("restaurants").select("id").eq("owner_id", user_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Vous avez déjà un restaurant")

    slug = _generate_slug(body.name)

    # Vérifier unicité du slug, ajouter un suffixe si besoin
    slug_check = sb.table("restaurants").select("id").eq("slug", slug).execute()
    if slug_check.data:
        # Ajouter un suffixe numérique
        for i in range(2, 100):
            candidate = f"{slug}-{i}"
            check = sb.table("restaurants").select("id").eq("slug", candidate).execute()
            if not check.data:
                slug = candidate
                break

    result = sb.table("restaurants").insert({
        "owner_id": user_id,
        "name": body.name,
        "slug": slug,
        "tone_profile": "Professionnel et chaleureux",
        "service_hours": json.loads(DEFAULT_SERVICE_HOURS),
        "brevo_sms_enabled": True,
        "brevo_sms_sender_name": body.name[:11],  # Brevo limite à 11 caractères
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")

    return {"restaurant": result.data[0]}


@router.patch("/tone-profile")
async def update_tone_profile(
    body: UpdateToneProfileRequest,
    restaurant_id: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """Update the editorial tone profile for a restaurant."""
    sb = get_supabase()
    # Verify ownership
    check = sb.table("restaurants").select("id").eq("id", restaurant_id).eq("owner_id", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    sb.table("restaurants").update({"tone_profile": body.tone_profile}).eq("id", restaurant_id).execute()
    return {"status": "ok"}
