"""Authentication middleware for Supabase JWT tokens."""

from typing import Optional
import httpx
import jwt
from fastapi import Depends, HTTPException, Header
from supabase import create_client
from core.config import settings

# Cache the JWKS keys
_jwks_cache: Optional[dict] = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


def _key_from_jwk(key_data: dict):
    """Convert a JWK to a public key, supporting both RSA and EC."""
    kty = key_data.get("kty", "")
    if kty == "RSA":
        return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
    elif kty == "EC":
        return jwt.algorithms.ECAlgorithm.from_jwk(key_data)
    elif kty == "OKP":
        return jwt.algorithms.OKPAlgorithm.from_jwk(key_data)
    return None


async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract and verify user_id from Supabase JWT.

    Returns the user UUID string.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")

    token = authorization[7:]

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "ES256")
        kid = header.get("kid")

        # Get JWKS and find the matching key
        jwks = await _get_jwks()
        public_keys = {}
        for key_data in jwks.get("keys", []):
            k = key_data.get("kid")
            if k:
                key = _key_from_jwk(key_data)
                if key:
                    public_keys[k] = key

        if kid not in public_keys:
            # Reset cache and retry
            global _jwks_cache
            _jwks_cache = None
            jwks = await _get_jwks()
            for key_data in jwks.get("keys", []):
                k = key_data.get("kid")
                if k:
                    key = _key_from_jwk(key_data)
                    if key:
                        public_keys[k] = key

        if kid not in public_keys:
            raise HTTPException(status_code=401, detail="Clé de signature inconnue")

        payload = jwt.decode(
            token,
            public_keys[kid],
            algorithms=[alg],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token invalide: {e}")


def get_supabase():
    """Return the service-key Supabase client (for admin operations)."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def verify_restaurant_owner(user_id: str, restaurant_id: str) -> None:
    """Verify that user_id owns restaurant_id. Raises 403 if not."""
    sb = get_supabase()
    result = sb.table("restaurants").select("id").eq("id", str(restaurant_id)).eq("owner_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce restaurant")


async def get_restaurant_for_user(user_id: str) -> dict:
    """Fetch the restaurant owned by user_id, including all API tokens.

    Returns the full restaurant row as a dict.
    Raises 404 if no restaurant found.
    """
    sb = get_supabase()
    result = (
        sb.table("restaurants")
        .select("*")
        .eq("owner_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Aucun restaurant associé à ce compte")
    return result.data[0]
