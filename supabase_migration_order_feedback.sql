-- ============================================================
-- Order Feedback — ملاحظات وشكاوى الزبائن على الطلبات
-- تسمح للزبون بإرسال ملاحظة أو شكوى بعد اكتمال الطلب،
-- وتظهر لاحقاً في صفحة الأرشيف بالداشبورد لكل مطعم على حدة.
-- شغّل هذا الكود في Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gbmwrvnmvobvieembxmf/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS order_feedback (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id       UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  client_name    TEXT,
  client_phone   TEXT,
  type           TEXT        CHECK (type IN ('feedback', 'complaint')),
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_feedback_restaurant ON order_feedback(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_feedback_order      ON order_feedback(order_id);

-- ملاحظة معمارية مقصودة: لا نفعّل RLS على هذا الجدول (نفس نمط جدول orders
-- غير المحمي بـ RLS حالياً) لأن الإدراج يتم من زبون مجهول الهوية (بدون تسجيل دخول)
-- وتفعيل RLS هنا سيعقّد الإدراج دون فائدة أمنية حقيقية بالوضع الحالي.
