-- ============================================================
-- GLG AI — Migration 010 : Multi-tenant — tokens API par restaurant
-- Chantier 1 de la roadmap multi-tenant (Arcachon)
-- ============================================================
-- Ajoute les colonnes nécessaires pour stocker les tokens API
-- (Google, Meta, Brevo) par restaurant au lieu du .env global.
-- Ajoute aussi un slug unique pour les URLs publiques (/reserver/[slug]).

-- ── 1. NOUVELLES COLONNES ──────────────────────────────────────

-- Google Business Profile (per-restaurant)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- Meta / Instagram (per-restaurant)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_instagram_id TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_instagram_account_id TEXT;

-- Brevo SMS (per-restaurant)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS brevo_sms_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS brevo_sms_sender_name TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS brevo_sms_number TEXT;

-- Slug pour URL publique
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Horaires de service (pour la page publique de réservation)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_hours JSONB;
-- Format attendu :
-- {
--   "services": [
--     {"name": "Déjeuner", "start": "12:00", "end": "14:30"},
--     {"name": "Dîner", "start": "19:00", "end": "22:30"}
--   ],
--   "slot_interval_minutes": 15
-- }

-- ── 2. INDEX ───────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);

-- ── 3. MIGRATION DES DONNÉES LE 5 ─────────────────────────────
-- Migrer les tokens actuels du .env vers la BDD pour Le 5

-- Les tokens Le 5 ont été migrés manuellement via Supabase SQL Editor (20/03/2026).
-- Ne pas inclure de tokens ici — ils sont sensibles.
-- Template pour un nouveau restaurant :
-- UPDATE restaurants SET
--     google_refresh_token = '<TOKEN>',
--     meta_page_access_token = '<TOKEN>',
--     meta_page_id = '<PAGE_ID>',
--     meta_instagram_id = '<IG_ID>',
--     meta_instagram_account_id = '<IG_ID>',
--     brevo_sms_enabled = TRUE,
--     brevo_sms_sender_name = '<NOM>',
--     brevo_sms_number = '<NUMERO>',
--     slug = '<SLUG>',
--     service_hours = '{"services": [...], "slot_interval_minutes": 15}'::jsonb
-- WHERE name = '<NOM_RESTAURANT>';
