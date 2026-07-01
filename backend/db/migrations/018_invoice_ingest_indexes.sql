-- 018 — Index pour le dédoublonnage à l'ingestion automatique (n8n → /factures/ingest)
-- Additive et idempotente. PAS de contrainte UNIQUE sur invoice_number :
-- certains fournisseurs (ex. Métro) utilisent des n° courts/recyclés et des factures
-- peuvent avoir un n° nul → l'unicité stricte casserait. Le dédoublonnage "intelligent"
-- (même n°, sinon fournisseur + date ±2j + TTC ±2€) est fait côté application.

-- Fenêtre de dédup par date
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_rid_date
  ON supplier_invoices(restaurant_id, invoice_date);

-- Recherche par n° de document
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_rid_number
  ON supplier_invoices(restaurant_id, invoice_number);
