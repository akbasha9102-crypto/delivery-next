-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف أعمدة موقع الزبون ومعلومات السائق لجدول orders

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_lat  FLOAT,
  ADD COLUMN IF NOT EXISTS client_lng  FLOAT,
  ADD COLUMN IF NOT EXISTS driver_name  TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT;
