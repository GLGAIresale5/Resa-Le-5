-- 016: fermetures récurrentes hebdomadaires + durcissement sécurité (RLS)
-- weekday = convention JS getDay() : 0=dimanche, 1=lundi, ... 6=samedi.
-- Les règles sont lues par public_booking (enforcement serveur) et matérialisées
-- en reservation_blocks par le front pour l'affichage calendrier.

-- ── Table des règles ──
CREATE TABLE IF NOT EXISTS recurring_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  service TEXT CHECK (service IS NULL OR char_length(service) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_closures_restaurant ON recurring_closures(restaurant_id);
-- Unicité d'une règle (gère NULL et la casse d'un coup)
CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_closures_rule
  ON recurring_closures(restaurant_id, weekday, COALESCE(lower(service), ''));

ALTER TABLE recurring_closures ENABLE ROW LEVEL SECURITY;

-- Le propriétaire du restaurant gère ses règles (accès direct front via JWT).
-- NB : le sous-select s'exécute avec les droits de l'appelant → la RLS de
-- restaurants (policy owner_id = auth.uid(), migration 001) s'applique aussi.
DROP POLICY IF EXISTS "owner manages recurring closures" ON recurring_closures;
CREATE POLICY "owner manages recurring closures" ON recurring_closures
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())));

REVOKE ALL ON recurring_closures FROM anon;

-- ── Durcissement : tables backend-only laissées sans RLS depuis leur création ──
-- (le backend utilise la service key qui bypasse la RLS — aucune régression ;
--  le front ne touche jamais ces tables directement)
ALTER TABLE reservation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── Anti-doublons "journée entière" (NULLs distincts dans un UNIQUE classique) ──
-- Nettoyage défensif d'éventuels doublons existants avant l'index
DELETE FROM reservation_blocks a USING reservation_blocks b
 WHERE a.id > b.id AND a.restaurant_id = b.restaurant_id AND a.date = b.date
   AND a.service IS NULL AND b.service IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_blocks_whole_day
  ON reservation_blocks(restaurant_id, date) WHERE service IS NULL;
