import anthropic
import json
import resend
from typing import List, Optional
from core.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

ALERT_EMAIL_TO = "glhhospitalitypro@gmail.com"
CATEGORIES_FR = {
    "soft": "Soft & Jus",
    "spiritueux": "Spiritueux",
    "bieres": "Bières",
    "vins": "Vins",
    "frais": "Frais",
}


# =====================
# OCR BON DE LIVRAISON
# =====================

def parse_delivery_note(
    image_base64: str,
    media_type: str,
    catalogue: List[dict],
) -> dict:
    """
    Analyse une photo de bon de livraison avec Claude Vision.
    Retourne les articles extraits avec correspondance dans le catalogue.
    """
    catalogue_str = "\n".join(
        f"- id={item['id']} | {item['name']} {item['brand'] or ''} | unité: {item['unit']}"
        for item in catalogue
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"""Tu es un assistant pour un restaurant. Analyse ce bon de livraison et extrais les informations.

Voici le catalogue des produits du bar :
{catalogue_str}

Pour chaque article du bon de livraison :
1. Identifie le nom du produit et la quantité livrée
2. Essaie de faire correspondre avec un article du catalogue (donne le matched_stock_item_id si trouvé)
3. Note le prix unitaire si visible

Réponds UNIQUEMENT avec un JSON valide, sans markdown, dans ce format exact :
{{
  "supplier_name": "nom du fournisseur si visible, sinon null",
  "delivery_date": "date si visible au format YYYY-MM-DD, sinon null",
  "raw_text": "texte brut extrait du bon",
  "items": [
    {{
      "item_name": "nom exact sur le BL",
      "quantity": 6,
      "unit_price": 12.50,
      "matched_stock_item_id": "uuid ou null"
    }}
  ]
}}""",
                    },
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Nettoyer si Claude a quand même mis du markdown
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# =====================
# AGENT CHAT INTELLIGENT
# =====================

def stock_chat(
    messages: List[dict],
    stock_items: List[dict],
    reservations_count: Optional[int] = None,
    weather: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """
    Agent conversationnel qui conseille sur la gestion des stocks.
    Intègre le contexte : stocks actuels, réservations, météo, notes.
    """
    # Construire le résumé des stocks
    critical = [i for i in stock_items if i["stock_current"] < i["stock_min"]]
    warning_threshold = lambda i: (i.get("stock_reorder") or i["stock_min"] * 2)
    warning = [
        i for i in stock_items
        if i["stock_min"] <= i["stock_current"] < warning_threshold(i)
    ]

    stocks_summary = "=== STOCKS ACTUELS ===\n"
    for cat_key, cat_name in CATEGORIES_FR.items():
        items = [i for i in stock_items if i["category"] == cat_key]
        if not items:
            continue
        stocks_summary += f"\n{cat_name}:\n"
        for item in items:
            status = ""
            if item["stock_current"] < item["stock_min"]:
                status = " 🔴 RUPTURE IMMINENTE"
            elif item["stock_current"] < warning_threshold(item):
                status = " ⚠️ À COMMANDER"
            stocks_summary += (
                f"  - {item['name']}"
                + (f" ({item['brand']})" if item.get('brand') else "")
                + f" : {item['stock_current']} {item['unit']}"
                + f" [min: {item['stock_min']}]"
                + status + "\n"
            )

    context_parts = []
    if reservations_count is not None:
        context_parts.append(f"Couverts prévus : {reservations_count}")
    if weather:
        context_parts.append(f"Météo : {weather}")
    if notes:
        context_parts.append(f"Notes : {notes}")
    context_str = "\n".join(context_parts) if context_parts else "Aucun contexte supplémentaire."

    system_prompt = f"""Tu es l'agent de gestion des stocks du restaurant Le 5, un bistrot moderne à Montpellier.
Tu aides Baptiste, le gérant, à gérer ses stocks de bar de façon intelligente.

{stocks_summary}

=== CONTEXTE DU SERVICE ===
{context_str}

Tu dois :
- Analyser les stocks en fonction du contexte (réservations, météo, saisonnalité)
- Suggérer ce qu'il faut commander en priorité
- Alerter sur les risques de rupture
- Répondre de façon directe, pratique et concise
- Tenir compte du ressenti de Baptiste quand il en parle

Parle en français, sois direct et actionnable."""

    api_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=api_messages,
    )

    return response.content[0].text


# =====================
# OCR TICKET Z (ventes journalières)
# =====================

def parse_z_report(
    image_base64: str,
    media_type: str,
    catalogue: list,
) -> dict:
    """
    Analyse un ticket Z ou rapport journalier de caisse avec Claude Vision.
    Retourne les quantités vendues par produit avec correspondance catalogue.
    """
    catalogue_str = "\n".join(
        f"- id={item['id']} | {item['name']} {item['brand'] or ''} | unité: {item['unit']}"
        for item in catalogue
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"""Tu es un assistant pour un restaurant. Analyse ce ticket Z ou rapport de ventes journalier et extrais les produits vendus dans la journée.

Voici le catalogue des produits du bar :
{catalogue_str}

Pour chaque produit vendu :
1. Identifie le nom du produit et la quantité vendue dans la journée
2. Essaie de faire correspondre avec un article du catalogue (donne le matched_stock_item_id si trouvé)
3. Si les ventes sont en cl, convertis en bouteilles selon le volume standard du produit

Important :
- Ce ticket montre des ventes, pas des stocks — extrais uniquement les quantités vendues
- Si un produit n'a pas de correspondance dans le catalogue, matched_stock_item_id = null
- La date peut apparaître en haut du ticket

Réponds UNIQUEMENT avec un JSON valide, sans markdown, dans ce format exact :
{{
  "sale_date": "date si visible au format YYYY-MM-DD, sinon null",
  "raw_text": "texte brut extrait du ticket",
  "items": [
    {{
      "item_name": "nom exact sur le ticket",
      "quantity_sold": 3.5,
      "matched_stock_item_id": "uuid ou null"
    }}
  ]
}}""",
                    },
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _sale_month(sale_date) -> int:
    """Retourne le mois d'une date (str ISO ou objet date)."""
    if isinstance(sale_date, str):
        return int(sale_date[5:7])
    return sale_date.month


def compute_auto_thresholds(
    item_id: str,
    daily_sales: list,
    min_days: int = 7,
    mode: str = "equilibre",
) -> Optional[dict]:
    """
    Calcule stock_min et stock_reorder depuis l'historique de ventes.
    Prend en compte la saisonnalité : juillet et août sont des mois de haute saison.
    Applique un coefficient selon le mode de gestion :
      - flux_tendu : ×0.80 (moins de stock, risque de rupture plus élevé)
      - equilibre  : ×1.00 (calcul de base)
      - stock      : ×1.30 (plus de stock, risque de rupture réduit)
    Retourne None si pas assez de données (< min_days jours).
    """
    from datetime import date as _date

    if len(daily_sales) < min_days:
        return None

    MODE_COEFFICIENTS = {"flux_tendu": 0.80, "equilibre": 1.00, "stock": 1.30}
    mode_coeff = MODE_COEFFICIENTS.get(mode, 1.00)

    PEAK_MONTHS = {7, 8}
    PEAK_COEFFICIENT = 1.5

    current_month = _date.today().month
    is_peak_period = current_month in PEAK_MONTHS

    peak_sales = [s for s in daily_sales if _sale_month(s["sale_date"]) in PEAK_MONTHS]
    all_quantities = [float(s["quantity_sold"]) for s in daily_sales]
    avg_daily = sum(all_quantities) / len(all_quantities)
    max_daily = max(all_quantities)

    if is_peak_period and len(peak_sales) >= min_days:
        peak_quantities = [float(s["quantity_sold"]) for s in peak_sales]
        avg_daily = sum(peak_quantities) / len(peak_quantities)
        max_daily = max(peak_quantities)
    elif is_peak_period and len(peak_sales) > 0:
        peak_quantities = [float(s["quantity_sold"]) for s in peak_sales]
        peak_avg = sum(peak_quantities) / len(peak_quantities)
        avg_daily = max(avg_daily * PEAK_COEFFICIENT, peak_avg)
        max_daily = max(max_daily * PEAK_COEFFICIENT, max(peak_quantities))
    elif is_peak_period:
        avg_daily = avg_daily * PEAK_COEFFICIENT
        max_daily = max_daily * PEAK_COEFFICIENT

    # stock_min = max journalier + 20% de buffer, ajusté selon le mode
    stock_min = round(max_daily * 1.2 * mode_coeff, 2)
    # stock_reorder = 3 jours de consommation moyenne, ajusté selon le mode
    stock_reorder = round(avg_daily * 3 * mode_coeff, 2)

    if stock_reorder <= stock_min:
        stock_reorder = round(stock_min * 2, 2)

    return {
        "stock_min": max(stock_min, 0.25),
        "stock_reorder": max(stock_reorder, 0.5),
    }


# =====================
# ALERTES EMAIL
# =====================

def send_alert_email(critical_items: List[dict], warning_items: List[dict]) -> bool:
    """
    Envoie un email d'alerte via Resend quand des articles passent sous les seuils.
    Requiert RESEND_API_KEY dans les variables d'env.
    """
    if not settings.resend_api_key:
        print("⚠️  Email non configuré (RESEND_API_KEY manquant)")
        return False

    if not critical_items and not warning_items:
        return False

    subject = "⚠️ Alerte stocks Le 5"
    if critical_items:
        subject = f"🔴 Rupture imminente — {len(critical_items)} article(s) critique(s) — Le 5"

    html_parts = [
        "<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto;'>",
        "<h2 style='color: #18181b;'>Alerte stocks — Le 5</h2>",
    ]

    if critical_items:
        html_parts.append("<h3 style='color: #ef4444;'>🔴 Rupture imminente</h3><ul>")
        for item in critical_items:
            html_parts.append(
                f"<li><strong>{item['name']}"
                + (f" ({item['brand']})" if item.get('brand') else "")
                + f"</strong> : {item['stock_current']} {item['unit']} "
                + f"<span style='color:#9ca3af'>(seuil min : {item['stock_min']})</span></li>"
            )
        html_parts.append("</ul>")

    if warning_items:
        html_parts.append("<h3 style='color: #f59e0b;'>⚠️ À commander</h3><ul>")
        for item in warning_items:
            html_parts.append(
                f"<li><strong>{item['name']}"
                + (f" ({item['brand']})" if item.get('brand') else "")
                + f"</strong> : {item['stock_current']} {item['unit']} "
                + f"<span style='color:#9ca3af'>(seuil : {item.get('stock_reorder') or item['stock_min'] * 2})</span></li>"
            )
        html_parts.append("</ul>")

    html_parts.append("<p style='color:#9ca3af; font-size:12px; margin-top:32px;'>GLG AI — Agent Stocks</p></div>")

    try:
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": "GLG AI <onboarding@resend.dev>",
            "to": [ALERT_EMAIL_TO],
            "subject": subject,
            "html": "\n".join(html_parts),
        })
        return True
    except Exception as e:
        print(f"Erreur envoi email Resend : {e}")
        return False


# =====================
# VÉRIFICATION DES ALERTES
# =====================

def check_and_alert(stock_items: List[dict]) -> dict:
    """
    Vérifie les niveaux et envoie une alerte email si nécessaire.
    Retourne un résumé des alertes.
    """
    critical = [
        i for i in stock_items
        if i["stock_current"] <= 0
    ]
    warning = [
        i for i in stock_items
        if 0 < i["stock_current"] <= i["stock_min"]
    ]

    email_sent = False
    if critical or warning:
        email_sent = send_alert_email(critical, warning)

    return {
        "critical_count": len(critical),
        "warning_count": len(warning),
        "email_sent": email_sent,
        "critical_items": [i["name"] for i in critical],
        "warning_items": [i["name"] for i in warning],
    }
