from fastapi import APIRouter, HTTPException, Depends
from supabase import create_client
from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from agents.review_agent import generate_review_response
from models.review import GenerateResponseRequest

router = APIRouter(prefix="/reviews", tags=["reviews"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


@router.get("/")
async def list_reviews(restaurant_id: str, status: str = "pending", user_id: str = Depends(get_current_user)):
    """Liste les avis d'un restaurant par statut."""
    await verify_restaurant_owner(user_id, restaurant_id)
    result = (
        supabase.table("reviews")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("status", status)
        .order("review_date", desc=True)
        .execute()
    )
    return result.data


@router.post("/{review_id}/generate-response")
async def generate_response(review_id: str, body: GenerateResponseRequest, user_id: str = Depends(get_current_user)):
    """Génère une réponse IA pour un avis donné."""

    # Récupérer l'avis
    review = supabase.table("reviews").select("*").eq("id", review_id).single().execute()
    if not review.data:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    # Récupérer le restaurant
    restaurant = (
        supabase.table("restaurants")
        .select("*")
        .eq("id", review.data["restaurant_id"])
        .single()
        .execute()
    )
    if not restaurant.data:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")

    r = restaurant.data
    v = review.data

    # Générer la réponse avec Claude
    generated_text = generate_review_response(
        review_content=v.get("content", ""),
        author_name=v.get("author_name", "le client"),
        rating=v.get("rating", 3),
        restaurant_name=r["name"],
        tone_profile=r.get("tone_profile", ""),
    )

    # Sauvegarder en base
    response = (
        supabase.table("review_responses")
        .insert({
            "review_id": review_id,
            "generated_text": generated_text,
            "status": "draft",
        })
        .execute()
    )

    return {
        "review_id": review_id,
        "generated_text": generated_text,
        "response_id": response.data[0]["id"],
    }


@router.patch("/{review_id}/response/{response_id}/approve")
async def approve_response(review_id: str, response_id: str, final_text: str = None, user_id: str = Depends(get_current_user)):
    """Approuve une réponse (avec ou sans modification)."""

    update_data = {"status": "approved"}
    if final_text:
        update_data["final_text"] = final_text

    supabase.table("review_responses").update(update_data).eq("id", response_id).execute()
    supabase.table("reviews").update({"status": "responded"}).eq("id", review_id).execute()

    return {"status": "approved", "response_id": response_id}
