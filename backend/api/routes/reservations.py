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


def _determine_service(time_str: str) -> str:
    """Determine if a time falls in lunch or dinner service."""
    h = int(time_str.split(":")[0])
    return "lunch" if h < 17 else "dinner"


def _time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' or 'HH:MM:SS' to minutes since midnight."""
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _score_table(
    table: dict,
    occupied_table_ids: set,
    tables_used_this_service: set,
    tables_with_tight_turnover: set,
    occupied_tables_with_positions: list,
) -> tuple:
    """
    Score a table for assignment. Lower score = better choice.

    Rules (in priority order):
    1. Prefer tables NOT used during this service (no need to redress quickly)
    2. Avoid tight turnovers (table freed < 30 min before new reservation)
    3. Prefer tables farther from currently occupied tables (spacing/comfort)
    4. Prefer smallest capacity that fits (tight fit)
    """
    score_used = 0 if table["id"] not in tables_used_this_service else 10
    score_turnover = 0 if table["id"] not in tables_with_tight_turnover else 5

    # Spacing: average distance to occupied tables (inverted — farther is better)
    score_spacing = 0
    if occupied_tables_with_positions:
        total_dist = 0
        for occ in occupied_tables_with_positions:
            dx = table.get("x", 0) - occ.get("x", 0)
            dy = table.get("y", 0) - occ.get("y", 0)
            total_dist += _math.sqrt(dx * dx + dy * dy)
        avg_dist = total_dist / len(occupied_tables_with_positions)
        # Invert: closer tables get higher (worse) score. Max grid is ~141 (diagonal of 100x100)
        score_spacing = max(0, 15 - avg_dist)

    # Capacity fit: prefer tightest fit
    score_capacity = table["capacity"]

    return (score_used, score_turnover, score_spacing, score_capacity)


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

    Smart rules:
    - Prefer tables not yet used during this service (avoid rushing redress)
    - Avoid tight turnovers (< 30 min gap after previous reservation)
    - Maximize spacing between occupied tables for client comfort
    - Pick the smallest table that fits (tight capacity match)
    - Fallback: group adjacent movable tables if no single table works
    """
    TURNOVER_BUFFER_MIN = 30  # minimum gap between reservations on same table

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
    tables = [t for t in (tables_resp.data or []) if t.get("floor_plan_id") in reservable_plan_ids]

    # Get ALL reservations on the same date (for service-level analysis)
    existing_resp = (
        supabase.table("reservations")
        .select("table_id, time, duration, status")
        .eq("restaurant_id", restaurant_id)
        .eq("date", res_date)
        .in_("status", ["confirmed", "pending"])
        .execute()
    )
    existing = existing_resp.data or []

    current_service = _determine_service(res_time)
    res_start_min = _time_to_minutes(res_time)

    # Build sets for scoring
    occupied = set()                    # tables with overlapping reservations
    tables_used_this_service = set()    # tables that had ANY reservation this service
    tables_with_tight_turnover = set()  # tables where previous resa ends < 30 min before

    for r in existing:
        if not r["table_id"]:
            continue

        r_service = _determine_service(r["time"])

        # Track tables used during the same service
        if r_service == current_service:
            tables_used_this_service.add(r["table_id"])

        # Check time overlap
        if _times_overlap(res_time, duration, r["time"], r["duration"]):
            occupied.add(r["table_id"])

        # Check tight turnover: previous reservation ends less than 30 min before new one starts
        r_start = _time_to_minutes(r["time"])
        r_end = r_start + (r["duration"] or 120)
        gap = res_start_min - r_end
        if 0 <= gap < TURNOVER_BUFFER_MIN:
            tables_with_tight_turnover.add(r["table_id"])

    # Build list of currently occupied table positions (for spacing calculation)
    occupied_tables_with_positions = [
        t for t in tables if t["id"] in occupied
    ]

    # Strategy 1: single table — scored and sorted by smart rules
    candidates = [t for t in tables if t["capacity"] >= guest_count and t["id"] not in occupied]
    candidates.sort(key=lambda t: _score_table(
        t, occupied, tables_used_this_service,
        tables_with_tight_turnover, occupied_tables_with_positions,
    ))
    if candidates:
        return candidates[0]["id"]

    # Strategy 2: adjacent group with combined capacity >= guest_count
    free_tables = [t for t in tables if t["id"] not in occupied and t.get("movable", True)]
    groups = _find_adjacent_groups(free_tables)
    qualifying = [g for g in groups if sum(t["capacity"] for t in g) >= guest_count]
    qualifying.sort(key=lambda g: sum(t["capacity"] for t in g))
    if qualifying:
        return qualifying[0][0]["id"]

    return None


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
