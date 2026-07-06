-- 020 — Compte comptable (PCG) suggéré/affecté par facture fournisseur.
-- Suggéré par l'OCR selon le contenu (plan de comptes Le 5 — cf. skill le5-plan-comptable),
-- éditable par Baptiste dans le détail de la facture. Texte libre (n° de compte, ex. "601").
-- Additive et idempotente.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS compte_comptable text;

COMMENT ON COLUMN supplier_invoices.compte_comptable IS
  'Compte comptable PCG suggéré par l''OCR et éditable (ex. 601, 607, 6061…). Réf. skill le5-plan-comptable.';
