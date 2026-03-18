import anthropic
from core.config import settings


client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """Tu rédiges des réponses aux avis clients pour Le 5 — bar, tapas, brasserie à Sucy-en-Brie.

Ton obligatoire : chaleur, pragmatisme, naturel. Direct, décontracté, sincère. Pas de jargon, pas de formules corporatives ("Notre établissement s'engage à..." → interdit), pas de "Nous sommes ravis/heureux/fiers de...".

Règles strictes :
- Avis positif (4-5 étoiles) : remercier, personnaliser avec un détail de l'avis, inviter à revenir — 2 phrases max
- Avis mitigé (3 étoiles) : remercier, reconnaître le point négatif en une phrase sans sur-défendre, réinviter
- Avis négatif (1-2 étoiles) : reconnaître le ressenti sans valider tous les faits, rester calme, proposer d'en discuter en direct si pertinent — NE JAMAIS publier sans validation de Baptiste
- Toujours personnaliser avec un détail mentionné dans l'avis
- 30 à 60 mots maximum — moins c'est mieux
- Signer "L'équipe du 5" (standard) ou "Baptiste, Géry et l'équipe du 5" (messages personnels importants)
- Ne jamais promettre ce qu'on ne peut pas tenir
- Langue : répondre dans la même langue que l'avis

Exemples du bon ton :
✅ "Merci pour ce retour ! L'accueil et les plats au rendez-vous, c'est tout ce qu'on vise. À bientôt ! — L'équipe du 5"
✅ "Merci pour votre retour. Vous avez raison sur l'attente — on en prend note. Content que les plats aient été à la hauteur. À bientôt. — L'équipe du 5"
❌ "Nous sommes désolés que vous n'ayez pas apprécié votre expérience" → trop robotique
❌ Longues justifications, réponses de plus de 3 phrases pour un avis positif"""


_COMPLAINT_KEYWORDS = {
    "attente": "le temps d'attente",
    "lent": "la lenteur du service",
    "lente": "la lenteur du service",
    "service": "le service",
    "bruit": "le niveau sonore",
    "bruyant": "le niveau sonore",
    "froid": "le plat servi froid",
    "froide": "le plat servi froid",
    "cher": "les prix",
    "prix": "les prix",
    "portion": "la taille des portions",
    "portions": "la taille des portions",
}


def _extract_complaints(review_content: str) -> list:
    content_lower = review_content.lower()
    found = []
    seen = set()
    for keyword, label in _COMPLAINT_KEYWORDS.items():
        if keyword in content_lower and label not in seen:
            found.append(label)
            seen.add(label)
    return found


def _mock_response(author_name: str, rating: int, restaurant_name: str, review_content: str = "") -> str:
    """Réponse de test — remplacée par Claude dès que l'API est active."""
    complaints = _extract_complaints(review_content)

    if rating >= 4:
        base = (
            f"Merci beaucoup {author_name} pour ce beau retour ! "
            f"Nous sommes ravis que vous ayez apprécié votre expérience chez {restaurant_name}. "
        )
        if complaints:
            base += f"Nous notons votre remarque concernant {complaints[0]} et en prenons bonne note pour progresser. "
        base += f"Au plaisir de vous retrouver très bientôt !\n— L'équipe du {restaurant_name}"
        return base
    elif rating == 3:
        base = f"Merci {author_name} pour votre retour honnête. "
        if complaints:
            base += f"Nous sommes désolés pour {', '.join(complaints)} lors de votre visite — ce n'est pas le niveau que nous visons. "
        base += (
            f"Nous prenons note de vos remarques pour continuer à nous améliorer. "
            f"Nous espérons vous revoir pour vous offrir une expérience encore meilleure.\n— L'équipe du {restaurant_name}"
        )
        return base
    else:
        base = f"Merci {author_name} d'avoir pris le temps de nous laisser votre avis. "
        if complaints:
            base += f"Nous nous excusons sincèrement pour {', '.join(complaints)} — cela ne reflète pas nos standards habituels. "
        base += (
            f"N'hésitez pas à nous contacter directement pour qu'on puisse échanger.\n— L'équipe du {restaurant_name}"
        )
        return base


def generate_review_response(
    review_content: str,
    author_name: str,
    rating: int,
    restaurant_name: str,
    tone_profile: str,
) -> str:
    """
    Génère une réponse à un avis client avec Claude.
    Retourne le texte de la réponse générée.
    """
    user_message = f"""Restaurant : {restaurant_name}
Ton du restaurant : {tone_profile}

Avis à traiter :
- Auteur : {author_name}
- Note : {rating}/5
- Contenu : {review_content}

Génère une réponse à cet avis. Si l'avis mentionne des points négatifs (attente, service, plat, etc.), chacun doit être explicitement reconnu et adressé dans la réponse."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return message.content[0].text
    except Exception as e:
        if "credit balance" in str(e).lower():
            return _mock_response(author_name, rating, restaurant_name, review_content)
        raise
