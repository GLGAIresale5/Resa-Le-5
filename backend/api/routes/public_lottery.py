"""
Endpoints PUBLICS de la loterie « La Chance du 5 » — appelés par /[slug]/jeu.

Le client scanne le QR sur l'addition, laisse prénom + téléphone, et le tirage
est effectué ICI, côté serveur. La grille n'est jamais exposée au navigateur.

Anti-abus : honeypot + rate limit par IP (large — les clients partagent souvent
le wifi du restaurant, donc la même IP publique) ; le vrai garde-fou est la règle
« 1 tirage par numéro tous les 7 jours », vérifiée en base.

RGPD (cadrage Harvey du 28/07/2026) :
- l'insert dans lottery_plays repose sur l'exécution du contrat (règlement du jeu),
  la case « j'accepte le règlement » est OBLIGATOIRE et son horodatage est conservé ;
- l'insert dans marketing_contacts repose sur le consentement et n'a lieu QUE si la
  case facultative est cochée. Le jeu fonctionne intégralement sans elle.
"""

import logging
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from supabase import create_client

from core.config import settings
from services.lottery import (
    cooldown_until,
    draw_prize,
    expiry_from,
    normalize_phone,
    now_utc,
    parse_ts,
    prize_payload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lottery", tags=["lottery-public"])

# Rate limit : 20 tirages / 10 min par IP.
# Volontairement large : une tablée sur le wifi du 5 sort par la même IP publique.
_ip_window: dict = defaultdict(lambda: deque(maxlen=20))
_RATE_WINDOW_S = 600
_RATE_MAX = 20


class PlayRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=6, max_length=25)
    rules_accepted: bool = False
    marketing_opt_in: bool = False
    # Honeypot — les bots remplissent les champs cachés
    website: Optional[str] = Field(default="", max_length=200)


class PlayResponse(BaseModel):
    status: str  # "win" | "lose" | "cooldown"
    first_name: str
    prize: Optional[str] = None
    prize_label: Optional[str] = None
    is_alcohol: bool = False
    expires_at: Optional[str] = None
    next_play_at: Optional[str] = None


def _check_rate(ip: str) -> bool:
    now = time.time()
    history = _ip_window[ip]
    while history and now - history[0] > _RATE_WINDOW_S:
        history.popleft()
    if len(history) >= _RATE_MAX:
        return False
    history.append(now)
    return True


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_restaurant(supabase, slug: Optional[str]) -> dict:
    """Résolution du restaurant par slug. Le slug est OBLIGATOIRE côté loterie."""
    if not slug:
        raise HTTPException(status_code=400, detail="Restaurant non précisé.")
    result = (
        supabase.table("restaurants")
        .select("id, name, slug")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")
    return result.data[0]


def _gros_lot_used_this_month(supabase, restaurant_id: str) -> int:
    """Nombre de gros lots déjà attribués depuis le 1er du mois (plafond art. 4)."""
    start_of_month = now_utc().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    result = (
        supabase.table("lottery_plays")
        .select("id")
        .eq("restaurant_id", restaurant_id)
        .eq("prize", "gros_lot")
        .gte("created_at", start_of_month.isoformat())
        .execute()
    )
    return len(result.data or [])


def _last_play(supabase, restaurant_id: str, phone: str) -> Optional[dict]:
    result = (
        supabase.table("lottery_plays")
        .select("created_at")
        .eq("restaurant_id", restaurant_id)
        .eq("phone", phone)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def _record_marketing_consent(supabase, restaurant_id: str, first_name: str, phone: str):
    """
    Enregistre le consentement SMS — best-effort : un échec ici ne doit JAMAIS
    faire échouer le tirage (le jeu ne dépend pas de la prospection).

    consent_at n'est jamais écrasé pour un contact déjà actif : c'est nous qui
    portons la charge de la preuve du consentement (art. 7.1 RGPD), on garde donc
    la date d'origine.
    """
    try:
        existing = (
            supabase.table("marketing_contacts")
            .select("id, unsubscribed_at")
            .eq("restaurant_id", restaurant_id)
            .eq("phone", phone)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            if row.get("unsubscribed_at"):
                # Ré-opt-in après un STOP → nouveau consentement, on réactive
                supabase.table("marketing_contacts").update(
                    {
                        "unsubscribed_at": None,
                        "consent_at": now_utc().isoformat(),
                        "first_name": first_name,
                    }
                ).eq("id", row["id"]).execute()
            return
        supabase.table("marketing_contacts").insert(
            {
                "restaurant_id": restaurant_id,
                "first_name": first_name,
                "phone": phone,
                "source": "loterie",
                "consent_at": now_utc().isoformat(),
            }
        ).execute()
    except Exception:
        logger.exception("Enregistrement du consentement marketing échoué (phone=%s)", phone)


@router.get("/public/info")
async def public_info(slug: Optional[str] = Query(None)):
    """Infos publiques minimales pour afficher la page du jeu."""
    supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    restaurant = _get_restaurant(supabase, slug)
    return {"name": restaurant["name"], "slug": restaurant["slug"]}


@router.post("/public/play", response_model=PlayResponse)
async def public_play(
    body: PlayRequest,
    request: Request,
    slug: Optional[str] = Query(None),
):
    """Participation au jeu + tirage au sort instantané (côté serveur)."""

    # Honeypot — on absorbe silencieusement, sans révéler la détection
    if body.website:
        logger.info("Loterie : honeypot déclenché (first_name=%s)", body.first_name)
        return PlayResponse(status="lose", first_name=body.first_name.strip())

    if not _check_rate(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Trop de tentatives depuis cet appareil. Réessayez dans quelques minutes.",
        )

    first_name = body.first_name.strip()
    if not first_name:
        raise HTTPException(status_code=400, detail="Le prénom est obligatoire.")

    # Case obligatoire : acceptation CONTRACTUELLE du règlement (pas un consentement RGPD)
    if not body.rules_accepted:
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter le règlement du jeu pour participer.",
        )

    phone = normalize_phone(body.phone)
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Numéro de mobile invalide. Format attendu : 06 ou 07 suivi de 8 chiffres.",
        )

    supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    restaurant = _get_restaurant(supabase, slug)
    rest_id = restaurant["id"]

    # ── Règle « 1 tirage / numéro / 7 jours » ──
    # Premier accès à lottery_plays : si la migration 021 n'est pas encore appliquée,
    # on renvoie un message lisible plutôt qu'un 500 nu (le repo veut du code qui
    # tolère une migration en retard — ici on refuse de jouer, mais proprement).
    try:
        last = _last_play(supabase, rest_id, phone)
    except Exception:
        logger.exception("Loterie indisponible — lottery_plays inaccessible")
        raise HTTPException(
            status_code=503,
            detail="Le jeu est momentanément indisponible. Réessayez dans quelques minutes.",
        )
    if last and last.get("created_at"):
        next_at = cooldown_until(parse_ts(last["created_at"]))
        if next_at > now_utc():
            return PlayResponse(
                status="cooldown",
                first_name=first_name,
                next_play_at=next_at.isoformat(),
            )

    # ── Tirage (serveur uniquement) ──
    prize = draw_prize(_gros_lot_used_this_month(supabase, rest_id))
    payload = prize_payload(prize)
    won = prize != "none"

    moment = now_utc()
    expires_at = expiry_from(moment) if won else None

    row = {
        "restaurant_id": rest_id,
        "first_name": first_name,
        "phone": phone,
        "prize": prize,
        "prize_label": payload["prize_label"],
        "is_alcohol": payload["is_alcohol"],
        "status": "pending" if won else "none",
        "expires_at": expires_at.isoformat() if expires_at else None,
        "rules_accepted_at": moment.isoformat(),
    }

    # L'insert ne doit JAMAIS être avalé silencieusement : si l'enregistrement
    # échoue, l'écran de gain ne doit pas s'afficher — sinon on promet un lot qui
    # n'existe nulle part et le client se présentera en salle avec un gain fantôme.
    try:
        inserted = supabase.table("lottery_plays").insert(row).execute()
    except Exception:
        logger.exception("Loterie : insert du tirage échoué")
        raise HTTPException(
            status_code=503,
            detail="Le tirage n'a pas pu être enregistré. Réessayez dans un instant.",
        )
    if not inserted.data:
        raise HTTPException(
            status_code=500,
            detail="Le tirage n'a pas pu être enregistré. Réessayez dans un instant.",
        )

    if body.marketing_opt_in:
        _record_marketing_consent(supabase, rest_id, first_name, phone)

    return PlayResponse(
        status="win" if won else "lose",
        first_name=first_name,
        prize=prize if won else None,
        prize_label=payload["prize_label"] if won else None,
        is_alcohol=payload["is_alcohol"] if won else False,
        expires_at=expires_at.isoformat() if expires_at else None,
    )
