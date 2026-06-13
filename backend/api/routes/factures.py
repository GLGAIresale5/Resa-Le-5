from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.facture import (
    SupplierInvoice, SupplierInvoiceCreate, SupplierInvoiceUpdate,
    InvoiceScanRequest, InvoiceScanResult,
)
from supabase import create_client

router = APIRouter(prefix="/factures", tags=["factures"])


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


def compute_totals(lines: list) -> tuple[float, float, float]:
    """Compute total_ht, total_tva, total_ttc from line items."""
    total_ht = sum(round(l["quantity"] * l["unit_price_ht"], 2) for l in lines)
    total_tva = sum(round(l["quantity"] * l["unit_price_ht"] * l["tva_rate"] / 100, 2) for l in lines)
    total_ttc = total_ht + total_tva
    return round(total_ht, 2), round(total_tva, 2), round(total_ttc, 2)


# =====================
# LIST / GET
# =====================

@router.get("/", response_model=List[SupplierInvoice])
async def list_invoices(
    restaurant_id: UUID = Query(...),
    status: Optional[str] = None,
    supplier: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    query = (
        supabase.table("supplier_invoices")
        .select("*, supplier_invoice_lines(*)")
        .eq("restaurant_id", str(restaurant_id))
        .order("invoice_date", desc=True)
    )
    if status:
        query = query.eq("status", status)
    if supplier:
        query = query.ilike("supplier_name", f"%{supplier}%")
    if date_from:
        query = query.gte("invoice_date", str(date_from))
    if date_to:
        query = query.lte("invoice_date", str(date_to))

    data = query.execute().data

    # Map nested lines
    for inv in data:
        inv["lines"] = inv.pop("supplier_invoice_lines", [])

    return data


@router.get("/{invoice_id}", response_model=SupplierInvoice)
async def get_invoice(
    invoice_id: UUID,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    data = (
        supabase.table("supplier_invoices")
        .select("*, supplier_invoice_lines(*)")
        .eq("id", str(invoice_id))
        .eq("restaurant_id", str(restaurant_id))
        .single()
        .execute()
        .data
    )
    if not data:
        raise HTTPException(404, "Facture introuvable")

    data["lines"] = data.pop("supplier_invoice_lines", [])
    return data


# =====================
# CREATE
# =====================

@router.post("/", response_model=SupplierInvoice)
async def create_invoice(
    body: SupplierInvoiceCreate,
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()

    # Compute totals from lines
    lines_data = [l.model_dump() for l in body.lines]
    total_ht, total_tva, total_ttc = compute_totals(lines_data)

    # Insert invoice
    inv_data = {
        "restaurant_id": str(body.restaurant_id),
        "supplier_name": body.supplier_name,
        "invoice_number": body.invoice_number,
        "invoice_date": str(body.invoice_date),
        "due_date": str(body.due_date) if body.due_date else None,
        "delivery_id": str(body.delivery_id) if body.delivery_id else None,
        "total_ht": total_ht,
        "total_tva": total_tva,
        "total_ttc": total_ttc,
        "notes": body.notes,
    }
    inv = supabase.table("supplier_invoices").insert(inv_data).execute().data[0]

    # Insert lines
    created_lines = []
    for line in lines_data:
        line_row = {
            "invoice_id": inv["id"],
            "stock_item_id": str(line["stock_item_id"]) if line.get("stock_item_id") else None,
            "description": line["description"],
            "quantity": line["quantity"],
            "unit": line.get("unit", "unite"),
            "unit_price_ht": line["unit_price_ht"],
            "tva_rate": line.get("tva_rate", 20.0),
        }
        created = supabase.table("supplier_invoice_lines").insert(line_row).execute().data[0]
        created_lines.append(created)

    inv["lines"] = created_lines
    return inv


# =====================
# UPDATE
# =====================

@router.patch("/{invoice_id}", response_model=SupplierInvoice)
async def update_invoice(
    invoice_id: UUID,
    body: SupplierInvoiceUpdate,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "invoice_date" in updates:
        updates["invoice_date"] = str(updates["invoice_date"])
    if "due_date" in updates:
        updates["due_date"] = str(updates["due_date"])
    if "delivery_id" in updates:
        updates["delivery_id"] = str(updates["delivery_id"])

    if not updates:
        raise HTTPException(400, "Aucune modification")

    supabase.table("supplier_invoices").update(updates).eq("id", str(invoice_id)).eq("restaurant_id", str(restaurant_id)).execute()

    return await get_invoice(invoice_id, restaurant_id, user_id)


# =====================
# UPDATE STATUS (shortcut)
# =====================

@router.patch("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: UUID,
    status: str = Query(...),
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    if status not in ("pending", "validated", "paid", "disputed"):
        raise HTTPException(400, "Statut invalide")

    supabase = get_supabase()
    supabase.table("supplier_invoices").update({"status": status}).eq("id", str(invoice_id)).eq("restaurant_id", str(restaurant_id)).execute()
    return {"status": status}


# =====================
# DELETE
# =====================

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: UUID,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    # Lines cascade-delete via FK
    supabase.table("supplier_invoices").delete().eq("id", str(invoice_id)).eq("restaurant_id", str(restaurant_id)).execute()
    return {"deleted": True}


# =====================
# ADD / REMOVE LINES
# =====================

@router.post("/{invoice_id}/lines")
async def add_invoice_line(
    invoice_id: UUID,
    description: str = Query(...),
    quantity: float = Query(1),
    unit: str = Query("unite"),
    unit_price_ht: float = Query(...),
    tva_rate: float = Query(20.0),
    stock_item_id: Optional[UUID] = None,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    line_row = {
        "invoice_id": str(invoice_id),
        "stock_item_id": str(stock_item_id) if stock_item_id else None,
        "description": description,
        "quantity": quantity,
        "unit": unit,
        "unit_price_ht": unit_price_ht,
        "tva_rate": tva_rate,
    }
    created = supabase.table("supplier_invoice_lines").insert(line_row).execute().data[0]

    # Recalculate invoice totals
    await _recalculate_invoice_totals(supabase, str(invoice_id))

    return created


@router.delete("/{invoice_id}/lines/{line_id}")
async def remove_invoice_line(
    invoice_id: UUID,
    line_id: UUID,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    supabase.table("supplier_invoice_lines").delete().eq("id", str(line_id)).eq("invoice_id", str(invoice_id)).execute()
    await _recalculate_invoice_totals(supabase, str(invoice_id))
    return {"deleted": True}


# =====================
# STATS
# =====================

@router.get("/stats/summary")
async def invoice_stats(
    restaurant_id: UUID = Query(...),
    month: Optional[str] = None,  # "2026-04"
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    query = (
        supabase.table("supplier_invoices")
        .select("status, total_ht, total_ttc, supplier_name, invoice_date")
        .eq("restaurant_id", str(restaurant_id))
    )
    if month:
        query = query.gte("invoice_date", f"{month}-01").lte("invoice_date", f"{month}-31")

    data = query.execute().data

    total_ht = sum(float(inv["total_ht"] or 0) for inv in data)
    total_ttc = sum(float(inv["total_ttc"] or 0) for inv in data)
    by_supplier = {}
    by_status = {"pending": 0, "validated": 0, "paid": 0, "disputed": 0}
    for inv in data:
        s = inv["supplier_name"]
        by_supplier[s] = by_supplier.get(s, 0) + float(inv["total_ht"] or 0)
        by_status[inv["status"]] = by_status.get(inv["status"], 0) + 1

    return {
        "count": len(data),
        "total_ht": round(total_ht, 2),
        "total_ttc": round(total_ttc, 2),
        "by_supplier": by_supplier,
        "by_status": by_status,
    }


# =====================
# HELPERS
# =====================

async def _recalculate_invoice_totals(supabase, invoice_id: str):
    """Recalculate invoice totals from its lines."""
    lines = supabase.table("supplier_invoice_lines").select("*").eq("invoice_id", invoice_id).execute().data
    total_ht = sum(float(l.get("total_ht") or l["quantity"] * l["unit_price_ht"]) for l in lines)
    total_tva = sum(float(l.get("total_tva") or l["quantity"] * l["unit_price_ht"] * l["tva_rate"] / 100) for l in lines)
    total_ttc = total_ht + total_tva
    supabase.table("supplier_invoices").update({
        "total_ht": round(total_ht, 2),
        "total_tva": round(total_tva, 2),
        "total_ttc": round(total_ttc, 2),
    }).eq("id", invoice_id).execute()
