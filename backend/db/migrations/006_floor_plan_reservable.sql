-- Migration 006: add reservable flag to floor_plans
-- Allows marking certain rooms (e.g. terrasse) as non-reservable
-- so their tables are excluded from automatic table assignment.
-- Managers can still manually seat guests there when space is available.

ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS reservable BOOLEAN DEFAULT TRUE;
