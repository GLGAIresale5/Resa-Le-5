from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.compta import (
    MonthlyPnL, TvaBreakdown, SupplierBreakdown, CategoryBreakdown,
    ChargeFixe, ChargeFixeCreate, ChargeFixeUpdate,
)
from models.facture import BOOKED_STATUSES
from models.revenue import aggregate_revenue_for_range
from supabase import create_client
from calendar import monthrange

router = APIRouter(prefix="/compta", tags=["compta"])

# Postes de dépense. Seules les "matières" entrent dans la marge brute.
CATEGORY_LABELS = {
    "matieres": "Matières premières",
    "exploitation": "Charges d'exploitation",
    "equipement": "Équipement / matériel",
    "hors_resto": "Hors restaurant",
}


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


# =====================
# MONTHLY P&L
# =====================

@router.get("/monthly", response_model=MonthlyPnL)
async def monthly_pnl(
    restaurant_id: UUID = Query(...),
    month: str = Query(..., description="Format YYYY-MM"),
    revenue_ht: Optional[float] = Query(None, description="Si fourni, override le CA calculé depuis revenue_entries"),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()

    # Compute month bounds
    year, mnum = int(month.split("-")[0]), int(month.split("-")[1])
    month_start = date(year, mnum, 1)
    month_end = date(year, mnum, monthrange(year, mnum)[1])

    # Auto-fetch revenue from revenue_entries unless overridden
    if revenue_ht is None:
        rev_entries = (
            supabase.table("revenue_entries")
            .select("*")
            .eq("restaurant_id", str(restaurant_id))
            .gte("period_end", month_start.isoformat())
            .lte("period_start", month_end.isoformat())
            .execute()
            .data
        )
        agg = aggregate_revenue_for_range(rev_entries, month_start, month_end)
        revenue_ht = agg["revenue_ht"]

    # Fetch supplier invoices for this month.
    # Seules les factures COMPTABILISÉES entrent dans le bilan : on exclut
    # 'pending' (à comptabiliser) et 'disputed' (litige) — cohérent avec la TVA
    # réellement déclarée, qui ne porte que sur les factures validées.
    invoices = (
        supabase.table("supplier_invoices")
        .select("*, supplier_invoice_lines(*)")
        .eq("restaurant_id", str(restaurant_id))
        .in_("status", list(BOOKED_STATUSES))
        .gte("invoice_date", month_start.isoformat())
        .lte("invoice_date", month_end.isoformat())
        .execute()
        .data
    )

    # TVA breakdown
    tva_map: dict[float, dict] = {}
    supplier_map: dict[str, dict] = {}
    cat_map: dict[str, dict] = {}

    total_purchases_ht = 0.0
    total_purchases_ttc = 0.0

    for inv in invoices:
        s_name = inv["supplier_name"]
        inv_ht = float(inv.get("total_ht") or 0)
        inv_ttc = float(inv.get("total_ttc") or 0)
        cat = inv.get("category") or "matieres"
        total_purchases_ht += inv_ht
        total_purchases_ttc += inv_ttc

        # Supplier breakdown
        if s_name not in supplier_map:
            supplier_map[s_name] = {"supplier_name": s_name, "total_ht": 0, "total_ttc": 0, "invoice_count": 0}
        supplier_map[s_name]["total_ht"] += inv_ht
        supplier_map[s_name]["total_ttc"] += inv_ttc
        supplier_map[s_name]["invoice_count"] += 1

        # Category breakdown
        if cat not in cat_map:
            cat_map[cat] = {"category": cat, "label": CATEGORY_LABELS.get(cat, cat), "total_ht": 0, "total_ttc": 0, "invoice_count": 0}
        cat_map[cat]["total_ht"] += inv_ht
        cat_map[cat]["total_ttc"] += inv_ttc
        cat_map[cat]["invoice_count"] += 1

        # TVA from lines
        for line in inv.get("supplier_invoice_lines", []):
            rate = float(line.get("tva_rate", 20))
            line_ht = float(line.get("total_ht") or line["quantity"] * line["unit_price_ht"])
            line_tva = float(line.get("total_tva") or line_ht * rate / 100)
            line_ttc = line_ht + line_tva

            if rate not in tva_map:
                tva_map[rate] = {"tva_rate": rate, "total_ht": 0, "total_tva": 0, "total_ttc": 0, "invoice_count": 0}
            tva_map[rate]["total_ht"] += line_ht
            tva_map[rate]["total_tva"] += line_tva
            tva_map[rate]["total_ttc"] += line_ttc
            tva_map[rate]["invoice_count"] += 1

    # Fixed charges
    charges = (
        supabase.table("fixed_charges")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    )
    fixed_total = sum(float(c.get("amount", 0)) for c in charges)

    # Ventilation par poste (HT)
    matieres = cat_map.get("matieres", {}).get("total_ht", 0.0)
    exploitation = cat_map.get("exploitation", {}).get("total_ht", 0.0)
    equipement = cat_map.get("equipement", {}).get("total_ht", 0.0)
    hors_resto = cat_map.get("hors_resto", {}).get("total_ht", 0.0)

    # P&L : marge brute = CA − matières ; résultat net = marge − charges d'exploitation − charges fixes.
    # Équipement (investissement) et hors-resto (perso/véhicule) sont exclus du résultat d'exploitation.
    gross_margin = revenue_ht - matieres
    margin_pct = (gross_margin / revenue_ht * 100) if revenue_ht > 0 else 0
    net_result = gross_margin - exploitation - fixed_total

    cat_order = {"matieres": 0, "exploitation": 1, "equipement": 2, "hors_resto": 3}

    return MonthlyPnL(
        month=month,
        revenue_ht=round(revenue_ht, 2),
        purchases_ht=round(total_purchases_ht, 2),
        purchases_ttc=round(total_purchases_ttc, 2),
        purchases_matieres=round(matieres, 2),
        charges_exploitation=round(exploitation, 2),
        purchases_equipement=round(equipement, 2),
        purchases_hors_resto=round(hors_resto, 2),
        gross_margin_ht=round(gross_margin, 2),
        margin_pct=round(margin_pct, 1),
        fixed_charges=round(fixed_total, 2),
        net_result=round(net_result, 2),
        tva_breakdown=[TvaBreakdown(**{k: round(v, 2) if isinstance(v, float) else v for k, v in t.items()}) for t in sorted(tva_map.values(), key=lambda x: x["tva_rate"])],
        supplier_breakdown=[SupplierBreakdown(**{k: round(v, 2) if isinstance(v, float) else v for k, v in s.items()}) for s in sorted(supplier_map.values(), key=lambda x: x["total_ht"], reverse=True)],
        category_breakdown=[CategoryBreakdown(**{k: round(v, 2) if isinstance(v, float) else v for k, v in c.items()}) for c in sorted(cat_map.values(), key=lambda x: cat_order.get(x["category"], 99))],
    )


# =====================
# FIXED CHARGES CRUD
# =====================

@router.get("/charges", response_model=List[ChargeFixe])
async def list_charges(
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    data = (
        supabase.table("fixed_charges")
        .select("*")
        .eq("restaurant_id", str(restaurant_id))
        .order("category")
        .execute()
        .data
    )
    return data


@router.post("/charges", response_model=ChargeFixe)
async def create_charge(
    body: ChargeFixeCreate,
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(body.restaurant_id))
    supabase = get_supabase()
    data = supabase.table("fixed_charges").insert({
        "restaurant_id": str(body.restaurant_id),
        "label": body.label,
        "amount": body.amount,
        "category": body.category,
        "notes": body.notes,
    }).execute().data[0]
    return data


@router.patch("/charges/{charge_id}", response_model=ChargeFixe)
async def update_charge(
    charge_id: UUID,
    body: ChargeFixeUpdate,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucune modification")
    # Scopé sur le restaurant : impossible de modifier la charge d'un autre tenant.
    data = (
        supabase.table("fixed_charges")
        .update(updates)
        .eq("id", str(charge_id))
        .eq("restaurant_id", str(restaurant_id))
        .execute()
        .data
    )
    if not data:
        raise HTTPException(404, "Charge introuvable")
    return data[0]


@router.delete("/charges/{charge_id}")
async def delete_charge(
    charge_id: UUID,
    restaurant_id: UUID = Query(...),
    user_id: str = Depends(get_current_user),
):
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    # Scopé sur le restaurant : impossible de supprimer la charge d'un autre tenant.
    supabase.table("fixed_charges").delete().eq("id", str(charge_id)).eq("restaurant_id", str(restaurant_id)).execute()
    return {"deleted": True}
