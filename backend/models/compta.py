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


class CategoryBreakdown(BaseModel):
    category: str  # 'matieres' | 'exploitation' | 'equipement' | 'hors_resto'
    label: str
    total_ht: float
    total_ttc: float
    invoice_count: int


class MonthlyPnL(BaseModel):
    month: str  # "2026-04"
    revenue_ht: float  # CA HT (from revenue_entries or manual input)
    purchases_ht: float  # Achats HT TOTAUX (toutes catégories)
    purchases_ttc: float
    # Ventilation par poste de dépense (HT)
    purchases_matieres: float = 0      # matières premières (entrent dans la marge brute)
    charges_exploitation: float = 0    # charges courantes (énergie, télécom, logiciels...)
    purchases_equipement: float = 0    # équipement / investissement
    purchases_hors_resto: float = 0    # dépenses hors-restaurant (perso, véhicule...)
    gross_margin_ht: float  # CA - matières
    margin_pct: float  # marge / CA * 100
    fixed_charges: float  # charges fixes connues (salaires, loyer...)
    net_result: float  # marge - charges d'exploitation - charges fixes
    tva_breakdown: List[TvaBreakdown]
    supplier_breakdown: List[SupplierBreakdown]
    category_breakdown: List[CategoryBreakdown] = []


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


class ChargeFixeUpdate(BaseModel):
    label: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    notes: Optional[str] = None
