"""
Script de configuration ONE-TIME pour connecter Google Business Profile API.
À lancer une seule fois pour obtenir le refresh_token et les IDs de compte/location.

Prérequis :
1. Aller sur console.cloud.google.com
2. Créer un projet (ou utiliser un existant)
3. Activer l'API "Google Business Profile API"
4. Créer des identifiants OAuth 2.0 (type "Application Web" ou "Application de bureau")
5. Télécharger le fichier JSON des identifiants

Usage :
    cd ~/Developer/glg-ai
    pip install google-auth-oauthlib httpx
    python scripts/setup_google_oauth.py
"""

import json
import httpx
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/business.manage"]


def main():
    print("\n=== Configuration Google Business Profile API ===\n")
    print("Prérequis : avoir téléchargé le fichier client_secrets.json depuis Google Cloud Console")
    print("(Identifiants > OAuth 2.0 > Télécharger JSON)\n")

    client_secrets_path = input("Chemin vers client_secrets.json : ").strip()

    flow = InstalledAppFlow.from_client_secrets_file(client_secrets_path, scopes=SCOPES)
    creds = flow.run_local_server(port=0)

    print("\n✅ Authentification réussie !\n")
    print("─" * 50)
    print("Ajoutez ces lignes dans backend/.env :\n")
    print(f"GOOGLE_CLIENT_ID={creds.client_id}")
    print(f"GOOGLE_CLIENT_SECRET={creds.client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print("─" * 50)

    # Lister les comptes et locations
    print("\nRécupération de vos comptes Google Business Profile...\n")
    headers = {"Authorization": f"Bearer {creds.token}"}

    accounts_resp = httpx.get(
        "https://mybusiness.googleapis.com/v4/accounts",
        headers=headers,
        timeout=15,
    )

    if accounts_resp.status_code != 200:
        print(f"⚠️  Impossible de lister les comptes : {accounts_resp.text}")
        print("Vérifiez que l'API Google Business Profile est activée dans Google Cloud Console.")
        return

    accounts = accounts_resp.json().get("accounts", [])
    if not accounts:
        print("Aucun compte Business Profile trouvé pour ce compte Google.")
        return

    for acc in accounts:
        account_name = acc["name"]
        print(f"Compte : {acc.get('accountName', account_name)} ({account_name})")

        locations_resp = httpx.get(
            f"https://mybusiness.googleapis.com/v4/{account_name}/locations",
            headers=headers,
            timeout=15,
        )

        if locations_resp.status_code != 200:
            print(f"  ⚠️  Impossible de lister les locations : {locations_resp.text}")
            continue

        locations = locations_resp.json().get("locations", [])
        for loc in locations:
            loc_name = loc["name"]
            print(f"\n  → {loc.get('locationName', loc_name)}")
            print(f"    Location name : {loc_name}")
            print(f"\n  Ajoutez aussi dans backend/.env :")
            print(f"  GOOGLE_LOCATION_NAME={loc_name}")


if __name__ == "__main__":
    main()
