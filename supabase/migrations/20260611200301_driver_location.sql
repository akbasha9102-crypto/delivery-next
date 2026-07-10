-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف أعمدة موقع السائق لجدول orders

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_lat FLOAT,
  ADD COLUMN IF NOT EXISTS driver_lng FLOAT;
