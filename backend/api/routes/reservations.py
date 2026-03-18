from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta

from core.config import settings
from models.reservation import (
    FloorPlan, FloorPlanCreate,
    RestaurantTable, TableCreate, TableUpdate,
    Reservation, ReservationCreate, ReservationUpdate
)
from supabase import create_client

router = APIRouter()


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


# =====================
# FLOOR PLANS
# =====================

@router.get("/floor-plans", response_model=List[FloorPlan])
async def list_floor_plans(restaurant_id: UUID = Query(...)):
    supabase = get_supabase()
    response = (
        supabase.table("floor_plans")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    return response.data


@router.post("/floor-plans", response_model=FloorPlan)
async def create_floor_plan(body: FloorPlanCreate):
    supabase = get_supabase()
    response = (
        supabase.table("floor_plans")
        .insert(body.model_dump(mode="json"))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création du plan")
    return response.data[0]


@router.patch("/floor-plans/{floor_plan_id}", response_model=FloorPlan)
async def update_floor_plan(floor_plan_id: UUID, body: dict):
    supabase = get_supabase()
    updates = {k: v for k, v in body.items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    response = (
        supabase.table("floor_plans")
        .update(updates)
        .eq("id", str(floor_plan_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    return response.data[0]


@router.delete("/floor-plans/{floor_plan_id}")
async def delete_floor_plan(floor_plan_id: UUID):
    supabase = get_supabase()
    supabase.table("floor_plans").update({"is_active": False}).eq("id", str(floor_plan_id)).execute()
    return {"status": "deleted"}


# =====================
# TABLES
# =====================

@router.get("/tables", response_model=List[RestaurantTable])
async def list_tables(
    restaurant_id: UUID = Query(...),
    floor_plan_id: Optional[UUID] = Query(None)
):
    supabase = get_supabase()
    query = (
        supabase.table("restaurant_tables")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
    )
    if floor_plan_id:
        query = query.eq("floor_plan_id", str(floor_plan_id))
    response = query.execute()
    return response.data


@router.post("/tables", response_model=RestaurantTable)
async def create_table(body: TableCreate):
    supabase = get_supabase()
    response = (
        supabase.table("restaurant_tables")
        .insert(body.model_dump(mode="json"))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création de la table")
    return response.data[0]


@router.patch("/tables/{table_id}", response_model=RestaurantTable)
async def update_table(table_id: UUID, body: TableUpdate):
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True, mode="json")
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    response = (
        supabase.table("restaurant_tables")
        .update(updates)
        .eq("id", str(table_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Table introuvable")
    return response.data[0]


@router.delete("/tables/{table_id}")
async def delete_table(table_id: UUID):
    supabase = get_supabase()
    supabase.table("restaurant_tables").delete().eq("id", str(table_id)).execute()
    return {"status": "deleted"}


# =====================
# RESERVATIONS
# =====================

@router.get("/", response_model=List[Reservation])
async def list_reservations(
    restaurant_id: UUID = Query(...),
    date: Optional[str] = Query(None),       # "YYYY-MM-DD"
    status: Optional[str] = Query(None),
):
    supabase = get_supabase()
    query = (
        supabase.table("reservations")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .order("time")
    )
    if date:
        query = query.eq("date", date)
    if status:
        query = query.eq("status", status)
    response = query.execute()
    return response.data


def _times_overlap(start1: str, dur1: int, start2: str, dur2: int) -> bool:
    """Check if two time slots overlap. Times are 'HH:MM' strings, durations in minutes."""
    fmt = "%H:%M"
    s1 = datetime.strptime(start1, fmt)
    e1 = s1 + timedelta(minutes=dur1)
    s2 = datetime.strptime(start2, fmt)
    e2 = s2 + timedelta(minutes=dur2)
    return s1 < e2 and s2 < e1


import math as _math

def _find_adjacent_groups(tables: list, threshold: float = 9.0) -> list:
    """Group tables by spatial proximity (center-to-center distance in %)."""
    visited = set()
    groups = []
    for t in tables:
        if t["id"] in visited:
            continue
        group = [t]
        visited.add(t["id"])
        queue = [t]
        while queue:
            current = queue.pop(0)
            for other in tables:
                if other["id"] in visited:
                    continue
                dx = current.get("x", 0) - other.get("x", 0)
                dy = current.get("y", 0) - other.get("y", 0)
                if _math.sqrt(dx * dx + dy * dy) < threshold:
                    group.append(other)
                    visited.add(other["id"])
                    queue.append(other)
        if len(group) > 1:
            groups.append(group)
    return groups


def _auto_assign_table(
    supabase,
    restaurant_id: str,
    guest_count: int,
    res_date: str,
    res_time: str,
    duration: int,
) -> Optional[str]:
    """
    Find the best available table for the reservation.
    Strategy 1: smallest single table with capacity >= guest_count.
    Strategy 2: if no single table fits, find a group of adjacent tables
                whose combined capacity >= guest_count and all are free.
    """
    # Get IDs of reservable floor plans
    plans_resp = (
        supabase.table("floor_plans")
        .select("id")
        .eq("restaurant_id", restaurant_id)
        .eq("is_active", True)
        .eq("reservable", True)
        .execute()
    )
    reservable_plan_ids = {p["id"] for p in (plans_resp.data or [])}

    # Get all tables for the restaurant (with positions for group detection)
    tables_resp = (
        supabase.table("restaurant_tables")
        .select("id, capacity, x, y, movable, floor_plan_id")
        .eq("restaurant_id", restaurant_id)
        .execute()
    )
    # Keep only tables in reservable floor plans
    tables = [t for t in (tables_resp.data or []) if t.get("floor_plan_id") in reservable_plan_ids]

    # Get existing reservations on the same date to build occupied set
    existing_resp = (
        supabase.table("reservations")
        .select("table_id, time, duration")
        .eq("restaurant_id", restaurant_id)
        .eq("date", res_date)
        .in_("status", ["confirmed", "pending"])
        .execute()
    )
    existing = existing_resp.data or []

    occupied = set()
    for r in existing:
        if r["table_id"] and _times_overlap(res_time, duration, r["time"], r["duration"]):
            occupied.add(r["table_id"])

    # Strategy 1: single table
    candidates = sorted(
        [t for t in tables if t["capacity"] >= guest_count],
        key=lambda t: t["capacity"]
    )
    for table in candidates:
        if table["id"] not in occupied:
            return table["id"]

    # Strategy 2: adjacent group with combined capacity >= guest_count
    # Only movable tables can be grouped (movable=True by default)
    free_tables = [t for t in tables if t["id"] not in occupied and t.get("movable", True)]
    groups = _find_adjacent_groups(free_tables)
    # Sort groups by combined capacity ascending (tightest fit)
    qualifying = [g for g in groups if sum(t["capacity"] for t in g) >= guest_count]
    qualifying.sort(key=lambda g: sum(t["capacity"] for t in g))
    if qualifying:
        # Assign to the first table of the best group
        return qualifying[0][0]["id"]

    return None  # No table or group available


@router.post("/", response_model=Reservation)
async def create_reservation(body: ReservationCreate):
    supabase = get_supabase()
    data = body.model_dump(mode="json")
    # Convert date to string
    if isinstance(data.get("date"), object) and hasattr(data["date"], "isoformat"):
        data["date"] = data["date"].isoformat()

    # Auto-assign table if not provided
    if not data.get("table_id"):
        assigned = _auto_assign_table(
            supabase,
            restaurant_id=str(body.restaurant_id),
            guest_count=body.guest_count,
            res_date=data["date"],
            res_time=body.time,
            duration=body.duration or 120,
        )
        if assigned is None:
            raise HTTPException(
                status_code=409,
                detail="Aucune table disponible pour ce créneau. Le restaurant est complet."
            )
        data["table_id"] = assigned

    response = (
        supabase.table("reservations")
        .insert(data)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création de la réservation")
    return response.data[0]


@router.patch("/{reservation_id}", response_model=Reservation)
async def update_reservation(reservation_id: UUID, body: ReservationUpdate):
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True, mode="json")
    if "date" in updates and hasattr(updates["date"], "isoformat"):
        updates["date"] = updates["date"].isoformat()
    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    response = (
        supabase.table("reservations")
        .update(updates)
        .eq("id", str(reservation_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    return response.data[0]


@router.delete("/{reservation_id}")
async def delete_reservation(reservation_id: UUID):
    supabase = get_supabase()
    supabase.table("reservations").delete().eq("id", str(reservation_id)).execute()
    return {"status": "deleted"}
