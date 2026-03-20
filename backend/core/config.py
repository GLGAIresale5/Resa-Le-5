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
    # Email alertes stocks & notifications (Resend API — legacy)
    resend_api_key: str = ""
    notification_email: str = "contact@glghospitality.com"
    # Brevo (SMS transactionnels)
    brevo_api_key: str = ""
    # Numéro admin pour notifications SMS (nouvelles réservations web)
    notification_phone: str = ""
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
