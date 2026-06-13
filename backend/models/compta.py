from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


class TvaBreakdown(BaseModel):
    tva_rate: float
    total_ht: float
    total_tva: float
    total_ttc: float
    invoice_count: int


class SupplierBreakdown(BaseModel):
    supplier_name: str
    total_ht: float
    total_ttc: float
    invoice_count: int


class MonthlyPnL(BaseModel):
    month: str  # "2026-04"
    revenue_ht: float  # CA HT (from daily_sales or manual input)
    purchases_ht: float  # Achats HT (from supplier_invoices)
    purchases_ttc: float
    gross_margin_ht: float  # CA - Achats
    margin_pct: float  # margin / CA * 100
    fixed_charges: float  # charges fixes connues
    net_result: float  # marge - charges fixes
    tva_breakdown: List[TvaBreakdown]
    supplier_breakdown: List[SupplierBreakdown]


class ChargeFixe(BaseModel):
    id: UUID
    restaurant_id: UUID
    label: str
    amount: float  # montant mensuel
    category: str  # 'salaires', 'loyer', 'assurance', 'divers'
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class ChargeFixeCreate(BaseModel):
    restaurant_id: UUID
    label: str
    amount: float
    category: str = "divers"
    notes: Optional[str] = None
