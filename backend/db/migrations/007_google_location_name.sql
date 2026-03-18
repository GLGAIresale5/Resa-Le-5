-- Migration 007 : ajouter google_location_name dans restaurants
-- Nécessaire pour l'intégration Google Business Profile API
-- google_location_name = identifiant complet de la location (ex: accounts/123456789/locations/987654321)
-- Différent de google_place_id (utilisé pour Google Maps / Places API)

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS google_location_name TEXT;

-- Mettre à jour Le 5 une fois la valeur connue (récupérée via scripts/setup_google_oauth.py)
-- UPDATE restaurants SET google_location_name = 'accounts/XXX/locations/YYY' WHERE name = 'Le 5';
