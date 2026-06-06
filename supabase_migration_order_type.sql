-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود order_type لتمييز الطلبات المحلية عن طلبات التوصيل

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'delivery';
