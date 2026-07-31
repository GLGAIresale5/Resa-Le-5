"""
Endpoints AUTHENTIFIÉS de la loterie — back-office (onglet Loterie).

Trois usages :
1. Le serveur en salle cherche un gagnant par téléphone OU par prénom, puis
   « brûle » son lot. Pas de code à présenter par le client : la base fait foi.
2. Baptiste suit l'exposition du mois (nombre de lots, coût matière, plafond).
3. RGPD — effacement d'un client sur demande, et purge automatique à 3 mois.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from core.auth import get_current_user, get_supabase, verify_restaurant_owner
from core.config import settings
from services.lottery import (
    MAX_GROS_LOT_PER_MONTH,
    PRIZES,
    RETENTION_PLAYS_DAYS,
    normalize_phone,
    now_utc,
    parse_ts,
)
from datetime import timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lottery", tags=["lottery"])


class ClaimRequest(BaseModel):
    restaurant_id: str


class EraseRequest(BaseModel):
    restaurant_id: str
    phone: str = Field(min_length=6, max_length=25)


@router.get("/plays")
async def list_plays(
    restaurant_id: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """
    Participations des 90 derniers jours (la table est purgée à 3 mois, donc
    c'est de fait la table entière). Pas de pagination : cohérent avec le reste
    du back-office, et le volume reste petit par construction.
    """
    await verify_restaurant_owner(user_id, restaurant_id)
    sb = get_supabase()

    since = (now_utc() - timedelta(days=RETENTION_PLAYS_DAYS)).isoformat()
    result = (
        sb.table("lottery_plays")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    now = now_utc()
    plays = []
    for row in result.data or []:
        expires_at = row.get("expires_at")
        is_expired = bool(
            expires_at and row.get("status") == "pending" and parse_ts(expires_at) < now
        )
        row["is_expired"] = is_expired
        plays.append(row)

    return {"plays": plays}


@router.post("/plays/{play_id}/claim")
async def claim_play(
    play_id: str,
    body: ClaimRequest,
    user_id: str = Depends(get_current_user),
):
    """Remise du lot en salle — « brûle » le lot pour qu'il ne soit pas repris."""
    await verify_restaurant_owner(user_id, body.restaurant_id)
    sb = get_supabase()

    existing = (
        sb.table("lottery_plays")
        .select("*")
        .eq("id", play_id)
        .eq("restaurant_id", body.restaurant_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Participation introuvable")

    play = existing.data[0]
    if play.get("status") == "claimed":
        raise HTTPException(status_code=400, detail="Ce lot a déjà été remis.")
    if play.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Cette participation n'a pas de lot à remettre.")

    expires_at = play.get("expires_at")
    if expires_at and parse_ts(expires_at) < now_utc():
        raise HTTPException(
            status_code=400,
            detail="Ce lot a dépassé sa validité de 30 jours. Libre à vous de l'offrir quand même — mais il n'est plus dû.",
        )

    updated = (
        sb.table("lottery_plays")
        .update({"status": "claimed", "claimed_at": now_utc().isoformat()})
        .eq("id", play_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=500, detail="La mise à jour a échoué.")
    return updated.data[0]


@router.get("/stats")
async def lottery_stats(
    restaurant_id: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """Exposition du mois en cours : participations, lots, coût matière, plafond."""
    await verify_restaurant_owner(user_id, restaurant_id)
    sb = get_supabase()

    start_of_month = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = (
        sb.table("lottery_plays")
        .select("prize, status")
        .eq("restaurant_id", restaurant_id)
        .gte("created_at", start_of_month.isoformat())
        .execute()
    )
    rows = result.data or []

    by_prize = {}
    cost_max = 0.0
    cost_claimed = 0.0
    wins = 0
    for row in rows:
        prize = row.get("prize", "none")
        by_prize[prize] = by_prize.get(prize, 0) + 1
        if prize == "none":
            continue
        wins += 1
        unit = PRIZES.get(prize, {}).get("cost", 0.0)
        cost_max += unit
        if row.get("status") == "claimed":
            cost_claimed += unit

    contacts = (
        sb.table("marketing_contacts")
        .select("id")
        .eq("restaurant_id", restaurant_id)
        .is_("unsubscribed_at", "null")
        .execute()
    )

    return {
        "month": start_of_month.strftime("%Y-%m"),
        "plays": len(rows),
        "wins": wins,
        "by_prize": by_prize,
        "cost_max": round(cost_max, 2),
        "cost_claimed": round(cost_claimed, 2),
        "gros_lot_used": by_prize.get("gros_lot", 0),
        "gros_lot_cap": MAX_GROS_LOT_PER_MONTH,
        "marketing_contacts": len(contacts.data or []),
    }


@router.get("/contacts")
async def list_contacts(
    restaurant_id: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """Base de prospection (opt-in). Séparée des participations — RGPD."""
    await verify_restaurant_owner(user_id, restaurant_id)
    sb = get_supabase()
    result = (
        sb.table("marketing_contacts")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"contacts": result.data or []}


@router.post("/erase")
async def erase_person(
    body: EraseRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Droit à l'effacement (art. 17 RGPD) — frappe les DEUX tables.

    Sans ce bouton, une demande d'effacement se traiterait à la main dans
    l'urgence, un jour de service. C'est exactement ce qu'on veut éviter.
    """
    await verify_restaurant_owner(user_id, body.restaurant_id)
    phone = normalize_phone(body.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Numéro de mobile invalide.")

    sb = get_supabase()
    plays = (
        sb.table("lottery_plays")
        .delete()
        .eq("restaurant_id", body.restaurant_id)
        .eq("phone", phone)
        .execute()
    )
    contacts = (
        sb.table("marketing_contacts")
        .delete()
        .eq("restaurant_id", body.restaurant_id)
        .eq("phone", phone)
        .execute()
    )
    return {
        "status": "ok",
        "plays_deleted": len(plays.data or []),
        "contacts_deleted": len(contacts.data or []),
    }


@router.post("/purge")
async def purge_old_data(x_ingest_key: Optional[str] = Header(None)):
    """
    Purge RGPD — appelée par une tâche planifiée (même mécanisme que /factures/ingest).

    • lottery_plays de plus de 3 mois → supprimées (rétention annoncée dans le règlement)
    • lots 'pending' dont la validité de 30 jours est dépassée → passés en 'expired'

    marketing_contacts n'est PAS touchée ici : sa rétention est de 3 ans après le
    dernier contact, et un désabonné garde sa ligne (preuve de l'opposition).
    """
    if not settings.ingest_api_key or x_ingest_key != settings.ingest_api_key:
        raise HTTPException(status_code=401, detail="Clé d'ingestion invalide")

    sb = get_supabase()
    now = now_utc()

    expired = (
        sb.table("lottery_plays")
        .update({"status": "expired"})
        .eq("status", "pending")
        .lt("expires_at", now.isoformat())
        .execute()
    )

    cutoff = (now - timedelta(days=RETENTION_PLAYS_DAYS)).isoformat()
    deleted = (
        sb.table("lottery_plays").delete().lt("created_at", cutoff).execute()
    )

    return {
        "status": "ok",
        "marked_expired": len(expired.data or []),
        "deleted": len(deleted.data or []),
    }
