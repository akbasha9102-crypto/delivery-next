-- ============================================================
-- حذف منطقي (أرشفة) لمطعم من super-admin: عمود جديد + توسيع حراسة
-- trg_restaurant_settings_suspend_guard الموجود
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  ميزة "حذف مطعم" الجديدة (super-admin/dashboard) هي أرشفة كاملة وليست
--  حذفاً فيزيائياً: لا يُنفَّذ أي DELETE FROM على orders/categories/items/
--  إلخ. المطعم يُخفى نهائياً من كل مكان عام، وتُعطَّل كل حساباته، لكن
--  بياناته تبقى محفوظة بالكامل بالقاعدة.
--
--  العلم يُوضع على restaurant_settings (وليس restaurants) لأن:
--   1) SettingsProvider يفتح قناة postgres_changes حيّة على هذا الجدول
--      أصلاً (select('*')) — أي عمود جديد يصل فوراً لكل الجلسات النشطة.
--   2) trg_log_settings_change (20260707185929) يسجّل تلقائياً كل UPDATE
--      هنا بالـ audit log — على restaurants لا يوجد trigger مماثل إطلاقاً.
--   3) trg_restaurant_settings_suspend_guard الموجود يمنع owner/manager/
--      cashier من تعديل is_suspended ذاتياً رغم سماح RLS بالكتابة — يكفي
--      توسيعه ليشمل العمود الجديد بدل بناء حماية منفصلة.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0) الأعمدة الجديدة
-- ─────────────────────────────────────────────────────────────
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- حالة متناقضة (محذوف لكن غير موقوف) ممنوعة بنيوياً — دفاع إضافي حتى لو
-- حدث خطأ برمجي مستقبلي يحدّث is_deleted فقط دون is_suspended.
ALTER TABLE restaurant_settings
  DROP CONSTRAINT IF EXISTS restaurant_settings_deleted_implies_suspended;
ALTER TABLE restaurant_settings
  ADD CONSTRAINT restaurant_settings_deleted_implies_suspended
  CHECK (NOT is_deleted OR is_suspended);

-- ─────────────────────────────────────────────────────────────
-- 1) توسيع trg_restaurant_settings_suspend_guard ليشمل is_deleted —
--    نفس دالة 20260723100000 (auth.role() = 'service_role' أو
--    is_super_admin() فقط)، بدون إعادة إنشاء الـ trigger نفسه
--    (CREATE OR REPLACE FUNCTION يكفي، الدالة مربوطة أصلاً).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_non_super_admin_suspend_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted)
     AND NOT is_super_admin()
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'فقط سوبر أدمن يقدر يبدّل حالة تعليق/حذف المطعم';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
