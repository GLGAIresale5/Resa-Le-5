from fastapi import APIRouter, HTTPException, Query
from supabase import create_client
from core.config import settings
from agents.social_agent import generate_post
from models.post import GeneratePostRequest, ApprovePostRequest
from datetime import datetime, timedelta, timezone
from typing import List

router = APIRouter(prefix="/posts", tags=["posts"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


@router.get("/")
def list_posts(restaurant_id: str, status: str = "draft"):
    """Liste les posts d'un restaurant par statut."""
    result = (
        supabase.table("posts")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("status", status)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/generate")
def generate(body: GeneratePostRequest):
    """Génère des captions réseaux sociaux pour un post."""

    # Récupérer le restaurant
    restaurant = (
        supabase.table("restaurants")
        .select("*")
        .eq("id", body.restaurant_id)
        .execute()
    )
    if not restaurant.data:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")

    r = restaurant.data[0]

    # Générer les captions avec Claude
    captions = generate_post(
        context=body.context,
        restaurant_name=r["name"],
        tone_profile=r.get("tone_profile", ""),
        platforms=body.platforms,
        photo_base64=body.photo_base64,
        photo_media_type=body.photo_media_type or "image/jpeg",
    )

    # Construire le texte généré (Instagram en priorité, Facebook en complément)
    generated_text = captions.get("instagram", "") or captions.get("facebook", "")

    # Sauvegarder en base
    post = (
        supabase.table("posts")
        .insert({
            "restaurant_id": body.restaurant_id,
            "context": body.context,
            "generated_text": generated_text,
            "platforms": body.platforms,
            "status": "draft",
            "captions": captions,
        })
        .execute()
    )

    return {
        "post_id": post.data[0]["id"],
        "captions": captions,
        "generated_text": generated_text,
    }


@router.patch("/{post_id}/approve")
def approve_post(post_id: str, body: ApprovePostRequest):
    """Approuve un post (avec ou sans modification du texte final)."""
    update_data = {"status": "approved"}
    if body.final_text:
        update_data["final_text"] = body.final_text

    result = supabase.table("posts").update(update_data).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post introuvable")

    return {"status": "approved", "post_id": post_id}


DAY_NAMES_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]


@router.get("/alerts")
def publish_alerts(
    restaurant_id: str,
    publish_days: str = Query(..., description="Jours de publication (0=dim..6=sam), séparés par des virgules"),
):
    """
    Vérifie si un jour de publication approche (dans les 48h) sans post approuvé ou programmé.
    """
    days = [int(d.strip()) for d in publish_days.split(",") if d.strip().isdigit()]
    if not days:
        return []

    now = datetime.now(timezone.utc)
    alerts = []

    for offset in range(3):  # aujourd'hui + 2 jours suivants
        check_date = now + timedelta(days=offset)
        weekday_js = check_date.weekday()  # Python: 0=lundi
        # Convertir en convention JS: 0=dimanche
        js_day = (weekday_js + 1) % 7

        if js_day not in days:
            continue

        date_str = check_date.strftime("%Y-%m-%d")

        # Chercher un post approuvé ou programmé pour cette date
        posts = (
            supabase.table("posts")
            .select("id, status, scheduled_at")
            .eq("restaurant_id", restaurant_id)
            .in_("status", ["approved", "published"])
            .execute()
        )

        has_post_for_day = False
        for p in posts.data or []:
            scheduled = p.get("scheduled_at")
            if scheduled and scheduled.startswith(date_str):
                has_post_for_day = True
                break

        if not has_post_for_day:
            hours_until = (check_date.replace(hour=17, minute=0, second=0) - now).total_seconds() / 3600
            alerts.append({
                "day_name": DAY_NAMES_FR[js_day],
                "date": date_str,
                "hours_until": round(max(0, hours_until), 1),
            })

    return alerts
