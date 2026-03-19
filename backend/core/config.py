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
    # Google Business Profile API (OAuth2)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_location_name: str = ""  # ex: accounts/123456789/locations/987654321
    # Meta Graph API (Instagram + Facebook)
    meta_page_access_token: str = ""
    meta_instagram_account_id: str = ""
    meta_instagram_id: str = ""
    meta_facebook_page_id: str = ""
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_page_id: str = ""

    class Config:
        env_file = str(BASE_DIR / ".env")


settings = Settings()
