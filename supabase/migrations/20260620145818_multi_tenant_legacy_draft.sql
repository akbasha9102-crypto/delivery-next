-- ============================================================
-- Multi-tenant Migration — شغّل هذا الكود في Supabase SQL Editor
-- الرابط: https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

-- 1) جدول restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) ربط restaurant_settings
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 3) categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 4) items
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 5) orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- 6) drivers
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 7) إدراج المطعم الأول من restaurant_settings الموجودة
INSERT INTO restaurants (name, slug)
SELECT
  COALESCE(restaurant_name, 'المطعم'),
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(
    COALESCE(restaurant_name,'restaurant-1'),
    '[^a-zA-Z0-9 ]','','g'),
    '\s+','-','g'))
FROM restaurant_settings
ORDER BY updated_at ASC
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- 8) backfill restaurant_settings
UPDATE restaurant_settings
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 9) backfill categories
UPDATE categories
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 10) backfill items
UPDATE items
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 11) backfill orders
UPDATE orders
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 12) backfill drivers
UPDATE drivers
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 13) فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_restaurant      ON items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant     ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_restaurant    ON drivers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rest_settings_rest    ON restaurant_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug      ON restaurants(slug);
