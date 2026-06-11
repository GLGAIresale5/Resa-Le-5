-- 015: assignation de table = simple label texte (fin du plan de salle)
-- Additif et réversible. Le plan de salle (restaurant_tables / floor_plans) reste
-- en base pour compat ; il n'est simplement plus utilisé par l'app.

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_label TEXT;

-- Reprise des anciennes assignations : recopier le nom de la table assignée
-- dans le nouveau label, pour ne pas perdre l'info à l'affichage.
UPDATE reservations r
SET table_label = t.name
FROM restaurant_tables t
WHERE r.table_id = t.id AND r.table_label IS NULL;

-- Nettoyage futur (à exécuter plus tard, quand plus rien ne lit table_id) :
-- ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_table_id_fkey;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS table_id;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS grouped_table_ids;
-- DROP TABLE IF EXISTS restaurant_tables CASCADE;
-- DROP TABLE IF EXISTS floor_plans CASCADE;
