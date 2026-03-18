-- Migration 003: Reservations module
-- Tables: floor_plans, restaurant_tables, reservations

-- =====================
-- FLOOR PLANS
-- =====================
CREATE TABLE IF NOT EXISTS floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,             -- "Salle", "Terrasse", "Étage 1"
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- TABLES (physical tables in the restaurant)
-- =====================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,             -- "T1", "Table 5", "Banquette"
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  x FLOAT NOT NULL DEFAULT 50,   -- position X en % du conteneur
  y FLOAT NOT NULL DEFAULT 50,   -- position Y en % du conteneur
  width FLOAT NOT NULL DEFAULT 80,
  height FLOAT NOT NULL DEFAULT 80,
  shape TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangle')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- RESERVATIONS
-- =====================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 90,  -- durée en minutes
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'phone', 'google', 'instagram', 'facebook', 'web')),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_floor_plans_restaurant ON floor_plans(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_floor_plan ON restaurant_tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date ON reservations(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- =====================
-- TRIGGERS (updated_at)
-- =====================
CREATE TRIGGER update_floor_plans_updated_at
  BEFORE UPDATE ON floor_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "floor_plans_owner" ON floor_plans
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

CREATE POLICY "restaurant_tables_owner" ON restaurant_tables
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

CREATE POLICY "reservations_owner" ON reservations
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

-- =====================
-- SEED DATA — Le 5 (ID: 60945098-cb17-4b47-8771-4b0110ec6d9d)
-- =====================

-- Plans
INSERT INTO floor_plans (id, restaurant_id, name, sort_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'Salle', 0),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'Terrasse', 1)
ON CONFLICT DO NOTHING;

-- Tables — Salle (12 tables)
INSERT INTO restaurant_tables (floor_plan_id, restaurant_id, name, capacity, x, y, shape) VALUES
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T1', 2, 10, 10, 'square'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T2', 2, 25, 10, 'square'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T3', 4, 45, 10, 'rectangle'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T4', 4, 70, 10, 'rectangle'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T5', 2, 10, 40, 'square'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T6', 4, 30, 40, 'round'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T7', 4, 55, 40, 'round'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T8', 6, 75, 38, 'rectangle'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T9', 2, 10, 70, 'square'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T10', 4, 30, 70, 'rectangle'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T11', 4, 55, 70, 'rectangle'),
  ('a1000000-0000-0000-0000-000000000001', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'T12', 8, 75, 68, 'rectangle')
ON CONFLICT DO NOTHING;

-- Tables — Terrasse (6 tables)
INSERT INTO restaurant_tables (floor_plan_id, restaurant_id, name, capacity, x, y, shape) VALUES
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P1', 2, 10, 15, 'round'),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P2', 2, 35, 15, 'round'),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P3', 4, 62, 15, 'round'),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P4', 4, 10, 55, 'round'),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P5', 4, 40, 55, 'round'),
  ('a1000000-0000-0000-0000-000000000002', '60945098-cb17-4b47-8771-4b0110ec6d9d', 'P6', 6, 70, 55, 'rectangle')
ON CONFLICT DO NOTHING;
