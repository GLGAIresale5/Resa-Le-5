from fastapi import APIRouter, Query, Depends
from uuid import UUID
from datetime import date, timedelta
from calendar import monthrange

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.revenue import aggregate_revenue_for_range
from models.facture import BOOKED_STATUSES
from supabase import create_client

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


@router.get("/summary")
async def dashboard_summary(
    restaurant_id: UUID = Query(...),
    month: str = Query(None, description="YYYY-MM, defaults to current month"),
    user_id: str = Depends(get_current_user),
):
    """Aggregated dashboard data: invoices, stocks, charges, weekly purchases."""
    await verify_restaurant_owner(user_id, str(restaurant_id))
    supabase = get_supabase()
    rid = str(restaurant_id)

    if not month:
        month = date.today().strftime("%Y-%m")

    year, mnum = int(month.split("-")[0]), int(month.split("-")[1])
    month_start = date(year, mnum, 1)
    month_end = date(year, mnum, monthrange(year, mnum)[1])

    # --- Revenue this month (aggregated from revenue_entries) ---
    rev_entries = (
        supabase.table("revenue_entries")
        .select("*")
        .eq("restaurant_id", rid)
        .gte("period_end", month_start.isoformat())
        .lte("period_start", month_end.isoformat())
        .execute()
        .data
    )
    rev_agg = aggregate_revenue_for_range(rev_entries, month_start, month_end)
    revenue_ht = rev_agg["revenue_ht"]
    revenue_ttc = rev_agg["revenue_ttc"]

    # --- Invoices this month ---
    invoices = (
        supabase.table("supplier_invoices")
        .select("total_ht, total_ttc, status, invoice_date, supplier_name, category")
        .eq("restaurant_id", rid)
        .gte("invoice_date", month_start.isoformat())
        .lte("invoice_date", month_end.isoformat())
        .execute()
        .data
    )

    # Seules les factures comptabilisées comptent dans les montants du bilan.
    # 'invoices' reste la liste complète du mois pour signaler les "à comptabiliser".
    booked = [inv for inv in invoices if inv.get("status") in BOOKED_STATUSES]
    pending_count = sum(1 for inv in invoices if inv["status"] == "pending")

    purchases_ht = sum(float(inv.get("total_ht") or 0) for inv in booked)
    purchases_ttc = sum(float(inv.get("total_ttc") or 0) for inv in booked)
    invoice_count = len(booked)

    # --- Stock items count + alerts ---
    stock_items = (
        supabase.table("stock_items")
        .select("id, stock_current, stock_min, stock_reorder")
        .eq("restaurant_id", rid)
        .execute()
        .data
    )
    stock_count = len(stock_items)
    alerts_critical = sum(1 for s in stock_items if s["stock_current"] <= s["stock_min"])
    alerts_warning = sum(
        1 for s in stock_items
        if s["stock_current"] > s["stock_min"]
        and s.get("stock_reorder")
        and s["stock_current"] <= s["stock_reorder"]
    )

    # --- Fixed charges ---
    charges = (
        supabase.table("fixed_charges")
        .select("amount")
        .eq("restaurant_id", rid)
        .execute()
        .data
    )
    fixed_charges = sum(float(c.get("amount") or 0) for c in charges)

    # --- Weekly purchases (last 4 weeks from invoices) ---
    today = date.today()
    weekly = []
    for i in range(3, -1, -1):
        week_end = today - timedelta(days=today.weekday()) - timedelta(weeks=i)
        week_start = week_end - timedelta(days=6)
        week_total = sum(
            float(inv.get("total_ht") or 0)
            for inv in booked
            if week_start.isoformat() <= inv["invoice_date"] <= week_end.isoformat()
        )
        week_num = week_start.isocalendar()[1]
        weekly.append({"label": f"S{week_num}", "value": round(week_total, 2)})

    # --- Top suppliers this month ---
    supplier_totals: dict[str, float] = {}
    for inv in booked:
        name = inv.get("supplier_name", "Inconnu")
        supplier_totals[name] = supplier_totals.get(name, 0) + float(inv.get("total_ht") or 0)
    top_suppliers = sorted(
        [{"name": k, "total_ht": round(v, 2)} for k, v in supplier_totals.items()],
        key=lambda x: x["total_ht"],
        reverse=True,
    )[:5]

    # Marge brute = CA − matières uniquement ; résultat net déduit aussi les charges d'exploitation.
    matieres_ht = sum(float(inv.get("total_ht") or 0) for inv in booked if (inv.get("category") or "matieres") == "matieres")
    exploitation_ht = sum(float(inv.get("total_ht") or 0) for inv in booked if inv.get("category") == "exploitation")
    gross_margin = revenue_ht - matieres_ht
    margin_pct = (gross_margin / revenue_ht * 100) if revenue_ht > 0 else 0
    net_result = gross_margin - exploitation_ht - fixed_charges

    return {
        "month": month,
        "revenue_ht": round(revenue_ht, 2),
        "revenue_ttc": round(revenue_ttc, 2) if revenue_ttc else None,
        "gross_margin_ht": round(gross_margin, 2),
        "margin_pct": round(margin_pct, 1),
        "net_result": round(net_result, 2),
        "purchases_ht": round(purchases_ht, 2),
        "purchases_matieres": round(matieres_ht, 2),
        "purchases_ttc": round(purchases_ttc, 2),
        "invoice_count": invoice_count,
        "pending_invoices": pending_count,
        "stock_count": stock_count,
        "stock_alerts_critical": alerts_critical,
        "stock_alerts_warning": alerts_warning,
        "fixed_charges": round(fixed_charges, 2),
        "weekly_purchases": weekly,
        "top_suppliers": top_suppliers,
        "revenue_sources": rev_agg["sources_used"],
    }
