-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود driver_id على جدول orders لربط السائق بالطلب

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_id text DEFAULT NULL;
