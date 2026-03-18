from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from core.config import settings
import httpx
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/meta", tags=["meta"])

supabase = create_client(settings.supabase_url, settings.supabase_service_key)

META_GRAPH_BASE = "https://graph.facebook.com/v19.0"


class PublishPostRequest(BaseModel):
    photo_url: Optional[str] = None          # surcharge la photo_url du post si fournie
    scheduled_at: Optional[datetime] = None  # si fourni, programme au lieu de publier immédiatement


def _check_meta_configured():
    if not settings.meta_page_access_token:
        raise HTTPException(
            status_code=503,
            detail="Meta Graph API non configurée — ajoutez META_PAGE_ACCESS_TOKEN, META_INSTAGRAM_ACCOUNT_ID et META_FACEBOOK_PAGE_ID dans .env",
        )


def _to_unix(dt: datetime) -> int:
    """Convertit un datetime en timestamp Unix (requis par Meta pour la programmation)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


@router.post("/publish/{post_id}")
def publish_to_meta(post_id: str, body: PublishPostRequest = None):
    """
    Publie ou programme un post approuvé sur Instagram et/ou Facebook.

    - Sans scheduled_at : publication immédiate
    - Avec scheduled_at : programmation à la date/heure fournie (min 10 min dans le futur, max 30 jours)
    - Instagram : requiert une photo (photo_url dans le post ou dans la requête)
    - Facebook : supporte texte seul + texte avec photo
    """
    _check_meta_configured()

    if body is None:
        body = PublishPostRequest()

    # ── Récupérer le post ────────────────────────────────────────────────────
    post = supabase.table("posts").select("*").eq("id", post_id).single().execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post introuvable")

    p = post.data
    if p["status"] == "published":
        raise HTTPException(status_code=400, detail="Ce post est déjà publié")

    captions = p.get("captions") or {}
    final_text = p.get("final_text")
    generated_text = p.get("generated_text", "")
    photo_url = body.photo_url or p.get("photo_url")
    platforms = p.get("platforms") or ["instagram", "facebook"]
    scheduled_at = body.scheduled_at

    instagram_text = final_text or captions.get("instagram") or generated_text
    facebook_text = final_text or captions.get("facebook") or generated_text

    is_scheduled = scheduled_at is not None
    scheduled_unix = _to_unix(scheduled_at) if is_scheduled else None

    results = {}

    # ── Instagram ────────────────────────────────────────────────────────────
    if "instagram" in platforms and settings.meta_instagram_account_id:
        if photo_url:
            params = {
                "image_url": photo_url,
                "caption": instagram_text,
                "access_token": settings.meta_page_access_token,
            }
            if is_scheduled:
                # Pour Instagram, on passe scheduled_publish_time + published=false au container
                params["scheduled_publish_time"] = scheduled_unix
                params["published"] = "false"

            container_resp = httpx.post(
                f"{META_GRAPH_BASE}/{settings.meta_instagram_account_id}/media",
                params=params,
                timeout=20,
            )

            if container_resp.status_code == 200:
                container_id = container_resp.json().get("id")

                if is_scheduled:
                    # Programmé : pas d'appel media_publish, Instagram publiera automatiquement
                    results["instagram"] = {
                        "status": "scheduled",
                        "container_id": container_id,
                        "scheduled_at": scheduled_at.isoformat(),
                    }
                else:
                    # Immédiat : publier maintenant
                    publish_resp = httpx.post(
                        f"{META_GRAPH_BASE}/{settings.meta_instagram_account_id}/media_publish",
                        params={
                            "creation_id": container_id,
                            "access_token": settings.meta_page_access_token,
                        },
                        timeout=20,
                    )
                    if publish_resp.status_code == 200:
                        results["instagram"] = {"status": "published", "id": publish_resp.json().get("id")}
                    else:
                        results["instagram"] = {"status": "error", "detail": publish_resp.text}
            else:
                results["instagram"] = {"status": "error", "detail": container_resp.text}
        else:
            results["instagram"] = {
                "status": "skipped",
                "reason": "Instagram requiert une photo — ajoutez photo_url dans la requête ou dans le post",
            }

    # ── Facebook ─────────────────────────────────────────────────────────────
    if "facebook" in platforms and settings.meta_facebook_page_id:
        if photo_url:
            # Post avec photo
            fb_params = {
                "url": photo_url,
                "caption": facebook_text,
                "access_token": settings.meta_page_access_token,
            }
            if is_scheduled:
                fb_params["scheduled_publish_time"] = scheduled_unix
                fb_params["published"] = "false"

            fb_resp = httpx.post(
                f"{META_GRAPH_BASE}/{settings.meta_facebook_page_id}/photos",
                params=fb_params,
                timeout=20,
            )
        else:
            # Post texte seul
            fb_params = {
                "message": facebook_text,
                "access_token": settings.meta_page_access_token,
            }
            if is_scheduled:
                fb_params["scheduled_publish_time"] = scheduled_unix
                fb_params["published"] = "false"

            fb_resp = httpx.post(
                f"{META_GRAPH_BASE}/{settings.meta_facebook_page_id}/feed",
                params=fb_params,
                timeout=20,
            )

        if fb_resp.status_code == 200:
            fb_id = fb_resp.json().get("id") or fb_resp.json().get("post_id")
            results["facebook"] = {
                "status": "scheduled" if is_scheduled else "published",
                "id": fb_id,
                **({"scheduled_at": scheduled_at.isoformat()} if is_scheduled else {}),
            }
        else:
            results["facebook"] = {"status": "error", "detail": fb_resp.text}

    # ── Mettre à jour Supabase ────────────────────────────────────────────────
    any_success = any(r.get("status") in ("published", "scheduled") for r in results.values())
    if any_success:
        update_data: dict = {}
        if is_scheduled:
            update_data["status"] = "approved"          # reste "approved" jusqu'à publication effective
            update_data["scheduled_at"] = scheduled_at.isoformat()
        else:
            update_data["status"] = "published"
            update_data["published_at"] = datetime.now(timezone.utc).isoformat()

        if photo_url and not p.get("photo_url"):
            update_data["photo_url"] = photo_url

        supabase.table("posts").update(update_data).eq("id", post_id).execute()

    return {
        "post_id": post_id,
        "mode": "scheduled" if is_scheduled else "immediate",
        **({"scheduled_at": scheduled_at.isoformat()} if is_scheduled else {}),
        "results": results,
    }
