from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date, timedelta

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.revenue import (
    RevenueEntry, RevenueEntryCreate, RevenueBulkCreate,
    aggregate_revenue_for_range,
)
from supabase import create_client

router = APIRouter(prefix="/revenue", tags=["revenue"])


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _resolve_period_end(period_type: str, period_start: date, period_end: Optional[date]) -> date:
    if period_end is not None:
        return period_end
    if period_type == "day":
        return period_start
    if period_type == "week":
        return period_start + timedelta(days=6)
    if period_type == "month":
        next_m = (period_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return next_m - timedelta(days=1)
    return period_start


@router.get("/", response_model=List[RevenueEntry])
async def list_revenue(
    restaurant_id: UUID = Query(...),
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    period_type: Optional[str] = Query(None, description="day | week | month"),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    q = supabase.table("revenue_entries").select("*").eq("restaurant_id", str(restaurant_id))
    if start:
        q = q.gte("period_start", start.isoformat())
    if end:
        q = q.lte("period_end", end.isoformat())
    if period_type:
        q = q.eq("period_type", period_type)
    data = q.order("period_start", desc=True).execute().data
    return data


@router.post("/", response_model=RevenueEntry)
async def create_revenue(
    body: RevenueEntryCreate,
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    pe = _resolve_period_end(body.period_type, body.period_start, body.period_end)
    payload = {
        "restaurant_id": str(body.restaurant_id),
        "period_type": body.period_type,
        "period_start": body.period_start.isoformat(),
        "period_end": pe.isoformat(),
        "revenue_ht": body.revenue_ht,
        "revenue_ttc": body.revenue_ttc,
        "covers": body.covers,
        "source": body.source,
        "notes": body.notes,
    }
    try:
        res = supabase.table("revenue_entries").insert(payload).execute()
    except Exception as e:
        raise HTTPException(400, f"Insert failed: {e}")
    return res.data[0]


@router.post("/bulk")
async def create_revenue_bulk(
    body: RevenueBulkCreate,
    upsert: bool = Query(False, description="Si true, remplace les entrées existantes (period_type, period_start)"),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    rows = []
    for e in body.entries:
        pe = _resolve_period_end(e.period_type, e.period_start, e.period_end)
        rows.append({
            "restaurant_id": str(body.restaurant_id),
            "period_type": e.period_type,
            "period_start": e.period_start.isoformat(),
            "period_end": pe.isoformat(),
            "revenue_ht": e.revenue_ht,
            "revenue_ttc": e.revenue_ttc,
            "covers": e.covers,
            "source": e.source,
            "notes": e.notes,
        })
    if not rows:
        return {"inserted": 0}
    try:
        if upsert:
            res = supabase.table("revenue_entries").upsert(
                rows, on_conflict="restaurant_id,period_type,period_start"
            ).execute()
        else:
            res = supabase.table("revenue_entries").insert(rows).execute()
    except Exception as e:
        raise HTTPException(400, f"Bulk insert failed: {e}")
    return {"inserted": len(res.data), "rows": res.data[:3]}


@router.delete("/{entry_id}")
async def delete_revenue(
    entry_id: UUID,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    supabase.table("revenue_entries").delete().eq("id", str(entry_id)).execute()
    return {"deleted": True}


@router.get("/aggregate")
async def get_revenue_aggregate(
    restaurant_id: UUID = Query(...),
    start: date = Query(...),
    end: date = Query(...),
    user_id: str = Depends(get_current_user),
):
    """
    Agrège le CA pour une période donnée en respectant la précédence
    day > week > month (anti-double-comptage).
    """
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    entries = (
        supabase.table("revenue_entries")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .gte("period_end", start.isoformat())
        .lte("period_start", end.isoformat())
        .execute()
        .data
    )
    result = aggregate_revenue_for_range(entries, start, end)
    return {
        "restaurant_id": str(restaurant_id),
        "range_start": start.isoformat(),
        "range_end": end.isoformat(),
        **result,
        "entry_count": len(entries),
    }
