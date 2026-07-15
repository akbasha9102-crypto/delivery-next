-- ============================================================
-- إصلاح: عمود drivers.user_id ودالة is_own_driver_row وRLS على drivers
-- لم يُطبَّقا فعلياً على قاعدة البيانات الحيّة رغم وجودهما في
-- 20260710121000_driver_auth_column.sql و20260710122000_rbac_rls_policies.sql
-- (الأرجح أن قسم "drivers" بالذات فشل صامتاً وقت اللصق اليدوي بمحرر SQL،
-- لأن CREATE POLICY على drivers فيه كان يشير لعمود/دالة غير موجودين بعد).
--
-- الأثر قبل هذا الملف (تم التحقق مباشرة عبر REST بمفتاح anon):
--   1) POST /api/driver يفشل بـ "Could not find the 'user_id' column of
--      'drivers' in the schema cache" — العمود غير موجود فعلياً.
--   2) RLS كان معطّلاً بالكامل على drivers: أي عميل anon (بدون تسجيل دخول)
--      يقدر يقرأ كل صفوف drivers بما فيها عمود password النصي الصريح،
--      ويقدر يُدرج/يُحدّث/يحذف صفوفاً بحرية تامة. ثغرة حرجة تُغلق هنا.
--
-- هذا الملف إضافي بالكامل وقابل لإعادة التشغيل بأمان (idempotent).
-- شغّله في Supabase SQL Editor.
-- ============================================================

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION is_own_driver_row(p_driver_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_driver_user_id IS NOT NULL AND p_driver_user_id = auth.uid();
$$ LANGUAGE sql STABLE;

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers: privileged full access" ON drivers;
DROP POLICY IF EXISTS "drivers: privileged or cashier full access" ON drivers;
CREATE POLICY "drivers: privileged or cashier full access"
  ON drivers FOR ALL
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin())
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

DROP POLICY IF EXISTS "drivers: own row" ON drivers;
CREATE POLICY "drivers: own row"
  ON drivers FOR ALL
  USING (is_own_driver_row(user_id))
  WITH CHECK (is_own_driver_row(user_id));
