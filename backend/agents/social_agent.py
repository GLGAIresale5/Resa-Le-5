import anthropic
from typing import Optional
from core.config import settings


client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """Tu rédiges des posts Instagram et Facebook pour Le 5 — bar, tapas, brasserie à Sucy-en-Brie (94). Brasserie parisienne, classe mais abordable, atmosphère détendue et soignée.

Ton obligatoire : pragmatique et décontracté. Phrases courtes, directes, naturelles. Dire exactement ce que c'est, sans surenchère. Pas de second degré, pas d'ironie, pas de formulations creuses ("Laissez-vous tenter...", "Vous cherchez...", "Nous sommes ravis..." → interdit).

Règles Instagram :
- 80 à 120 mots
- 1 à 2 emojis max, pertinents, jamais décoratifs
- Hashtags fixes obligatoires en fin de post : #le5 #le5sucy #sucyenbrie #restaurant #bar #tapas
- Ajouter 3 à 5 hashtags contextuels selon le sujet (plat, terrasse, apéro, boisson…)
- Terminer par un appel à l'action simple et naturel

Règles Facebook :
- Même texte de base, légèrement reformulé si besoin
- Hashtags fixes uniquement (#le5 #le5sucy #sucyenbrie #restaurant #bar #tapas), pas de hashtags contextuels
- Peut être légèrement plus informatif si utile

Règles communes :
- Ne jamais inventer prix, horaires ou infos non fournies
- Les posts ne se signent pas (le compte porte déjà l'identité du 5)
- Langue : français

Exemples du bon ton :
✅ "Nos croquetas sont maison, croustillantes dehors, fondantes dedans. C'est simple, c'est bon."
❌ "Laissez-vous tenter par notre incroyable sélection..." → trop mou
❌ "Vous cherchez un endroit où..." → second degré inutile

Format de réponse OBLIGATOIRE — uniquement ce JSON, sans texte autour :
{
  "instagram": "caption instagram avec hashtags",
  "facebook": "caption facebook avec hashtags fixes"
}"""


def _mock_post(context: str, restaurant_name: str) -> dict:
    """Réponse de test — remplacée par Claude dès que l'API est active."""
    return {
        "instagram": (
            f"✨ {context}\n\n"
            f"Venez nous rendre visite et découvrir toute notre carte !\n\n"
            f"📍 {restaurant_name}\n"
            f"#restaurant #gastronomie #bonneTable #{restaurant_name.lower().replace(' ', '')}"
        ),
        "facebook": (
            f"{context}\n\n"
            f"Nous vous attendons avec plaisir chez {restaurant_name}. "
            f"Réservez votre table dès maintenant !"
        ),
    }


ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MEDIA_TYPE_MAP = {"image/jpg": "image/jpeg"}


def generate_post(
    context: str,
    restaurant_name: str,
    tone_profile: str,
    platforms: list,
    photo_base64: Optional[str] = None,
    photo_media_type: str = "image/jpeg",
) -> dict:
    """
    Génère des captions pour les réseaux sociaux avec Claude.
    Supporte optionnellement une image en base64 (vision).
    Retourne un dict {"instagram": "...", "facebook": "..."}.
    """
    # Normaliser le media_type
    photo_media_type = MEDIA_TYPE_MAP.get(photo_media_type, photo_media_type)
    if photo_media_type not in ALLOWED_MEDIA_TYPES:
        photo_base64 = None  # ignorer l'image si format non supporté

    platforms_str = " et ".join(platforms) if platforms else "Instagram et Facebook"

    user_message = f"""Restaurant : {restaurant_name}
Ton du restaurant : {tone_profile}
Plateformes cibles : {platforms_str}
Contexte du post : {context}

Génère les captions pour ce post."""

    # Construction du message : avec image si disponible
    if photo_base64:
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": photo_media_type,
                    "data": photo_base64,
                },
            },
            {"type": "text", "text": user_message},
        ]
    else:
        content = user_message

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        import json
        raw = message.content[0].text.strip()
        # Extraire le JSON même si Claude ajoute du texte autour
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        if "credit balance" in str(e).lower():
            return _mock_post(context, restaurant_name)
        raise
