from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# =====================
# SUPPLIER INVOICE (facture fournisseur)
# =====================

class SupplierInvoiceLine(BaseModel):
    id: UUID
    invoice_id: UUID
    stock_item_id: Optional[UUID] = None
    description: str
    quantity: float
    unit: str = "unite"
    unit_price_ht: float
    tva_rate: float = 20.0
    total_ht: Optional[float] = None
    total_tva: Optional[float] = None
    total_ttc: Optional[float] = None
    created_at: Optional[datetime] = None


class SupplierInvoice(BaseModel):
    id: UUID
    restaurant_id: UUID
    supplier_name: str
    invoice_number: Optional[str] = None
    invoice_date: date
    due_date: Optional[date] = None
    delivery_id: Optional[UUID] = None
    total_ht: float = 0
    total_tva: float = 0
    total_ttc: float = 0
    status: str = "pending"  # 'pending' | 'validated' | 'paid' | 'disputed'
    notes: Optional[str] = None
    lines: List[SupplierInvoiceLine] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InvoiceLineCreate(BaseModel):
    stock_item_id: Optional[UUID] = None
    description: str
    quantity: float = 1
    unit: str = "unite"
    unit_price_ht: float
    tva_rate: float = 20.0


class SupplierInvoiceCreate(BaseModel):
    restaurant_id: UUID
    supplier_name: str
    invoice_number: Optional[str] = None
    invoice_date: date
    due_date: Optional[date] = None
    delivery_id: Optional[UUID] = None
    notes: Optional[str] = None
    lines: List[InvoiceLineCreate] = []


class SupplierInvoiceUpdate(BaseModel):
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    delivery_id: Optional[UUID] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class InvoiceScanRequest(BaseModel):
    restaurant_id: UUID
    image_base64: str
    media_type: str = "image/jpeg"


class InvoiceScanResult(BaseModel):
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    lines: List[dict]  # [{description, quantity, unit, unit_price_ht, tva_rate}]
    total_ht: Optional[float] = None
    total_tva: Optional[float] = None
    total_ttc: Optional[float] = None
    raw_text: str
