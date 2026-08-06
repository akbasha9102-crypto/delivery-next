-- ============================================================
-- فتح الموظفين وسجل التدقيق لباقة "standard" — إزالة قيد الباقة عن
-- staff_actions_log RLS (المخزون يبقى مقيَّداً بالباقة المحترفين كما هو،
-- هذا الملف لا يمسّه إطلاقاً)
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations هذا
-- المشروع — لا يُطبَّق تلقائياً). آمن لإعادة التشغيل (idempotent).
--
-- الخلفية: migration 20260729100000 أضافت سياسة RLS على staff_actions_log
-- تمنع القراءة لباقة standard (is_professional_package(restaurant_id)
-- ضمن الشرط). القرار المنتجي تغيّر: الموظفين وسجل التدقيق أصبحا متاحين
-- لكل الباقات — المخزون فقط يبقى حصراً على باقة professional. هذا الملف
-- يُعدّل سياسة القراءة على staff_actions_log فقط ليزيل شرط الباقة، دون أي
-- تغيير على العمود subscription_tier نفسه أو دالة is_professional_package
-- (التي تبقى مُستخدَمة فعلياً من /api/inventory/list و/api/inventory/waste
-- عبر الكود، لا حاجة لحذفها).
-- ============================================================

DROP POLICY IF EXISTS "staff_actions_log: privileged read" ON staff_actions_log;
CREATE POLICY "staff_actions_log: privileged read"
  ON staff_actions_log FOR SELECT
  USING (is_privileged_of(restaurant_id) OR is_super_admin());

NOTIFY pgrst, 'reload schema';
