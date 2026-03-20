"""OAuth routes — Google Business Profile & Meta/Instagram connection flows.

Les endpoints /connect acceptent le JWT via query param ?token= (car les liens
<a href> ne peuvent pas envoyer de header Authorization).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import RedirectResponse
from core.config import settings
from core.auth import get_current_user, get_restaurant_for_user, get_supabase
import httpx
from typing import Optional

router = APIRouter(prefix="/oauth", tags=["oauth"])


async def _get_user_from_token_param(token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from JWT passed as query param or Authorization header.

    Needed because OAuth connect endpoints are called via <a href> links
    which cannot send Authorization headers.
    """
    # Prefer query param (from <a href>), fallback to header
    if token:
        authorization = f"Bearer {token}"
    if not authorization:
        raise HTTPException(status_code=401, detail="Token manquant — passez ?token= ou Authorization header")
    return await get_current_user(authorization=authorization)

# ─── Frontend URLs ─────────────────────────────────────────────────────────────
FRONTEND_URL = "https://resa-le-5.vercel.app"
LOCAL_FRONTEND = "http://localhost:3000"

# ═══════════════════════════════════════════════════════════════════════════════
# GOOGLE BUSINESS PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

GOOGLE_SCOPES = "https://www.googleapis.com/auth/business.manage"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GBP_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
GBP_LOCATIONS_URL = "https://mybusinessbusinessinformation.googleapis.com/v1"


@router.get("/google/connect")
async def google_connect(user_id: str = Depends(_get_user_from_token_param)):
    """Redirect user to Google OAuth consent screen."""
    restaurant = await get_restaurant_for_user(user_id)

    # Use restaurant_id as state to identify which restaurant to link
    state = restaurant["id"]

    # Determine callback URL based on environment
    if settings.environment == "production":
        redirect_uri = f"https://glg-ai-api.onrender.com/oauth/google/callback"
    else:
        redirect_uri = "http://localhost:8000/oauth/google/callback"

    auth_url = (
        f"{GOOGLE_AUTH_URL}"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={GOOGLE_SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Google OAuth callback — exchange code for tokens and store them."""
    restaurant_id = state

    # Determine callback URL (must match what was used in /connect)
    if settings.environment == "production":
        redirect_uri = "https://glg-ai-api.onrender.com/oauth/google/callback"
        frontend_redirect = FRONTEND_URL
    else:
        redirect_uri = "http://localhost:8000/oauth/google/callback"
        frontend_redirect = LOCAL_FRONTEND

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_redirect}/parametres?google=error&detail=token_exchange_failed")

    tokens = token_resp.json()
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")

    if not refresh_token:
        return RedirectResponse(url=f"{frontend_redirect}/parametres?google=error&detail=no_refresh_token")

    # Try to auto-detect the Google Business location
    google_location_name = ""
    try:
        async with httpx.AsyncClient() as client:
            # Get accounts
            accounts_resp = await client.get(
                GBP_ACCOUNTS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            if accounts_resp.status_code == 200:
                accounts = accounts_resp.json().get("accounts", [])
                if accounts:
                    account_name = accounts[0]["name"]  # e.g. "accounts/123456789"
                    # Get locations for first account
                    locations_resp = await client.get(
                        f"{GBP_LOCATIONS_URL}/{account_name}/locations",
                        headers={"Authorization": f"Bearer {access_token}"},
                        timeout=10,
                    )
                    if locations_resp.status_code == 200:
                        locations = locations_resp.json().get("locations", [])
                        if locations:
                            google_location_name = locations[0]["name"]  # e.g. "locations/987654321"
                            # Full path: accounts/123/locations/456
                            google_location_name = f"{account_name}/{google_location_name}"
    except Exception:
        pass  # Non-bloquant — on stocke quand même le refresh_token

    # Store in database
    sb = get_supabase()
    update_data = {"google_refresh_token": refresh_token}
    if google_location_name:
        update_data["google_location_name"] = google_location_name

    sb.table("restaurants").update(update_data).eq("id", restaurant_id).execute()

    return RedirectResponse(url=f"{frontend_redirect}/parametres?google=success")


# ═══════════════════════════════════════════════════════════════════════════════
# META / INSTAGRAM
# ═══════════════════════════════════════════════════════════════════════════════

META_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
META_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
META_GRAPH_BASE = "https://graph.facebook.com/v19.0"

META_SCOPES = "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish"


@router.get("/meta/connect")
async def meta_connect(user_id: str = Depends(_get_user_from_token_param)):
    """Redirect user to Meta OAuth consent screen."""
    restaurant = await get_restaurant_for_user(user_id)
    state = restaurant["id"]

    if settings.environment == "production":
        redirect_uri = "https://glg-ai-api.onrender.com/oauth/meta/callback"
    else:
        redirect_uri = "http://localhost:8000/oauth/meta/callback"

    auth_url = (
        f"{META_AUTH_URL}"
        f"?client_id={settings.meta_app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={META_SCOPES}"
        f"&state={state}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/meta/callback")
async def meta_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Meta OAuth callback — exchange code, get long-lived token, find pages/IG."""
    restaurant_id = state

    if settings.environment == "production":
        redirect_uri = "https://glg-ai-api.onrender.com/oauth/meta/callback"
        frontend_redirect = FRONTEND_URL
    else:
        redirect_uri = "http://localhost:8000/oauth/meta/callback"
        frontend_redirect = LOCAL_FRONTEND

    # Step 1: Exchange code for short-lived user token
    async with httpx.AsyncClient() as client:
        token_resp = await client.get(
            META_TOKEN_URL,
            params={
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
            timeout=15,
        )

    if token_resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_redirect}/parametres?meta=error&detail=token_exchange_failed")

    short_lived_token = token_resp.json().get("access_token")

    # Step 2: Exchange for long-lived user token
    async with httpx.AsyncClient() as client:
        ll_resp = await client.get(
            META_TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "fb_exchange_token": short_lived_token,
            },
            timeout=15,
        )

    if ll_resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_redirect}/parametres?meta=error&detail=long_lived_token_failed")

    long_lived_user_token = ll_resp.json().get("access_token")

    # Step 3: Get user's pages
    meta_page_id = ""
    meta_page_access_token = ""
    meta_instagram_id = ""

    async with httpx.AsyncClient() as client:
        pages_resp = await client.get(
            f"{META_GRAPH_BASE}/me/accounts",
            params={"access_token": long_lived_user_token},
            timeout=15,
        )

    if pages_resp.status_code == 200:
        pages = pages_resp.json().get("data", [])
        if pages:
            page = pages[0]  # Use first page
            meta_page_id = page["id"]
            meta_page_access_token = page["access_token"]

            # Step 4: Get Instagram Business Account linked to the page
            async with httpx.AsyncClient() as client:
                ig_resp = await client.get(
                    f"{META_GRAPH_BASE}/{meta_page_id}",
                    params={
                        "fields": "instagram_business_account",
                        "access_token": meta_page_access_token,
                    },
                    timeout=15,
                )

            if ig_resp.status_code == 200:
                ig_data = ig_resp.json().get("instagram_business_account", {})
                meta_instagram_id = ig_data.get("id", "")

    if not meta_page_access_token:
        return RedirectResponse(url=f"{frontend_redirect}/parametres?meta=error&detail=no_page_found")

    # Step 5: Store tokens in database
    sb = get_supabase()
    sb.table("restaurants").update({
        "meta_page_access_token": meta_page_access_token,
        "meta_page_id": meta_page_id,
        "meta_instagram_id": meta_instagram_id,
        "meta_instagram_account_id": meta_instagram_id,
    }).eq("id", restaurant_id).execute()

    return RedirectResponse(url=f"{frontend_redirect}/parametres?meta=success")


# ═══════════════════════════════════════════════════════════════════════════════
# STATUS — Check what's connected
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def oauth_status(user_id: str = Depends(get_current_user)):
    """Return which services are connected for the user's restaurant."""
    restaurant = await get_restaurant_for_user(user_id)

    return {
        "google": {
            "connected": bool(restaurant.get("google_refresh_token")),
            "location": restaurant.get("google_location_name") or None,
        },
        "meta": {
            "connected": bool(restaurant.get("meta_page_access_token")),
            "page_id": restaurant.get("meta_page_id") or None,
            "instagram_id": restaurant.get("meta_instagram_id") or None,
        },
        "sms": {
            "enabled": restaurant.get("brevo_sms_enabled", True),
            "sender_name": restaurant.get("brevo_sms_sender_name") or None,
            "phone": restaurant.get("brevo_sms_number") or None,
        },
    }
