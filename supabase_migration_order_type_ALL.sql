-- ═══════════════════════════════════════════════════════════════════════
-- ملف واحد يجمع كل أكواد SQL الخاصة بميزة "أنواع الطلب" (توصيل / طلب داخلي
-- / استلام سفري / كاشير محلي). انسخ المحتوى كامل، الصقه بـ Supabase SQL
-- Editor، واضغط Run — مرة وحدة تكفي. آمن يتكرر تشغيله بدون أي ضرر على
-- البيانات الموجودة (كل الأوامر تستخدم IF NOT EXISTS / DROP...IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

-- 1) عمودا order_type و table_number على جدول orders
-- order_type: نوع الطلب (توصيل / طلب داخلي صالة / استلام سفري / محلي-كاشير)
-- table_number: رقم الطاولة (للطلب الداخلي فقط)
-- كلا العمودين Nullable حتى لا تتأثر الطلبات القديمة

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'delivery';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_number integer;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IS NULL OR order_type IN ('delivery', 'dine_in', 'pickup', 'local'));

-- 2) حماية إضافية: يمنع تعيين سائق (driver_id) لأي طلب داخلي/سفري/محلي،
-- لأنها أصلاً ما تحتاج توصيل — يحمي حتى لو صار خطأ ببرمجة تطبيق السائق مستقبلاً.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_no_driver_on_internal_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_no_driver_on_internal_check
  CHECK (driver_id IS NULL OR order_type IS NULL OR order_type = 'delivery');
