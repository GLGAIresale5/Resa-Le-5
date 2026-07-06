-- 019 — Consignes / déconsignes sur les factures fournisseurs (emballages consignés, ex. Milliet).
-- À partir d'ici, total_ttc porte le NET À PAYER (le montant réellement prélevé sur le compte) :
--   net à payer = total_ht + total_tva (= TTC marchandises) + consignes − deconsignes
-- Les consignes/déconsignes N'ENTRENT PAS dans la base TVA ni dans les matières (marge inchangée).
-- Migration additive et idempotente.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS consignes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deconsignes numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN supplier_invoices.consignes IS
  'Consignes facturées (emballages consignés, montant +). Hors base TVA/matières.';
COMMENT ON COLUMN supplier_invoices.deconsignes IS
  'Déconsignes créditées (retours, magnitude positive appliquée en −). Hors base TVA/matières.';
