"""
Push notification routes — subscribe/unsubscribe + send notifications.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from supabase import create_client

router = APIRouter()


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


class PushSubscription(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


@router.get("/vapid-public-key")
async def get_vapid_public_key(user_id: str = Depends(get_current_user)):
    """Return the VAPID public key for frontend subscription."""
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe")
async def subscribe(body: PushSubscription, restaurant_id: UUID = Query(...), user_id: str = Depends(get_current_user)):
    """Register a push subscription for notifications."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    # Upsert — if endpoint already exists, update keys
    data = {
        "restaurant_id": str(restaurant_id),
        "endpoint": body.endpoint,
        "p256dh": body.p256dh,
        "auth": body.auth,
        "user_agent": body.user_agent,
    }

    # Delete existing subscription with same endpoint, then insert
    supabase.table("push_subscriptions").delete().eq("endpoint", body.endpoint).execute()
    response = supabase.table("push_subscriptions").insert(data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement")

    return {"status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe(body: dict, user_id: str = Depends(get_current_user)):
    """Remove a push subscription."""
    supabase = get_supabase()
    endpoint = body.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Endpoint requis")

    supabase.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
    return {"status": "unsubscribed"}


def send_push_to_restaurant(restaurant_id: str, title: str, body: str, url: str = "/reservations"):
    """Send a push notification to all subscribed devices for a restaurant."""
    import json

    if not settings.vapid_private_key or not settings.vapid_public_key:
        print("[PUSH] Pas de clés VAPID configurées")
        return

    supabase = get_supabase()
    subs_resp = (
        supabase.table("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )

    if not subs_resp.data:
        print("[PUSH] Aucun abonnement trouvé pour ce restaurant")
        return

    from pywebpush import webpush, WebPushException

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
    })

    for sub in subs_resp.data:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"],
            },
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_claims_email}"},
            )
            print(f"[PUSH] Notification envoyée")
        except WebPushException as e:
            print(f"[PUSH] Erreur: {e}")
            # If subscription is expired/invalid, remove it
            if "410" in str(e) or "404" in str(e):
                supabase.table("push_subscriptions").delete().eq("endpoint", sub["endpoint"]).execute()
                print(f"[PUSH] Abonnement expiré supprimé")
        except Exception as e:
            print(f"[PUSH] Erreur inattendue: {e}")
