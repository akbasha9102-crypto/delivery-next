-- ============================================================
-- RBAC v2 — خطوة 2: عمود ربط السائق بحساب Supabase Auth حقيقي
-- شغّل هذا الكود في Supabase SQL Editor بعد تشغيل
-- 20260710120000_rbac_custom_claims.sql
-- ============================================================
-- إضافية بالكامل — لا تحذف عمود password ولا تُلزم أي شيء بعد.
-- الخطوة التالية: شغّل scripts/migrate-drivers-to-auth.ts (يدوياً، من
-- طرفيتك، بعد ضبط .env.local) لإنشاء حساب Auth حقيقي لكل سائق حالي
-- وتعبئة هذا العمود + إدراج صف user_roles(role='driver') له.
-- ============================================================

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id) WHERE user_id IS NOT NULL;

-- دالة مساعدة: هل الجلسة الحالية سائق يملك هذا الصف تحديداً؟
CREATE OR REPLACE FUNCTION is_own_driver_row(p_driver_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_driver_user_id IS NOT NULL AND p_driver_user_id = auth.uid();
$$ LANGUAGE sql STABLE;
