-- ============================================================
-- Multi-tenant Migration — جدول restaurants + restaurant_id
-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- ============================================================

-- 1️⃣  إنشاء جدول restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣  ربط restaurant_settings بجدول restaurants
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 3️⃣  إضافة restaurant_id لجدول categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 4️⃣  إضافة restaurant_id لجدول items
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 5️⃣  إضافة restaurant_id لجدول orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- 6️⃣  إضافة restaurant_id لجدول drivers
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- 7️⃣  نقل بيانات المطعم الحالي:
--     أدخل المطعم الأول في جدول restaurants باستخدام بيانات restaurant_settings الموجودة
WITH inserted AS (
  INSERT INTO restaurants (name, slug)
  SELECT
    COALESCE(restaurant_name, 'المطعم'),
    -- توليد slug من الاسم (حروف لاتينية صغيرة وأرقام فقط، استبدال الفراغات بـ -)
    LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        COALESCE(restaurant_name, 'restaurant-1'),
        '[^a-zA-Z0-9ء-ي ]', '', 'g'
      ),
      '\s+', '-', 'g'
    ))
  FROM restaurant_settings
  ORDER BY updated_at ASC
  LIMIT 1
  RETURNING id
)
-- 8️⃣  تحديث جميع الجداول بـ restaurant_id للمطعم الأول
UPDATE restaurant_settings
  SET restaurant_id = (SELECT id FROM inserted)
  WHERE restaurant_id IS NULL;

-- ملاحظة: سيتم تشغيل تحديثات categories/items/orders/drivers في الجزء أدناه
-- بعد التأكد من وجود المطعم في الجدول

-- 9️⃣  تحديث categories بـ restaurant_id الأول
UPDATE categories
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 🔟  تحديث items
UPDATE items
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 1️⃣1️⃣  تحديث orders
UPDATE orders
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 1️⃣2️⃣  تحديث drivers
UPDATE drivers
  SET restaurant_id = (SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1)
  WHERE restaurant_id IS NULL;

-- 1️⃣3️⃣  إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_restaurant      ON items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant     ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_restaurant    ON drivers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rest_settings_rest    ON restaurant_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug      ON restaurants(slug);

-- 1️⃣4️⃣  Row Level Security (اختياري — يمكن تفعيله لاحقاً)
-- ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE drivers     ENABLE ROW LEVEL SECURITY;
