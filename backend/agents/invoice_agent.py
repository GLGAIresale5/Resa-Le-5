"""OCR facture fournisseur via Claude Vision + rendu PDF.

Utilisé par l'endpoint d'ingestion automatique (n8n → /factures/ingest).
Reprend le pattern de agents/stock_agent.py (parse_z_report / parse_delivery_note).
"""
import base64
import json
import anthropic
import fitz  # PyMuPDF — rendu PDF -> image, wheel autonome (OK Render)

from core.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


# Grille catégorie (défaut ; l'IA ajuste selon le CONTENU réel des articles)
CATEGORY_GUIDE = """Grille des 4 postes :
- matieres    = nourriture / boisson revendue (Métro, Milliet, Viandes du Lys, Pétrin, Lavazza, Lidl,
                Carrefour/Costco/Picard SI le contenu est alimentaire, traiteurs).
- exploitation = charges qui font tourner le resto (EDF, Suez, énergie, Anthropic, télécom pro,
                fournitures, entretien, repas d'équipe/affaires pris à l'extérieur).
- equipement  = investissement durable (matériel, mobilier, électroménager, petit outillage,
                consommables de caisse).
- hors_resto  = perso / véhicule (carburant, vêtements, ligne mobile perso).
« matieres » est le SEUL poste qui entre dans la marge brute. En cas de doute alimentaire vs
équipement, tranche selon les ARTICLES dominants."""


# Une facture/ticket tient sur 1–3 pages ; on plafonne l'envoi pour rester sous la
# limite de taille de requête de l'API (un récap multi-pages se détecte dès la p.1).
# JPEG (pas PNG) : bien plus léger pour des pages scannées/photographiées.
MAX_PAGES_SENT = 3
IMAGE_MEDIA_TYPE = "image/jpeg"


def render_pdf_to_images(pdf_bytes: bytes, max_pages: int = MAX_PAGES_SENT, zoom: float = 1.6) -> list[str]:
    """Rend les premières pages d'un PDF en JPEG base64 (via PyMuPDF). Gère les scans/photos."""
    images: list[str] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page in doc[:max_pages]:
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            images.append(base64.b64encode(pix.tobytes("jpg", jpg_quality=75)).decode())
    finally:
        doc.close()
    return images


def _strip_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def parse_invoice(images_base64: list[str], filename_hint: str = "") -> dict:
    """Analyse une facture/ticket (1..N pages images) avec Claude Vision.

    Renvoie un dict structuré : type de document, fournisseur, date, n°, ventilation TVA,
    totaux, catégorie, statut de paiement, confiance. NE fait AUCUNE écriture BDD.
    """
    content: list[dict] = []
    for img in images_base64:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": IMAGE_MEDIA_TYPE, "data": img},
        })

    hint = f'\nNom du fichier déposé : "{filename_hint}" (peut contenir le fournisseur et/ou le montant TTC — indice de contrôle, pas une vérité).' if filename_hint else ""

    content.append({"type": "text", "text": f"""Tu es le comptable du restaurant Le 5 (SAS GLG Hospitality, SIREN 940111909). Lis ce document (facture ou ticket de caisse, éventuellement photographié) et extrais ses données comptables EXACTES.{hint}

ÉTAPE 1 — Nature du document (CRUCIAL) :
- "supplier_charge" : une facture/ticket d'ACHAT du resto (un fournisseur nous facture). → à comptabiliser en charge.
- "emitted_sale" : une facture que LE 5 ÉMET à un client (en-tête Le 5 / GLG Hospitality, adressée à un client, ex. EDIL Construction). → NE PAS comptabiliser en charge, c'est une vente.
- "unknown" : illisible ou indéterminable.

ÉTAPE 2 — Extraction (si supplier_charge) :
- supplier_name : le fournisseur (graphie propre).
- invoice_number : n° de facture/ticket si présent, sinon null.
- invoice_date : date réelle au format YYYY-MM-DD.
- tva_lines : ventilation par taux réel (5.5, 10, 20…). base_ht = base HORS TAXE à ce taux.
  Si seul le TTC est lisible, déduis le taux du type de produits et baisse la confiance.
- total_ht, total_tva, total_ttc (cohérents : ht + tva = ttc à 0,02 près ; total_ttc = le montant imprimé).
- category selon la grille ci-dessous ET le contenu réel des articles.
- payment_status : "paid" si payé (cash/CB/mention réglé), sinon "pending".
- short_label : 2–4 mots décrivant l'achat (ex. "carburant SP98", "petit matériel", "viandes") — sert au nommage du fichier.
- confidence : "high" | "medium" | "low".
- notes : tout ce qui est ambigu (illisible, doublon suspecté, doute catégorie…).

{CATEGORY_GUIDE}

Réponds UNIQUEMENT avec un JSON valide, sans markdown, format EXACT :
{{
  "doc_type": "supplier_charge | emitted_sale | unknown",
  "supplier_name": "...",
  "invoice_number": "... ou null",
  "invoice_date": "YYYY-MM-DD ou null",
  "category": "matieres | exploitation | equipement | hors_resto",
  "tva_lines": [{{"base_ht": 0.0, "tva_rate": 20, "label": "..."}}],
  "total_ht": 0.0, "total_tva": 0.0, "total_ttc": 0.0,
  "payment_status": "paid | pending",
  "short_label": "...",
  "confidence": "high | medium | low",
  "notes": "..."
}}"""})

    # Retry x3 : les modèles vision renvoient parfois un texte vide de façon transitoire
    # (→ json.loads casse). On réessaie plutôt que d'envoyer la facture en "à revoir".
    last_err = None
    for _attempt in range(3):
        try:
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": content}],
            )
            text = ""
            for block in (message.content or []):
                if getattr(block, "type", None) == "text":
                    text = block.text
                    break
            if not text.strip():
                raise ValueError("réponse vision vide")
            return _strip_json(text)
        except Exception as e:  # réponse vide / JSON invalide → on réessaie
            last_err = e
    raise last_err
