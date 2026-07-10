-- شغّل هذا الكود مرة واحدة في Supabase SQL Editor
-- يضيف عمود order_type لتمييز نوع الطلب (توصيل / طلب داخلي صالة / استلام سفري / محلي-كاشير)
-- وعمود table_number لرقم الطاولة (للطلب الداخلي فقط)
-- كلا العمودين Nullable حتى لا تتأثر الطلبات القديمة
-- ملاحظة: 'local' مضافة لأن صفحة كاشير المحل (admin/local) تستخدمها لطلبات البيع المباشر —
-- بدونها كانت كل عمليات البيع بالكاشير تفشل بسبب قيد CHECK

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'delivery';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_number integer;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IS NULL OR order_type IN ('delivery', 'dine_in', 'pickup', 'local'));
