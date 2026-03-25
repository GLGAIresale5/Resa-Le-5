-- Blocage de réservations (jour entier ou service spécifique)
CREATE TABLE IF NOT EXISTS reservation_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  service TEXT, -- null = jour entier, ex: "midi", "soir"
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, date, service)
);
