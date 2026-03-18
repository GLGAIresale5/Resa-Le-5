from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime
import uuid


class Post(BaseModel):
    id: Optional[uuid.UUID] = None
    restaurant_id: uuid.UUID
    context: str
    photo_url: Optional[str] = None
    generated_text: Optional[str] = None
    final_text: Optional[str] = None
    platforms: List[str] = []
    status: Literal["draft", "approved", "published"] = "draft"
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class GeneratePostRequest(BaseModel):
    restaurant_id: str
    context: str
    photo_base64: Optional[str] = None
    photo_media_type: Optional[str] = "image/jpeg"
    platforms: List[str] = ["instagram", "facebook"]


class ApprovePostRequest(BaseModel):
    final_text: Optional[str] = None
