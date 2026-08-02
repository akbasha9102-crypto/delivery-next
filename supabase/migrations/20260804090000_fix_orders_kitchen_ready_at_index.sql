-- تصحيح فهرس شاشة المطبخ: الاستعلام الفعلي أصبح "الطلبات الحالية بمرحلة
-- preparing" لكل أنواع order_type (توصيل/استلام/صالة/محلي) وليس فقط
-- order_type = 'local' كما كان بالفهرس الأصلي (migration 20260803090000).
-- لا نعدّل ذلك الملف (مطبَّق فعلاً) — هذا الفهرس البديل يحل محله.

DROP INDEX IF EXISTS idx_orders_kitchen_pending;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen_pending
  ON orders(restaurant_id, status)
  WHERE kitchen_ready_at IS NULL AND archived_at IS NULL;
