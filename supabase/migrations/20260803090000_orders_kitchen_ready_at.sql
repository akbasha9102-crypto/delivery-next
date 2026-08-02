-- ميزة "شاشة عرض المطبخ": عمود kitchen_ready_at على orders لتعليم
-- الطلبات المحلية بأنها جُهّزت بالمطبخ (NULL = لم تُجهَّز بعد، تظهر
-- بشاشة المطبخ. غير NULL = وقت التجهيز، تختفي من الشاشة).
-- بنفس روح archived_at (migration 20260730150000) — بدون جدول منفصل.
-- لا حاجة لتعديل RLS: policy "orders: cashier update status" الحالية
-- تسمح بتحديث أي عمود على orders لأي owner/manager/cashier بالمطعم.
-- آمن التكرار — انسخ الملف كاملاً وشغّله مرة واحدة بمحرر SQL بلوحة Supabase.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS kitchen_ready_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen_pending
  ON orders(restaurant_id, order_type, kitchen_ready_at)
  WHERE order_type = 'local' AND kitchen_ready_at IS NULL;
