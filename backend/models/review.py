from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime
import uuid


class Review(BaseModel):
    id: Optional[uuid.UUID] = None
    restaurant_id: uuid.UUID
    source: Literal["google", "tripadvisor", "thefork"]
    external_id: Optional[str] = None
    author_name: Optional[str] = None
    rating: Optional[int] = None
    content: Optional[str] = None
    review_date: Optional[datetime] = None
    status: Literal["pending", "responded", "ignored"] = "pending"
    created_at: Optional[datetime] = None


class ReviewResponse(BaseModel):
    id: Optional[uuid.UUID] = None
    review_id: uuid.UUID
    generated_text: str
    final_text: Optional[str] = None
    status: Literal["draft", "approved", "published"] = "draft"
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class GenerateResponseRequest(BaseModel):
    review_id: str
    restaurant_id: str
