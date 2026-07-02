from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)


class Settings(BaseSettings):
    anthropic_api_key: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    environment: str = "development"
    # Clé d'ingestion machine-à-machine (n8n → /factures/ingest). Vide = endpoint désactivé.
    ingest_api_key: str = ""
    # Email alertes stocks & notifications (Resend API — legacy)
    resend_api_key: str = ""
    notification_email: str = "contact@glghospitality.com"
    # Brevo (SMS + email transactionnels)
    brevo_api_key: str = ""
    # Numéro admin pour notifications SMS (nouvelles réservations web)
    notification_phone: str = ""
    # Contact (formulaire site public + privatisation)
    contact_email_to: str = "glg.ai.services01@gmail.com"
    contact_email_from: str = "contact@glghospitality.com"
    # Web Push (notifications PWA)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_claims_email: str = "contact@glghospitality.com"
    # Google Business Profile API (OAuth2 — app-level credentials)
    google_client_id: str = ""
    google_client_secret: str = ""
    # Note: google_refresh_token et google_location_name sont maintenant per-restaurant en BDD
    # Meta Graph API (app-level credentials)
    meta_app_id: str = ""
    meta_app_secret: str = ""
    # Note: meta_page_access_token, meta_instagram_id, meta_page_id sont maintenant per-restaurant en BDD

    class Config:
        env_file = str(BASE_DIR / ".env")
        extra = "ignore"  # Ignorer les variables .env non déclarées (tokens per-restaurant migrés en BDD)


settings = Settings()

# Nettoyage défensif : un espace/retour-ligne parasite au collage (UI Render, etc.)
# rend une clé « invalide ». On strip les secrets sensibles au chargement.
settings.anthropic_api_key = (settings.anthropic_api_key or "").strip()
settings.ingest_api_key = (settings.ingest_api_key or "").strip()
