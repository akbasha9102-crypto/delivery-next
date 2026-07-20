-- ============================================================
-- رسائل/إشعارات السوبر أدمن للمطاعم (لمطعم محدد أو بث للجميع)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor — لا يُطبَّق تلقائياً.
--
-- restaurant_id = NULL يعني رسالة بث لكل المطاعم. الكتابة حصراً عبر
-- service role من src/app/api/super-admin/notifications/route.ts
-- (محمي بـ isAuthed() / كوكي sa_session) — لا توجد أي سياسة INSERT/UPDATE/
-- DELETE للعميل هنا مطلقاً، بنفس نمط restaurant_owner_contacts.
--
-- حالة "مقروء" منفصلة بجدول ربط لأن رسالة البث الواحدة قد تُقرأ من مطعم
-- ولا تُقرأ من آخر — علاقة many-to-many حقيقية بين (رسالة، مطعم)، حتى
-- للرسائل الموجّهة لمطعم واحد، لتوحيد المنطق ولتفادي race condition لو
-- كان العمود JSON على صف واحد يُحدَّث من مطاعم متعددة بالتزامن.
-- ============================================================

CREATE TABLE IF NOT EXISTS super_admin_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL = بث لكل المطاعم
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body          TEXT NOT NULL CHECK (char_length(body)  BETWEEN 1 AND 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_san_restaurant_id ON super_admin_notifications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_san_created_at    ON super_admin_notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS super_admin_notification_reads (
  notification_id UUID NOT NULL REFERENCES super_admin_notifications(id) ON DELETE CASCADE,
  restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_sanr_restaurant_id ON super_admin_notification_reads(restaurant_id);

ALTER TABLE super_admin_notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_notification_reads ENABLE ROW LEVEL SECURITY;

-- ── قراءة الرسائل: owner أو manager لمطعمهم + كل رسائل البث (restaurant_id IS NULL) ──
-- يعيد استخدام is_privileged_of الموجودة أصلاً (owner OR manager،
-- معرّفة بـ 20260710120000_rbac_custom_claims.sql وأُصلحت بـ
-- 20260713120000_fix_gemini_broken_privileged_functions.sql).
DROP POLICY IF EXISTS "san: owner/manager read own + broadcast" ON super_admin_notifications;
CREATE POLICY "san: owner/manager read own + broadcast"
  ON super_admin_notifications FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NULL
    OR is_privileged_of(restaurant_id)
  );

-- عمداً: لا توجد أي سياسة INSERT/UPDATE/DELETE لـ authenticated/anon —
-- الكتابة فقط عبر service role من الـ API route (isAuthed()).

-- ── قراءة/كتابة حالة "مقروء": المطعم يقرأ ويكتب فقط سجلّاته الخاصة ──
-- الشرط الأمني الحاسم: لا يكفي التحقق من صلاحية المطعم على الرسالة نفسها،
-- بل يجب أيضاً أن يطابق restaurant_id بصف القراءة هوية المطعم المخوَّل
-- لهذا المستخدم تحديداً — وإلا يمكن لأي owner "يعلّم كمقروء" بالنيابة عن
-- مطعم آخر بمجرد إرسال restaurant_id عشوائي (IDOR).
DROP POLICY IF EXISTS "sanr: privileged select own restaurant" ON super_admin_notification_reads;
CREATE POLICY "sanr: privileged select own restaurant"
  ON super_admin_notification_reads FOR SELECT
  TO authenticated
  USING (is_privileged_of(restaurant_id));

DROP POLICY IF EXISTS "sanr: privileged insert own restaurant" ON super_admin_notification_reads;
CREATE POLICY "sanr: privileged insert own restaurant"
  ON super_admin_notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    is_privileged_of(restaurant_id)
    AND EXISTS (
      SELECT 1 FROM super_admin_notifications n
      WHERE n.id = notification_id
        AND (n.restaurant_id IS NULL OR n.restaurant_id = super_admin_notification_reads.restaurant_id)
    )
  );

-- لا سياسة UPDATE/DELETE على جدول القراءة — "تعليم كمقروء" فعل غير قابل
-- للتراجع من واجهة العميل، ON CONFLICT DO NOTHING يكفي عملياً.

NOTIFY pgrst, 'reload schema';
