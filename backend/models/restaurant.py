from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class Restaurant(BaseModel):
    id: Optional[uuid.UUID] = None
    owner_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    tone_profile: Optional[str] = None
    google_place_id: Optional[str] = None
    created_at: Optional[datetime] = None


class RestaurantCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tone_profile: Optional[str] = None
    google_place_id: Optional[str] = None
