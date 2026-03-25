-- Modules accessibles par restaurant (abonnements modulables)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS modules TEXT[] DEFAULT ARRAY['reservations','avis','reseaux','stocks','stocks-cuisine'];
