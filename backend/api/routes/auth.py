"""Auth routes — /auth/me and /auth/register-restaurant."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.auth import get_current_user, get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRestaurantRequest(BaseModel):
    name: str


@router.get("/me")
async def me(user_id: str = Depends(get_current_user)):
    """Return the current user's restaurant."""
    sb = get_supabase()
    result = sb.table("restaurants").select("id, name").eq("owner_id", user_id).execute()
    if not result.data:
        return {"user_id": user_id, "restaurant": None}
    return {"user_id": user_id, "restaurant": result.data[0]}


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

    result = sb.table("restaurants").insert({
        "owner_id": user_id,
        "name": body.name,
        "tone_profile": "Professionnel et chaleureux",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")

    return {"restaurant": result.data[0]}
