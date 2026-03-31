-- Add columns for caching Instagram feed on the restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_feed_cache JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta_feed_fetched_at TIMESTAMPTZ;
