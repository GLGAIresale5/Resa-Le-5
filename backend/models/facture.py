from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# Statuts "comptabilisés" : seules ces factures entrent dans le bilan de l'app
# (résultat, TVA, postes, fournisseurs, dashboard). Les 'pending' (à comptabiliser)
# et 'disputed' (litige) sont exclues des chiffres tant qu'elles ne sont pas validées.
# 'paid' est un statut hérité (import Tablo) traité comme comptabilisé, plus jamais écrit.
BOOKED_STATUSES = ("validated", "paid")


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
    total_ttc: float = 0  # NET À PAYER (ce qui est prélevé) = total_ht + total_tva + consignes − deconsignes
    consignes: float = 0        # emballages consignés facturés (+), hors base TVA/matières
    deconsignes: float = 0      # retours de consignes crédités (magnitude +, appliqués en −)
    status: str = "pending"  # 'pending' | 'validated' | 'paid' | 'disputed'
    category: str = "matieres"  # 'matieres' | 'exploitation' | 'equipement' | 'hors_resto'
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
    due_date: Optional[date] = None  # date de prélèvement / échéance
    delivery_id: Optional[UUID] = None
    category: str = "matieres"
    consignes: float = 0
    deconsignes: float = 0
    notes: Optional[str] = None
    lines: List[InvoiceLineCreate] = []


class SupplierInvoiceUpdate(BaseModel):
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    delivery_id: Optional[UUID] = None
    status: Optional[str] = None
    category: Optional[str] = None
    consignes: Optional[float] = None
    deconsignes: Optional[float] = None
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


class InvoiceIngestResult(BaseModel):
    """Résultat de l'ingestion automatique d'un fichier (n8n → /factures/ingest)."""
    status: str  # 'created' | 'duplicate' | 'emitted_sale' | 'needs_review' | 'unreadable'
    doc_type: Optional[str] = None  # 'supplier_charge' | 'emitted_sale' | 'unknown'
    message: str = ""
    invoice_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    category: Optional[str] = None
    total_ttc: Optional[float] = None  # net à payer inséré
    consignes: Optional[float] = None
    deconsignes: Optional[float] = None
    confidence: Optional[str] = None
    # Consigne de classement Mac (n8n exécute le déplacement) — chemin RELATIF à la racine compta.
    filing_path: Optional[str] = None       # ex. "Z Comptabilité 2026/6.FACTURE JUIN 2026"
    filing_filename: Optional[str] = None   # ex. "2026-06-18 – Facture EDF Gaz 10254498791.pdf"
