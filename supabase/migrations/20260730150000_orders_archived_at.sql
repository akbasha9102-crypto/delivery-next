-- ميزة "أرشيف الطلبات": عمود archived_at على orders (بدون جدول منفصل ولا
-- حذف بيانات) + فهارس لتسريع استعلام الأرشيف حسب النوع والتاريخ.
-- آمن التكرار — انسخ الملف كاملاً وشغّله مرة واحدة بمحرر SQL بلوحة Supabase.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_type_archived
  ON orders(restaurant_id, order_type, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_active_only
  ON orders(restaurant_id, status)
  WHERE archived_at IS NULL;
