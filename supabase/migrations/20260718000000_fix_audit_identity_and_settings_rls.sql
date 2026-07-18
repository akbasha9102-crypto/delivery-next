-- ============================================================
-- إصلاح هوية الفاعل بسجل التدقيق + تفعيل RLS على restaurant_settings
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  1) resolve_actor_label() مرّت بنسختين متعارضتين عبر migrations سابقة
--     (20260707185929 تقرأ من restaurant_staff المحذوف، 20260710999000
--     أعادت تعريفها لتقرأ user_roles) — هذا الملف يفرض النسخة الصحيحة
--     النهائية بشكل idempotent، بغض النظر عن ترتيب التطبيق التاريخي.
--  2) src/app/admin/audit/page.tsx كان يعرض "غير معروف" لأنه يعتمد جزئياً
--     على restaurant_staff/staff_id المحذوفين فعلياً — تم إصلاح الواجهة
--     بملف منفصل (لا يحتاج migration)، لكن السجلات القديمة (قبل هذا
--     التاريخ) التي كُتبت بـ performed_by_label = NULL تحتاج backfill.
--  3) restaurant_settings بلا RLS مفعّل إطلاقاً منذ بداية RBAC — ثغرة
--     منفصلة تُغلَق هنا.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) resolve_actor_label — نسخة نهائية واحدة، تقرأ user_roles حصراً
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_actor_label(p_restaurant_id UUID)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid())
      THEN 'المالك'
    ELSE (
      SELECT display_name FROM user_roles
      WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid()
      LIMIT 1
    )
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────────────────────────────
-- 2) فهرس على performed_by_auth_id — يخدم فلتر "كاشير معيّن" الجديد
--    بصفحة سجل التدقيق (WHERE performed_by_auth_id = ...)
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_actions_log_performed_by
  ON staff_actions_log(performed_by_auth_id)
  WHERE performed_by_auth_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3) تفعيل RLS على restaurant_settings (كانت مكشوفة بالكامل بدون RLS
--    منذ بداية RBAC v2 — لم يفعّلها أي migration سابق)
-- ────────────────────────────────────────────────────────────
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- قراءة عامة: نفس منطق باقي جداول المطعم العامة (menu/items/categories) —
-- صفحة المنيو للزبون تحتاج قراءة إعدادات المطعم (اسم/شعار/لون/دوام...)
-- بدون تسجيل دخول إطلاقاً.
DROP POLICY IF EXISTS restaurant_settings_select_public ON restaurant_settings;
CREATE POLICY restaurant_settings_select_public ON restaurant_settings
  FOR SELECT
  USING (true);

-- كتابة: مالك/مدير/كاشير على مطعمهم فقط (نفس صلاحية drivers بعد إصلاح
-- 20260715110000)، أو super_admin. is_privileged_or_cashier_of معرّفة
-- بـ 20260713110000_cashier_owner_parity_rls.sql.
DROP POLICY IF EXISTS restaurant_settings_write ON restaurant_settings;
CREATE POLICY restaurant_settings_write ON restaurant_settings
  FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

-- ────────────────────────────────────────────────────────────
-- 4) Backfill: سجلات قديمة بـ performed_by_label IS NULL
-- ────────────────────────────────────────────────────────────
-- 4أ) المالك: performed_by_auth_id يطابق restaurants.owner_id لنفس المطعم
UPDATE staff_actions_log l
SET performed_by_label = 'المالك'
FROM restaurants r
WHERE l.performed_by_label IS NULL
  AND l.performed_by_auth_id IS NOT NULL
  AND r.id = l.restaurant_id
  AND r.owner_id = l.performed_by_auth_id;

-- 4ب) موظف (manager/cashier): مطابقة user_roles.user_id + restaurant_id
UPDATE staff_actions_log l
SET performed_by_label = ur.display_name
FROM user_roles ur
WHERE l.performed_by_label IS NULL
  AND l.performed_by_auth_id IS NOT NULL
  AND ur.restaurant_id = l.restaurant_id
  AND ur.user_id = l.performed_by_auth_id;

NOTIFY pgrst, 'reload schema';
