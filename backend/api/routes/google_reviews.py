from fastapi import APIRouter, HTTPException, Depends
from supabase import create_client
from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
import httpx
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest

router = APIRouter(prefix="/google", tags=["google"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)

SCOPES = ["https://www.googleapis.com/auth/business.manage"]
GBP_BASE = "https://mybusiness.googleapis.com/v4"

STAR_RATING_MAP = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def _get_access_token() -> str:
    """Obtient un access token Google frais depuis le refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=settings.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    creds.refresh(GoogleRequest())
    return creds.token


def _check_google_configured():
    if not settings.google_refresh_token or not settings.google_location_name:
        raise HTTPException(
            status_code=503,
            detail="Google Business Profile API non configurée — ajoutez GOOGLE_REFRESH_TOKEN et GOOGLE_LOCATION_NAME dans .env",
        )


@router.post("/reviews/sync")
async def sync_google_reviews(user_id: str = Depends(get_current_user)):
    """Récupère les avis Google Business Profile et les sauvegarde dans Supabase."""
    _check_google_configured()

    token = _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    url = f"{GBP_BASE}/{settings.google_location_name}/reviews"
    resp = httpx.get(url, headers=headers, timeout=15)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f"Google API: {resp.text}")

    reviews = resp.json().get("reviews", [])

    # Récupérer l'ID du restaurant (Le 5 = seul restaurant en V1)
    restaurant = supabase.table("restaurants").select("id").limit(1).execute()
    if not restaurant.data:
        raise HTTPException(status_code=404, detail="Aucun restaurant configuré en base")
    restaurant_id = restaurant.data[0]["id"]

    new_count = 0
    for review in reviews:
        google_review_id = review.get("reviewId")
        if not google_review_id:
            continue

        # Eviter les doublons (UNIQUE(source, external_id) en base)
        existing = (
            supabase.table("reviews")
            .select("id")
            .eq("source", "google")
            .eq("external_id", google_review_id)
            .execute()
        )
        if existing.data:
            continue

        reviewer = review.get("reviewer", {})
        rating = STAR_RATING_MAP.get(review.get("starRating", "THREE"), 3)

        supabase.table("reviews").insert({
            "restaurant_id": restaurant_id,
            "source": "google",
            "external_id": google_review_id,
            "author_name": reviewer.get("displayName", "Anonyme"),
            "rating": rating,
            "content": review.get("comment", ""),
            "review_date": review.get("createTime"),
            "status": "pending",
        }).execute()
        new_count += 1

    return {"synced": new_count, "total_from_google": len(reviews)}


@router.post("/reviews/{review_id}/publish-response")
async def publish_google_response(review_id: str, user_id: str = Depends(get_current_user)):
    """Publie la réponse approuvée sur Google Business Profile."""
    _check_google_configured()

    # Récupérer l'avis
    review = supabase.table("reviews").select("*").eq("id", review_id).single().execute()
    if not review.data:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    if review.data.get("source") != "google":
        raise HTTPException(status_code=400, detail="Cet avis n'est pas un avis Google")

    google_review_id = review.data.get("external_id")
    if not google_review_id:
        raise HTTPException(status_code=400, detail="Identifiant Google manquant pour cet avis")

    # Récupérer la réponse approuvée la plus récente
    response = (
        supabase.table("review_responses")
        .select("*")
        .eq("review_id", review_id)
        .eq("status", "approved")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Aucune réponse approuvée — approuvez d'abord la réponse générée")

    response_text = response.data[0].get("final_text") or response.data[0].get("generated_text")
    response_id = response.data[0]["id"]

    # Publier sur Google
    token = _get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{GBP_BASE}/{settings.google_location_name}/reviews/{google_review_id}/reply"

    resp = httpx.put(url, headers=headers, json={"comment": response_text}, timeout=15)

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=f"Google API: {resp.text}")

    # Mettre à jour les statuts
    supabase.table("review_responses").update({"status": "published"}).eq("id", response_id).execute()
    supabase.table("reviews").update({"status": "responded"}).eq("id", review_id).execute()

    return {"status": "published", "review_id": review_id, "response_id": response_id}
