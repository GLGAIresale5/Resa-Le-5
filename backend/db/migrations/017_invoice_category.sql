-- 017 — Catégorie de dépense sur les factures fournisseurs
-- Permet de distinguer matières (→ marge brute), charges d'exploitation,
-- équipement (investissement) et dépenses hors-restaurant (perso/véhicule).
-- Migration additive et idempotente.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'matieres';

COMMENT ON COLUMN supplier_invoices.category IS
  'matieres | exploitation | equipement | hors_resto — matieres entre dans la marge brute';

-- Garde-fou : valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoices_category_check'
  ) THEN
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT supplier_invoices_category_check
      CHECK (category IN ('matieres', 'exploitation', 'equipement', 'hors_resto'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_category
  ON supplier_invoices(restaurant_id, category);
