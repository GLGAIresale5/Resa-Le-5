"""Date de prélèvement bancaire des factures fournisseurs (règle métier Le 5).

Source : les relevés bancaires de Baptiste — la réalité bancaire PRIME sur
l'échéance imprimée sur la facture. Le prélèvement réel a souvent du décalage ;
on retient la meilleure estimation par fournisseur.

Règle :
- Métro   → date de facture + 10 jours calendaires
- Milliet → date de facture + 30 jours calendaires
- VDL (Les Viandes du Lys) → date de facture + 15 jours calendaires
  (rejoint l'échéance imprimée « +15 j » ; le prélèvement réel fluctue,
  +15 j est la meilleure estimation)
- tous les autres fournisseurs → jour de la facture
puis report au jour ouvré suivant si la date tombe un samedi, un dimanche ou
un jour férié français (métropole). S'applique aussi aux avoirs (montants
négatifs) : même règle que leur fournisseur.
"""
import re
import unicodedata
from datetime import date, timedelta

# Délais de prélèvement par fournisseur (jours calendaires après la date de facture).
# Matching par sous-chaîne sur le nom normalisé (minuscules, sans accents) :
# "Métro Cash & Carry" → "metrocashcarry" contient "metro".
# VDL a deux graphies OCR possibles : "Les Viandes du Lys" et le sigle "VDL".
SUPPLIER_DEBIT_DELAYS: tuple[tuple[str, int], ...] = (
    ("metro", 10),
    ("milliet", 30),
    ("viandesdulys", 15),
    ("vdl", 15),
)
DEFAULT_DELAY_DAYS = 0  # tous les autres fournisseurs : prélevés le jour de la facture


def _normalize(name: str) -> str:
    """Minuscules, sans accents, alphanumérique seulement ("J Milliet BBC SAS" → "jmillietbbcsas")."""
    nfkd = unicodedata.normalize("NFKD", name or "")
    ascii_only = nfkd.encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", ascii_only.lower())


def easter_sunday(year: int) -> date:
    """Dimanche de Pâques (algorithme anonyme de Meeus/Butcher, calendrier grégorien)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7  # noqa: E741
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def french_holidays(year: int) -> set[date]:
    """Jours fériés — France métropolitaine."""
    easter = easter_sunday(year)
    return {
        date(year, 1, 1),             # Jour de l'an
        easter + timedelta(days=1),   # Lundi de Pâques
        date(year, 5, 1),             # Fête du Travail
        date(year, 5, 8),             # Victoire 1945
        easter + timedelta(days=39),  # Ascension
        easter + timedelta(days=50),  # Lundi de Pentecôte
        date(year, 7, 14),            # Fête nationale
        date(year, 8, 15),            # Assomption
        date(year, 11, 1),            # Toussaint
        date(year, 11, 11),           # Armistice 1918
        date(year, 12, 25),           # Noël
    }


def next_business_day(d: date) -> date:
    """Reporte au jour ouvré suivant si d tombe un week-end ou un jour férié."""
    while d.weekday() >= 5 or d in french_holidays(d.year):
        d += timedelta(days=1)
    return d


def supplier_delay_days(supplier_name: str) -> int:
    """Délai de prélèvement (jours calendaires) applicable à un fournisseur."""
    normalized = _normalize(supplier_name)
    for token, days in SUPPLIER_DEBIT_DELAYS:
        if token in normalized:
            return days
    return DEFAULT_DELAY_DAYS


def compute_debit_date(supplier_name: str, invoice_date: date) -> date:
    """Date de prélèvement bancaire d'une facture fournisseur (avoirs inclus).

    PRIME sur l'échéance imprimée sur la facture / lue par l'OCR.
    """
    delay = supplier_delay_days(supplier_name)
    return next_business_day(invoice_date + timedelta(days=delay))
