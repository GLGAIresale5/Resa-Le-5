-- ============================================================
-- GLG AI — Migration 004 : Daily sales + auto-thresholds
-- Agent Stocks — calcul automatique des seuils depuis les Z
-- ============================================================

-- ── 1. Colonne auto_thresholds sur stock_items ───────────────
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS auto_thresholds BOOLEAN DEFAULT FALSE;

-- ── 2. Table daily_sales (ventes journalières depuis ticket Z) ─
CREATE TABLE IF NOT EXISTS daily_sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    stock_item_id   UUID REFERENCES stock_items(id) ON DELETE SET NULL,
    item_name       TEXT NOT NULL,
    quantity_sold   FLOAT NOT NULL CHECK (quantity_sold >= 0),
    sale_date       DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Index pour requêtes rapides ───────────────────────────
CREATE INDEX IF NOT EXISTS daily_sales_restaurant_date
  ON daily_sales (restaurant_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS daily_sales_stock_item
  ON daily_sales (stock_item_id);

-- ── 4. RLS (Row Level Security) — même politique que stock_items ─
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès restaurant propriétaire — daily_sales"
  ON daily_sales
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
