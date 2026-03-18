from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# =====================
# STOCK ITEM (catalogue)
# =====================

class StockItem(BaseModel):
    id: UUID
    restaurant_id: UUID
    name: str
    brand: Optional[str] = None
    category: str          # 'soft' | 'spiritueux' | 'bieres' | 'vins' | 'frais'
    packaging: Optional[str] = None   # 'X24', 'X12', 'Bottes', etc.
    unit: str = "bouteille"           # 'bouteille' | 'litre' | 'kg' | 'botte' | 'pack' | 'canette' | 'boite'
    stock_current: float = 0.0
    stock_min: float = 1.0            # seuil critique (🔴)
    stock_reorder: Optional[float] = None  # seuil de commande (⚠️), défaut = stock_min * 2
    supplier_milliet_price: Optional[float] = None
    supplier_metro_price: Optional[float] = None
    auto_thresholds: Optional[bool] = False   # True si seuils calculés depuis les Z
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class StockItemCreate(BaseModel):
    restaurant_id: UUID
    name: str
    brand: Optional[str] = None
    category: str
    packaging: Optional[str] = None
    unit: str = "bouteille"
    stock_current: float = 0.0
    stock_min: float = 1.0
    stock_reorder: Optional[float] = None
    supplier_milliet_price: Optional[float] = None
    supplier_metro_price: Optional[float] = None
    sort_order: int = 0


class StockItemUpdate(BaseModel):
    stock_current: Optional[float] = None
    stock_min: Optional[float] = None
    stock_reorder: Optional[float] = None
    brand: Optional[str] = None
    packaging: Optional[str] = None
    unit: Optional[str] = None
    supplier_milliet_price: Optional[float] = None
    supplier_metro_price: Optional[float] = None


class StockBulkUpdate(BaseModel):
    """Mise à jour en masse du stock (saisie initiale)."""
    updates: List[dict]  # [{id: UUID, stock_current: float}, ...]


# =====================
# DELIVERY (bon de livraison)
# =====================

class DeliveryItem(BaseModel):
    id: UUID
    delivery_id: UUID
    stock_item_id: Optional[UUID] = None
    item_name: str
    quantity: float
    unit_price: Optional[float] = None


class Delivery(BaseModel):
    id: UUID
    restaurant_id: UUID
    supplier_name: Optional[str] = None
    delivery_date: date
    notes: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    items: List[DeliveryItem] = []
    created_at: Optional[datetime] = None


class DeliveryCreate(BaseModel):
    restaurant_id: UUID
    supplier_name: Optional[str] = None
    delivery_date: date
    notes: Optional[str] = None
    items: List[dict]  # [{stock_item_id, item_name, quantity, unit_price}]


class DeliveryScanRequest(BaseModel):
    restaurant_id: UUID
    image_base64: str
    media_type: str = "image/jpeg"


class DeliveryScanResult(BaseModel):
    supplier_name: Optional[str] = None
    delivery_date: Optional[str] = None
    items: List[dict]   # [{item_name, quantity, unit_price, matched_stock_item_id}]
    raw_text: str


# =====================
# ORDER LIST (bon de commande)
# =====================

class OrderItem(BaseModel):
    stock_item_id: UUID
    name: str
    brand: Optional[str] = None
    category: str
    unit: str
    stock_current: float
    stock_min: float
    stock_reorder: float
    alert_level: str   # 'warning' | 'critical'
    suggested_quantity: Optional[float] = None
    supplier_milliet_price: Optional[float] = None
    supplier_metro_price: Optional[float] = None


# =====================
# Z REPORT (ticket journalier)
# =====================

class ZReportScanRequest(BaseModel):
    restaurant_id: UUID
    image_base64: str
    media_type: str = "image/jpeg"
    sale_date: Optional[date] = None

class ZReportSaleItem(BaseModel):
    item_name: str
    quantity_sold: float
    matched_stock_item_id: Optional[str] = None

class ZReportScanResult(BaseModel):
    sale_date: Optional[str] = None
    items: List[ZReportSaleItem]
    raw_text: str

class ZReportCreate(BaseModel):
    restaurant_id: UUID
    sale_date: date
    items: List[dict]  # [{stock_item_id, item_name, quantity_sold}]


# =====================
# AGENT CHAT
# =====================

class ChatMessage(BaseModel):
    role: str   # 'user' | 'assistant'
    content: str


class AgentChatRequest(BaseModel):
    restaurant_id: UUID
    messages: List[ChatMessage]
    reservations_count: Optional[int] = None
    weather: Optional[str] = None
    notes: Optional[str] = None
