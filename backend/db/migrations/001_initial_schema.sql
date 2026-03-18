-- ============================================================
-- GLG AI — Migration 001 : Schéma initial
-- Agent Avis clients — V1
-- ============================================================

-- ── 1. RESTAURANTS ──────────────────────────────────────────
CREATE TABLE restaurants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    description       TEXT,                          -- courte description du restaurant
    tone_profile      TEXT,                          -- ex: "chaleureux, familial, bistrot parisien"
    google_place_id   TEXT,                          -- pour récupérer les avis Google
    tripadvisor_id    TEXT,
    thefork_id        TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. AVIS CLIENTS ─────────────────────────────────────────
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    source          TEXT NOT NULL CHECK (source IN ('google', 'tripadvisor', 'thefork')),
    external_id     TEXT,                            -- ID de l'avis sur la plateforme source
    author_name     TEXT,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    content         TEXT,                            -- texte de l'avis
    review_date     TIMESTAMPTZ,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'ignored')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source, external_id)                     -- évite les doublons
);

-- ── 3. RÉPONSES AUX AVIS ────────────────────────────────────
CREATE TABLE review_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    generated_text  TEXT NOT NULL,                   -- réponse brute générée par Claude
    final_text      TEXT,                            -- réponse après édition humaine
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. INDEX ────────────────────────────────────────────────
CREATE INDEX idx_reviews_restaurant_id   ON reviews(restaurant_id);
CREATE INDEX idx_reviews_status          ON reviews(status);
CREATE INDEX idx_responses_review_id     ON review_responses(review_id);
CREATE INDEX idx_responses_status        ON review_responses(status);

-- ── 5. MISE À JOUR AUTOMATIQUE updated_at ───────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_review_responses_updated_at
    BEFORE UPDATE ON review_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 6. ROW LEVEL SECURITY (RLS) ─────────────────────────────
-- Chaque utilisateur ne voit que ses propres données

ALTER TABLE restaurants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Restaurants : visible et modifiable par le propriétaire uniquement
CREATE POLICY "restaurants_owner" ON restaurants
    FOR ALL USING (auth.uid() = owner_id);

-- Avis : visible si le restaurant appartient à l'utilisateur
CREATE POLICY "reviews_owner" ON reviews
    FOR ALL USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Réponses : idem via la chaîne review → restaurant
CREATE POLICY "responses_owner" ON review_responses
    FOR ALL USING (
        review_id IN (
            SELECT r.id FROM reviews r
            JOIN restaurants res ON r.restaurant_id = res.id
            WHERE res.owner_id = auth.uid()
        )
    );

-- ── 7. DONNÉES DE TEST (Le 5) ────────────────────────────────
-- À supprimer avant le lancement commercial
INSERT INTO restaurants (name, description, tone_profile, google_place_id)
VALUES (
    'Le 5',
    'Restaurant bistrot à Sucy-en-Brie, cuisine française généreuse et accueillante.',
    'Chaleureux, authentique, proche des clients. Ton professionnel mais accessible, jamais corporate. On remercie sincèrement, on personnalise chaque réponse.',
    'ChIJ_le5_sucy_placeholder'
);
