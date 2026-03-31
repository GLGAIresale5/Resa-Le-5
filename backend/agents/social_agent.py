import anthropic
import json
from typing import Optional
from core.config import settings


client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def build_system_prompt(restaurant_name: str, tone_profile: str) -> str:
    """Build a dynamic system prompt based on restaurant identity."""
    base = f"""Tu rédiges des posts Instagram et Facebook pour {restaurant_name}.

"""
    if tone_profile and tone_profile.strip():
        base += f"""Profil éditorial du restaurant :
{tone_profile}

"""
    else:
        base += """Ton par défaut : professionnel et chaleureux. Phrases courtes, naturelles, directes.

"""

    base += """Règles Instagram :
- 80 à 120 mots
- 1 à 2 emojis max, pertinents, jamais décoratifs
- Inclure les hashtags fixes du restaurant (s'ils sont définis dans le profil éditorial) en fin de post
- Ajouter 3 à 5 hashtags contextuels selon le sujet (plat, terrasse, apéro, boisson…)
- Terminer par un appel à l'action simple et naturel

Règles Facebook :
- Même texte de base, légèrement reformulé si besoin
- Hashtags fixes uniquement (pas de hashtags contextuels)
- Peut être légèrement plus informatif si utile

Règles communes :
- Ne jamais inventer prix, horaires ou infos non fournies
- Les posts ne se signent pas (le compte porte déjà l'identité du restaurant)
- Langue : français

Format de réponse OBLIGATOIRE — uniquement ce JSON, sans texte autour :
{
  "instagram": "caption instagram avec hashtags",
  "facebook": "caption facebook avec hashtags fixes"
}"""
    return base


ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MEDIA_TYPE_MAP = {"image/jpg": "image/jpeg"}


def generate_post(
    context: str,
    restaurant_name: str,
    tone_profile: str,
    platforms: list,
    photo_base64: Optional[str] = None,
    photo_media_type: str = "image/jpeg",
    previous_captions: Optional[list[str]] = None,
) -> dict:
    """
    Génère des captions pour les réseaux sociaux avec Claude.
    Supporte optionnellement une image en base64 (vision).
    Retourne un dict {"instagram": "...", "facebook": "..."}.
    """
    # Normaliser le media_type
    photo_media_type = MEDIA_TYPE_MAP.get(photo_media_type, photo_media_type)
    if photo_media_type not in ALLOWED_MEDIA_TYPES:
        photo_base64 = None

    platforms_str = " et ".join(platforms) if platforms else "Instagram et Facebook"

    user_message = f"""Restaurant : {restaurant_name}
Plateformes cibles : {platforms_str}
Contexte du post : {context}"""

    # Ajouter les anciens posts comme référence de style
    if previous_captions:
        captions_text = "\n".join(
            f"{i+1}. \"{c}\"" for i, c in enumerate(previous_captions[:15])
        )
        user_message += f"""

--- Posts récemment publiés par ce restaurant sur Instagram ---
{captions_text}
---
Inspire-toi de ce style (ton, vocabulaire, structure) pour maintenir la cohérence éditoriale, sans copier."""

    user_message += "\n\nGénère les captions pour ce post."

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
            system=build_system_prompt(restaurant_name, tone_profile),
            messages=[{"role": "user", "content": content}],
        )
        raw = message.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        if "credit balance" in str(e).lower():
            return {
                "instagram": f"✨ {context}\n\n📍 {restaurant_name}",
                "facebook": f"{context}\n\nRendez-vous chez {restaurant_name} !",
            }
        raise
