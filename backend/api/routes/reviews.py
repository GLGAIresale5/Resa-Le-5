from fastapi import APIRouter, HTTPException
from supabase import create_client
from core.config import settings
from agents.review_agent import generate_review_response
from models.review import GenerateResponseRequest

router = APIRouter(prefix="/reviews", tags=["reviews"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


@router.get("/")
def list_reviews(restaurant_id: str, status: str = "pending"):
    """Liste les avis d'un restaurant par statut."""
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
def generate_response(review_id: str, body: GenerateResponseRequest):
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
def approve_response(review_id: str, response_id: str, final_text: str = None):
    """Approuve une réponse (avec ou sans modification)."""

    update_data = {"status": "approved"}
    if final_text:
        update_data["final_text"] = final_text

    supabase.table("review_responses").update(update_data).eq("id", response_id).execute()
    supabase.table("reviews").update({"status": "responded"}).eq("id", review_id).execute()

    return {"status": "approved", "response_id": response_id}
