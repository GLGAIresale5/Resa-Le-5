-- ============================================================
-- GLG AI — Migration 005 : Groupement de tables
-- ============================================================

-- ── 1. Colonne movable sur restaurant_tables ─────────────────
-- Par défaut TRUE : toutes les tables sont déplaçables/groupables
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS movable BOOLEAN DEFAULT TRUE;

-- ── 2. Colonne grouped_table_ids sur reservations ────────────
-- Stocke les IDs des tables groupées pour ce service (temporaire au service)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS grouped_table_ids UUID[] DEFAULT '{}';
