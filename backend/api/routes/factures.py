import re
import base64
from fastapi import APIRouter, HTTPException, Query, Depends, Header, File, UploadFile, Form
from typing import List, Optional
from uuid import UUID
from datetime import date, timedelta

from core.config import settings
from core.auth import get_current_user, verify_restaurant_owner
from models.facture import (
    SupplierInvoice, SupplierInvoiceCreate, SupplierInvoiceUpdate,
    InvoiceScanRequest, InvoiceScanResult, InvoiceIngestResult,
)
from agents.invoice_agent import parse_invoice, render_pdf_to_images
from services.payment_terms import compute_debit_date, supplier_delay_days
from supabase import create_client

router = APIRouter(prefix="/factures", tags=["factures"])

MONTHS_FR = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
             "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"]


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _norm(s: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _filing_target(supplier: str, date_iso: str, number: Optional[str], short_label: Optional[str]):
    """Chemin RELATIF (dossier + nom de fichier) où n8n doit classer la facture sur le Mac."""
    d = date.fromisoformat(date_iso)
    folder = f"Z Comptabilité {d.year}/{d.month}.FACTURE {MONTHS_FR[d.month - 1]} {d.year}"
    ident = (number or short_label or "").strip()
    raw = f"{date_iso} – Facture {supplier} {ident}".strip()
    fname = re.sub(r"\s+", " ", re.sub(r'[/\\:*?"<>|]', "-", raw)).strip() + ".pdf"
    return folder, fname


def _find_duplicate(supabase, rid: str, supplier: str, date_iso: str, number: Optional[str], ttc: float):
    """Dédoublonnage serveur : même n° de doc, sinon même fournisseur + date ±2j + TTC ±2€."""
    d = date.fromisoformat(date_iso)
    lo = (d - timedelta(days=7)).isoformat()
    hi = (d + timedelta(days=7)).isoformat()
    rows = (
        supabase.table("supplier_invoices")
        .select("id, supplier_name, invoice_number, invoice_date, total_ttc")
        .eq("restaurant_id", rid).gte("invoice_date", lo).lte("invoice_date", hi)
        .execute().data
    )
    nnum, nsup = _norm(number), _norm(supplier)
    for p in rows:
        if nnum and _norm(p.get("invoice_number")) == nnum:
            return p
        if nsup and _norm(p.get("supplier_name"))[:5] == nsup[:5] \
                and abs(float(p.get("total_ttc") or 0) - ttc) <= 2.0 \
                and abs((date.fromisoformat(p["invoice_date"]) - d).days) <= 2:
            return p
    return None


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

    # Totaux depuis les lignes = MARCHANDISES ; net à payer = + consignes − déconsignes.
    lines_data = [l.model_dump() for l in body.lines]
    total_ht, total_tva, marchandises_ttc = compute_totals(lines_data)
    consignes = round(float(body.consignes or 0), 2)
    deconsignes = round(float(body.deconsignes or 0), 2)
    net = round(marchandises_ttc + consignes - deconsignes, 2)

    # Date de prélèvement : saisie explicite respectée (relevé bancaire), sinon
    # règle bancaire fournisseur (Métro +10 j, Milliet +30 j, autres jour même, jour ouvré).
    due = body.due_date or compute_debit_date(body.supplier_name, body.invoice_date)

    # Insert invoice
    inv_data = {
        "restaurant_id": str(body.restaurant_id),
        "supplier_name": body.supplier_name,
        "invoice_number": body.invoice_number,
        "invoice_date": str(body.invoice_date),
        "due_date": str(due),
        "delivery_id": str(body.delivery_id) if body.delivery_id else None,
        "total_ht": total_ht,
        "total_tva": total_tva,
        "total_ttc": net,
        "consignes": consignes,
        "deconsignes": deconsignes,
        "category": body.category,
        "compte_comptable": body.compte_comptable,
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
# INGEST AUTO (n8n : Inbox → app) — clé machine, pas de login
# =====================

@router.post("/ingest", response_model=InvoiceIngestResult)
async def ingest_invoice(
    restaurant_id: UUID = Form(...),
    file: UploadFile = File(...),
    x_ingest_key: Optional[str] = Header(None, alias="X-Ingest-Key"),
):
    """Ingestion automatique d'un fichier facture déposé dans l'Inbox (appelé par n8n).

    OCR Vision → détection charge vs facture émise → dédup serveur → catégorie auto →
    insertion en statut 'pending' (à valider). Renvoie la consigne de classement Mac.
    N'INSÈRE jamais un doublon ni une facture émise.
    """
    # Comparaison tolérante aux espaces/retours-ligne parasites (copier-coller UI, etc.)
    server_key = (settings.ingest_api_key or "").strip()
    provided_key = (x_ingest_key or "").strip()
    if not server_key or provided_key != server_key:
        raise HTTPException(401, "Clé d'ingestion invalide")

    raw = await file.read()
    fname = file.filename or ""
    is_pdf = fname.lower().endswith(".pdf") or raw[:4] == b"%PDF"
    try:
        images = render_pdf_to_images(raw) if is_pdf else [base64.b64encode(raw).decode()]
    except Exception as e:
        return InvoiceIngestResult(status="unreadable", message=f"Fichier illisible : {e}")
    if not images:
        return InvoiceIngestResult(status="unreadable", message="Document vide")

    try:
        p = parse_invoice(images, filename_hint=fname)
    except Exception as e:
        return InvoiceIngestResult(status="needs_review", message=f"Échec OCR : {e}")

    doc_type = p.get("doc_type")
    supplier = (p.get("supplier_name") or "").strip()
    date_iso = p.get("invoice_date")
    number = p.get("invoice_number")
    conf = p.get("confidence")

    if doc_type == "emitted_sale":
        return InvoiceIngestResult(
            status="emitted_sale", doc_type=doc_type, supplier_name=supplier, confidence=conf,
            message="Facture ÉMISE (vente Le 5) — non comptabilisée en charge. À classer en Factures Émises.")
    if doc_type != "supplier_charge" or not date_iso or not supplier:
        return InvoiceIngestResult(
            status="needs_review", doc_type=doc_type, supplier_name=supplier, confidence=conf,
            message=f"Non reconnu comme facture d'achat exploitable ({p.get('notes') or 'données insuffisantes'}).")

    supabase = get_supabase()

    # Montants : HT/TVA/TTC = MARCHANDISES (base TVA). Le net à payer (ce qui est prélevé) =
    # TTC marchandises + consignes − déconsignes ; c'est LUI qu'on stocke en total_ttc (repère bancaire).
    lines = p.get("tva_lines") or [{"base_ht": p.get("total_ht") or p.get("total_ttc") or 0, "tva_rate": 20, "label": supplier}]
    ht = round(sum(float(l["base_ht"]) for l in lines), 2)
    tva = round(sum(float(l["base_ht"]) * float(l["tva_rate"]) / 100 for l in lines), 2)
    marchandises_ttc = round(ht + tva, 2)
    consignes = round(float(p.get("consignes") or 0), 2)
    deconsignes = round(float(p.get("deconsignes") or 0), 2)
    net_ocr = round(float(p.get("net_a_payer") or 0), 2)
    net = net_ocr if net_ocr > 0 else round(marchandises_ttc + consignes - deconsignes, 2)

    # Date de prélèvement : règle bancaire fournisseur (Métro +10 j, VDL +15 j,
    # Milliet +30 j, autres = jour même, reporté au jour ouvré suivant). Elle PRIME
    # sur l'échéance imprimée / lue par l'OCR — qui reste informative en note quand
    # elle diffère réellement (pas de note si le délai imprimé rejoint la règle,
    # ex. le « +15 j » VDL = la règle appliquée).
    due_iso = compute_debit_date(supplier, date.fromisoformat(date_iso)).isoformat()
    ocr_due = (p.get("due_date") or "").strip() if isinstance(p.get("due_date"), str) else ""
    if not ocr_due and p.get("payment_terms_days"):
        try:
            printed_delay = int(p["payment_terms_days"])
        except (TypeError, ValueError):
            printed_delay = None
        if printed_delay is not None and printed_delay != supplier_delay_days(supplier):
            ocr_due = f"+{printed_delay} j"

    folder, filing_name = _filing_target(supplier, date_iso, number, p.get("short_label"))

    dup = _find_duplicate(supabase, str(restaurant_id), supplier, date_iso, number, net)
    if dup:
        return InvoiceIngestResult(
            status="duplicate", doc_type=doc_type, supplier_name=supplier, invoice_number=number,
            invoice_date=date_iso, total_ttc=net, consignes=consignes, deconsignes=deconsignes,
            confidence=conf, filing_path=folder, filing_filename=filing_name,
            message=f"Doublon de {dup['supplier_name']} du {dup['invoice_date']} ({dup['total_ttc']} €). Non réinséré.")

    note = f"[ingest auto n8n | conf {conf} | paiement {p.get('payment_status')}]"
    if ocr_due and ocr_due != due_iso:
        note += f" [échéance imprimée {ocr_due} → prélèvement réel {due_iso} (règle bancaire)]"
    if consignes or deconsignes:
        note += f" [marchandises {marchandises_ttc} · consignes +{consignes} · déconsignes -{deconsignes} → net {net}]"
    if p.get("notes"):
        note += f" {p['notes']}"

    inv = supabase.table("supplier_invoices").insert({
        "restaurant_id": str(restaurant_id), "supplier_name": supplier,
        "invoice_number": number, "invoice_date": date_iso, "due_date": due_iso,
        "total_ht": ht, "total_tva": tva, "total_ttc": net,
        "consignes": consignes, "deconsignes": deconsignes,
        "status": "pending", "category": p.get("category", "matieres"),
        "compte_comptable": p.get("compte_comptable"), "notes": note,
    }).execute().data[0]
    for l in lines:
        supabase.table("supplier_invoice_lines").insert({
            "invoice_id": inv["id"], "description": (l.get("label") or supplier)[:120],
            "quantity": 1, "unit": "unite",
            "unit_price_ht": round(float(l["base_ht"]), 2), "tva_rate": float(l["tva_rate"]),
        }).execute()

    status = "created_low_confidence" if conf == "low" else "created"
    return InvoiceIngestResult(
        status=status, doc_type=doc_type, invoice_id=inv["id"], supplier_name=supplier,
        invoice_number=number, invoice_date=date_iso, category=p.get("category"),
        compte_comptable=p.get("compte_comptable"),
        total_ttc=net, consignes=consignes, deconsignes=deconsignes,
        confidence=conf, filing_path=folder, filing_filename=filing_name,
        message="Insérée en statut à valider." + (" Confiance faible → à revérifier." if conf == "low" else ""))


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

    # Si la date de facture ou le fournisseur change sans due_date explicite,
    # on recalcule la date de prélèvement selon la règle bancaire fournisseur.
    if "due_date" not in updates and ("invoice_date" in updates or "supplier_name" in updates):
        current = (
            supabase.table("supplier_invoices")
            .select("supplier_name, invoice_date")
            .eq("id", str(invoice_id)).eq("restaurant_id", str(restaurant_id))
            .single().execute().data
        )
        if current:
            supplier = updates.get("supplier_name") or current["supplier_name"]
            inv_date = date.fromisoformat(str(updates.get("invoice_date") or current["invoice_date"]))
            updates["due_date"] = compute_debit_date(supplier, inv_date).isoformat()

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
