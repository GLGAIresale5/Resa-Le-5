"""
Loterie « La Chance du 5 » — règles métier centralisées.

Tout ce qui décide d'un gain vit ICI et tourne CÔTÉ SERVEUR uniquement.
Le navigateur ne doit jamais connaître la grille : sinon n'importe qui ouvre la
console, lit les probabilités et se sert.

Grille validée par Baptiste le 28/07/2026 (sur 100 tirages) :
    13 café · 9 verre de vin · 8 bière · 3 gros lot · 67 perdu
    → 1 chance sur 3 de gagner, gros lot 1 fois sur 11 gagnants.

Exposition maximale ≈ 40 €/mois de coût matière au scénario le plus fort.
Le plafond mensuel de gros lots borne le risque par construction.
"""

import random
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

# ── Paramètres métier (les seuls leviers à toucher) ──
WEEKLY_COOLDOWN_DAYS = 7      # 1 tirage par numéro tous les 7 jours
PRIZE_VALIDITY_DAYS = 30      # validité d'un lot gagné
MAX_GROS_LOT_PER_MONTH = 10   # plafond dur : au-delà, bascule sur les petits lots
RETENTION_PLAYS_DAYS = 90     # RGPD — purge des participations à 3 mois

# ── Grille de tirage : (clé, poids sur 100) ──
GRID: Tuple[Tuple[str, int], ...] = (
    ("cafe", 13),
    ("vin", 9),
    ("biere", 8),
    ("gros_lot", 3),
    ("none", 67),
)

# Répartition de repli quand le plafond mensuel de gros lots est atteint
FALLBACK_GRID: Tuple[Tuple[str, int], ...] = (
    ("cafe", 13),
    ("vin", 9),
    ("biere", 8),
)

PRIZES: Dict[str, Dict] = {
    "none": {
        "label": "Perdu",
        "alcohol": False,
        "cost": 0.0,
    },
    "cafe": {
        "label": "Un café offert",
        "alcohol": False,
        "cost": 0.25,
    },
    "vin": {
        "label": "Un verre de vin",
        "alcohol": True,
        "cost": 0.80,
    },
    "biere": {
        "label": "Une bière (25 cl)",
        "alcohol": True,
        "cost": 0.90,
    },
    "gros_lot": {
        # Planche OU cocktail, au choix de l'établissement selon disponibilité
        # (cf. art. 4 du règlement du jeu).
        "label": "Une planche ou un cocktail",
        "alcohol": True,
        "cost": 6.00,
    },
}

_PHONE_RE = re.compile(r"^0[67][0-9]{8}$")
_PHONE_CLEAN_RE = re.compile(r"[\s.\-()]")


def normalize_phone(raw: str) -> Optional[str]:
    """
    Ramène un numéro saisi à la forme canonique 0XXXXXXXXX (mobile FR).

    Accepte les espaces, points, tirets, +33 et 0033. Renvoie None si le numéro
    n'est pas un mobile français valide — la validation du format à la saisie est
    la première des deux sécurités demandées par Baptiste (la seconde étant la
    recherche de secours par prénom en salle).
    """
    if not raw:
        return None
    cleaned = _PHONE_CLEAN_RE.sub("", raw.strip())
    if cleaned.startswith("+33"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("0033"):
        cleaned = "0" + cleaned[4:]
    elif cleaned.startswith("33") and len(cleaned) == 11:
        cleaned = "0" + cleaned[2:]
    if not _PHONE_RE.match(cleaned):
        return None
    return cleaned


def _pick(grid: Tuple[Tuple[str, int], ...]) -> str:
    """Tirage pondéré sur la grille fournie."""
    total = sum(weight for _, weight in grid)
    roll = random.randint(1, total)
    cursor = 0
    for key, weight in grid:
        cursor += weight
        if roll <= cursor:
            return key
    return grid[-1][0]  # inatteignable, filet de sécurité


def draw_prize(gros_lot_used_this_month: int) -> str:
    """
    Effectue le tirage. Si le plafond mensuel de gros lots est atteint, un tirage
    qui serait tombé sur le gros lot est automatiquement réattribué aux petits
    lots (art. 4 du règlement — l'exposition reste bornée quoi qu'il arrive).
    """
    prize = _pick(GRID)
    if prize == "gros_lot" and gros_lot_used_this_month >= MAX_GROS_LOT_PER_MONTH:
        prize = _pick(FALLBACK_GRID)
    return prize


def prize_payload(prize: str) -> Dict:
    """Métadonnées d'un lot, telles qu'elles sont stockées et renvoyées au client."""
    meta = PRIZES.get(prize, PRIZES["none"])
    return {
        "prize": prize,
        "prize_label": meta["label"],
        "is_alcohol": bool(meta["alcohol"]),
        "cost": meta["cost"],
    }


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def expiry_from(moment: datetime) -> datetime:
    return moment + timedelta(days=PRIZE_VALIDITY_DAYS)


def cooldown_until(last_play_at: datetime) -> datetime:
    return last_play_at + timedelta(days=WEEKLY_COOLDOWN_DAYS)


def parse_ts(value: str) -> datetime:
    """Parse un timestamp Supabase (ISO 8601, suffixe Z ou offset) en datetime aware."""
    if not value:
        return now_utc()
    text = value.replace("Z", "+00:00")
    # Supabase renvoie parfois 6+ chiffres de microsecondes — datetime en veut 6 max
    match = re.match(r"^(.*\.\d{6})\d*(.*)$", text)
    if match:
        text = match.group(1) + match.group(2)
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return now_utc()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
