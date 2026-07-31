-- 021 — Loterie « La Chance du 5 » (QR sur l'addition)
-- Le client scanne le QR, laisse prénom + téléphone, et un tirage au sort INSTANTANÉ
-- côté serveur lui attribue un lot consommable lors d'une visite ultérieure.
--
-- DEUX tables volontairement SÉPARÉES (RGPD — limitation des finalités, avis Harvey 28/07/2026) :
--   • lottery_plays      → base légale « exécution du contrat » (art. 6.1.b RGPD).
--                          Le téléphone est NÉCESSAIRE au jeu (contrôle 7 jours + remise du lot).
--                          Aucun consentement requis. Rétention : 3 MOIS.
--   • marketing_contacts → base légale « consentement » (art. 6.1.a RGPD + L.34-5 CPCE).
--                          Alimentée UNIQUEMENT si la case facultative est cochée.
--                          Rétention : 3 ANS après le dernier contact.
-- Les deux tables sont indépendantes : la purge de l'une ne touche jamais l'autre.
--
-- Migration ADDITIVE et IDEMPOTENTE — peut être rejouée sans erreur.

-- ── Participations & lots ──
CREATE TABLE IF NOT EXISTS lottery_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 60),
  phone TEXT NOT NULL CHECK (phone ~ '^0[67][0-9]{8}$'),
  prize TEXT NOT NULL CHECK (prize IN ('none', 'cafe', 'vin', 'biere', 'gros_lot')),
  prize_label TEXT NOT NULL,
  is_alcohol BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('none', 'pending', 'claimed', 'expired')),
  expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  rules_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE lottery_plays IS
  'Participations à la loterie. RGPD : base légale = exécution du contrat (règlement du jeu). RÉTENTION 3 MOIS — purge via POST /lottery/purge.';
COMMENT ON COLUMN lottery_plays.phone IS
  'Téléphone NORMALISÉ au format 0XXXXXXXXX (mobile FR uniquement). Sert au contrôle des 7 jours ET à la recherche du gagnant en salle.';
COMMENT ON COLUMN lottery_plays.prize IS
  'none = perdu. Grille sur 100 tirages : 13 cafe / 9 vin / 8 biere / 3 gros_lot / 67 none.';
COMMENT ON COLUMN lottery_plays.is_alcohol IS
  'true → l''écran de gain affiche le message sanitaire (art. L3323-4 CSP) et le lot est substitué par un équivalent sans alcool si le gagnant est mineur (art. L3342-1 CSP).';
COMMENT ON COLUMN lottery_plays.status IS
  'none = pas de lot (perdu). pending = lot à réclamer. claimed = lot remis (brûlé en salle). expired = validité 30 j dépassée.';
COMMENT ON COLUMN lottery_plays.rules_accepted_at IS
  'Horodatage de l''acceptation du règlement du jeu (case obligatoire). C''est la PREUVE contractuelle — ne jamais purger avant la ligne elle-même.';

-- Contrôle « 1 tirage / numéro / 7 jours » + recherche du gagnant en salle
CREATE INDEX IF NOT EXISTS idx_lottery_plays_phone
  ON lottery_plays(restaurant_id, phone, created_at DESC);
-- Plafond mensuel de gros lots + purge à 3 mois
CREATE INDEX IF NOT EXISTS idx_lottery_plays_created
  ON lottery_plays(restaurant_id, created_at DESC);
-- Liste des lots en attente (back-office)
CREATE INDEX IF NOT EXISTS idx_lottery_plays_status
  ON lottery_plays(restaurant_id, status) WHERE status = 'pending';
-- Recherche de secours par prénom (typo sur le numéro à la saisie)
CREATE INDEX IF NOT EXISTS idx_lottery_plays_first_name
  ON lottery_plays(restaurant_id, lower(first_name));

ALTER TABLE lottery_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manages lottery plays" ON lottery_plays;
CREATE POLICY "owner manages lottery plays" ON lottery_plays
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())));

-- Ceinture de sécurité : le navigateur ne doit JAMAIS lire cette table en direct
-- (tout passe par le backend avec la service key).
REVOKE ALL ON lottery_plays FROM anon;


-- ── Base de prospection (opt-in explicite uniquement) ──
CREATE TABLE IF NOT EXISTS marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 60),
  phone TEXT NOT NULL CHECK (phone ~ '^0[67][0-9]{8}$'),
  source TEXT NOT NULL DEFAULT 'loterie',
  consent_at TIMESTAMPTZ NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE marketing_contacts IS
  'Base de prospection SMS. RGPD : base légale = consentement libre (case facultative NON pré-cochée). RÉTENTION 3 ANS après le dernier contact. Un STOP renseigne unsubscribed_at — la ligne n''est pas supprimée (preuve de l''opposition).';
COMMENT ON COLUMN marketing_contacts.consent_at IS
  'Horodatage du consentement. C''est NOUS qui portons la charge de la preuve (art. 7.1 RGPD) — ne jamais écraser cette valeur lors d''un ré-opt-in.';
COMMENT ON COLUMN marketing_contacts.unsubscribed_at IS
  'NULL = contact actif. Renseigné = STOP reçu ou retrait du consentement → ne plus jamais démarcher.';

-- Un seul contact par numéro et par restaurant (ré-opt-in = update, pas doublon)
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_contacts_phone
  ON marketing_contacts(restaurant_id, phone);
-- Ciblage des envois : uniquement les contacts actifs
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_active
  ON marketing_contacts(restaurant_id, unsubscribed_at) WHERE unsubscribed_at IS NULL;

ALTER TABLE marketing_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manages marketing contacts" ON marketing_contacts;
CREATE POLICY "owner manages marketing contacts" ON marketing_contacts
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = (SELECT auth.uid())));

REVOKE ALL ON marketing_contacts FROM anon;


-- ── Activation du module pour Le 5 ──
-- array_append ciblé : surtout PAS un SET modules = ARRAY[...] qui écraserait
-- la configuration réelle du restaurant (le DEFAULT de la migration 012 est périmé).
UPDATE restaurants
   SET modules = array_append(modules, 'loterie')
 WHERE id = '60945098-cb17-4b47-8771-4b0110ec6d9d'
   AND NOT ('loterie' = ANY(modules));
