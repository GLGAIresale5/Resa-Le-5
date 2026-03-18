from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime
from uuid import UUID


# =====================
# FLOOR PLAN
# =====================

class FloorPlan(BaseModel):
    id: UUID
    restaurant_id: UUID
    name: str
    is_active: bool
    sort_order: int
    reservable: bool = True   # si False, les tables de cette salle sont exclues de l'attribution auto
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FloorPlanCreate(BaseModel):
    restaurant_id: UUID
    name: str
    sort_order: int = 0
    reservable: bool = True


# =====================
# TABLE
# =====================

class RestaurantTable(BaseModel):
    id: UUID
    floor_plan_id: UUID
    restaurant_id: UUID
    name: str
    capacity: int
    x: float
    y: float
    width: float = 80
    height: float = 80
    shape: str = "square"  # "square" | "round" | "rectangle"
    rotation: int = 0      # 0 or 90
    snap: bool = True      # snap to grid when dragging
    movable: bool = True   # peut être groupée avec d'autres tables
    client_priority: int = 3  # 1-5, where 5 = best table
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TableCreate(BaseModel):
    floor_plan_id: UUID
    restaurant_id: UUID
    name: str
    capacity: int
    x: float = 50.0
    y: float = 50.0
    width: float = 80.0
    height: float = 80.0
    shape: str = "square"
    rotation: int = 0
    snap: bool = True
    movable: bool = True
    client_priority: int = 3


class TableUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    shape: Optional[str] = None
    rotation: Optional[int] = None
    snap: Optional[bool] = None
    movable: Optional[bool] = None
    client_priority: Optional[int] = None


# =====================
# RESERVATION
# =====================

class Reservation(BaseModel):
    id: UUID
    restaurant_id: UUID
    table_id: Optional[UUID] = None
    guest_name: str
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    guest_count: int
    date: date
    time: str  # "HH:MM" format
    duration: int = 120
    source: str = "manual"
    status: str = "confirmed"
    notes: Optional[str] = None
    grouped_table_ids: List[UUID] = []  # tables groupées pour ce service
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReservationCreate(BaseModel):
    restaurant_id: UUID
    table_id: Optional[UUID] = None
    guest_name: str
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    guest_count: int
    date: date
    time: str  # "HH:MM"
    duration: int = 120
    source: str = "manual"
    status: str = "confirmed"
    notes: Optional[str] = None
    grouped_table_ids: List[UUID] = []


class ReservationUpdate(BaseModel):
    table_id: Optional[UUID] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    guest_count: Optional[int] = None
    date: Optional[date] = None
    time: Optional[str] = None
    duration: Optional[int] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    grouped_table_ids: Optional[List[UUID]] = None
