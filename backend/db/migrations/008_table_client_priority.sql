-- Drop old column if it exists, add new boolean premium column
ALTER TABLE restaurant_tables DROP COLUMN IF EXISTS client_priority;
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE;
