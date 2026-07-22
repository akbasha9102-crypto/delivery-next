-- ============================================================
-- طلبات إنشاء حساب (account_creation_requests) — من صفحة الهبوط العامة
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  صفحة الهبوط العامة (src/app/home) تعرض نموذجاً لأي زائر (غير موثّق
--  إطلاقاً) لطلب إنشاء حساب مطعم جديد: الاسم الكامل، رقم الهاتف، اسم
--  المطعم. هذا يُخزَّن هنا كطلب "pending" بانتظار مراجعة سوبر أدمن من
--  لوحته (super-admin/dashboard)، الذي يقرر القبول (approve) أو الرفض
--  (reject) يدوياً — لا يوجد أي إنشاء تلقائي لحساب/مطعم من هذا الجدول.
--
--  بما أن الكاتب (POST من src/app/api/signup-requests/route.ts) عام
--  بالكامل بلا أي مصادقة، ومصادقة سوبر أدمن هنا كوكي سرّي مشترك
--  (sa_session) وليست Supabase Auth (لا JWT/auth.uid())، فلا يوجد أي
--  "دور" مصادقة نربط به سياسة RLS مفيدة. نتبع هنا بالضبط نفس نمط
--  20260721100000_restaurant_owner_contacts.sql: RLS مفعّل بلا أي
--  CREATE POLICY لأي دور (anon/authenticated) — أي رفض كل وصول مباشر
--  من المتصفح بشكل افتراضي (RLS "deny by default" عند عدم وجود سياسة
--  مطابقة). القارئ/الكاتب الوحيد المسموح هو supabaseAdmin (مفتاح
--  service role، src/lib/supabase/admin.ts) من داخل:
--    - src/app/api/signup-requests/route.ts (POST عام — الإدخال فقط)
--    - src/app/api/super-admin/signup-requests/route.ts (GET/PATCH،
--      محمي بفحص كوكي sa_session == SUPER_ADMIN_SESSION_TOKEN)
--  service role يتجاوز RLS دائماً بحكم طبيعته، لذا غياب أي سياسة هنا
--  ليس نقصاً بل تعزيز مقصود: حتى لو استُخدم مفتاح anon/authenticated
--  بالخطأ على هذا الجدول تحديداً (كودياً أو يدوياً)، تُرفض القراءة/
--  الكتابة تلقائياً لأن RLS مفعّل ولا توجد أي سياسة تسمح بأي شيء.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_creation_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  phone            TEXT NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
  restaurant_name  TEXT NOT NULL CHECK (char_length(restaurant_name) BETWEEN 2 AND 120),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_creation_requests_status     ON account_creation_requests (status);
CREATE INDEX IF NOT EXISTS idx_account_creation_requests_created_at ON account_creation_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_creation_requests_phone      ON account_creation_requests (phone);

ALTER TABLE account_creation_requests ENABLE ROW LEVEL SECURITY;

-- عمداً: لا توجد أي سياسة CREATE POLICY هنا لأي دور — راجع الخلفية أعلاه.

-- إعادة استخدام دالة التحديث التلقائي لـ updated_at المعرّفة أصلاً بـ
-- 20260629063451_inventory.sql (update_updated_at_column) — لا تُعاد
-- كتابتها، فقط تُربط بجدول جديد.
DROP TRIGGER IF EXISTS account_creation_requests_updated_at ON account_creation_requests;
CREATE TRIGGER account_creation_requests_updated_at
  BEFORE UPDATE ON account_creation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
