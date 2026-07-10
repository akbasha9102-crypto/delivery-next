-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- حماية إضافية على مستوى قاعدة البيانات: يمنع تعيين سائق (driver_id) لأي
-- طلب داخلي (dine_in) أو سفري (pickup) أو كاشير محلي (local)، لأنها أصلاً
-- ما تحتاج توصيل. هذا يحمي حتى لو صار خطأ ببرمجة تطبيق السائق مستقبلاً.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_no_driver_on_internal_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_no_driver_on_internal_check
  CHECK (driver_id IS NULL OR order_type IS NULL OR order_type = 'delivery');
