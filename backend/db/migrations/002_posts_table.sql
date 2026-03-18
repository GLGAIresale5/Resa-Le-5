-- Migration 002 : table posts (agent réseaux sociaux)
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    context         TEXT NOT NULL,
    photo_url       TEXT,
    generated_text  TEXT,
    final_text      TEXT,
    captions        JSONB,          -- {"instagram": "...", "facebook": "..."}
    platforms       TEXT[] DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'approved', 'published')),
    scheduled_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes par restaurant + statut
CREATE INDEX IF NOT EXISTS idx_posts_restaurant_status
    ON posts (restaurant_id, status);
