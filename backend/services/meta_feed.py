"""Fetch and cache recent Instagram posts for editorial context."""

from datetime import datetime, timezone
import httpx
from core.auth import get_supabase

META_GRAPH_BASE = "https://graph.facebook.com/v19.0"
CACHE_TTL_HOURS = 24


async def fetch_recent_captions(restaurant: dict) -> list[str]:
    """Fetch recent Instagram captions for a restaurant.

    Uses a 24h cache stored on the restaurant row to avoid hitting Meta rate limits.
    Returns a list of caption strings (most recent first), or empty list on failure.
    """
    ig_id = restaurant.get("meta_instagram_id") or restaurant.get("meta_instagram_account_id")
    token = restaurant.get("meta_page_access_token")

    if not ig_id or not token:
        return []

    # Check cache
    cache = restaurant.get("meta_feed_cache")
    fetched_at = restaurant.get("meta_feed_fetched_at")
    if cache and fetched_at:
        try:
            if isinstance(fetched_at, str):
                fetched_at = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - fetched_at).total_seconds() / 3600
            if age_hours < CACHE_TTL_HOURS:
                return cache if isinstance(cache, list) else []
        except (ValueError, TypeError):
            pass

    # Fetch from Meta Graph API
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{META_GRAPH_BASE}/{ig_id}/media",
                params={
                    "fields": "caption,timestamp",
                    "limit": 25,
                    "access_token": token,
                },
            )

        if resp.status_code != 200:
            return _extract_cached(cache)

        posts = resp.json().get("data", [])
        captions = [p["caption"] for p in posts if p.get("caption")]

        # Update cache
        sb = get_supabase()
        sb.table("restaurants").update({
            "meta_feed_cache": captions,
            "meta_feed_fetched_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", restaurant["id"]).execute()

        return captions

    except Exception:
        return _extract_cached(cache)


def _extract_cached(cache) -> list[str]:
    """Safely extract cached captions."""
    if isinstance(cache, list):
        return cache
    return []
