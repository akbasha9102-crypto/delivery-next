-- ============================================================
-- نظام باقات الاشتراك (subscription_tier) — عمود جديد على restaurant_settings
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations هذا
-- المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل (idempotent).
--
-- الخلفية: سوبر أدمن يحدّد باقة اشتراك لكل مطعم: "standard" (منيو + طلبات +
-- منيو الداشبورد + سائقين + إعدادات عدا الموظفين وسجل التدقيق، والمخزون
-- محظور بالكامل) أو "professional" (كل شيء مفتوح). العمود يُوضع على
-- restaurant_settings وليس restaurants لنفس أسباب is_suspended/is_deleted
-- الموثّقة بـ 20260720090000 و20260728120000 بالضبط: (1) postgres_changes
-- حيّة أصلاً على هذا الجدول، (2) trg_log_settings_change يسجّل التغيير
-- تلقائياً بسجل التدقيق، (3) trg_restaurant_settings_suspend_guard الموجود
-- يمنع owner/manager/cashier من تعديل هذا العمود ذاتياً عبر أي كتابة مباشرة
-- (owner يملك صلاحية RLS UPDATE فعلية على صف إعداداته) — يكفي توسيع
-- الـ trigger الموجود بدل بناء آلية جديدة.
-- ============================================================

-- 0) العمود الجديد
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'professional';

ALTER TABLE restaurant_settings
  DROP CONSTRAINT IF EXISTS restaurant_settings_subscription_tier_check;
ALTER TABLE restaurant_settings
  ADD CONSTRAINT restaurant_settings_subscription_tier_check
  CHECK (subscription_tier IN ('standard', 'professional'));

-- 1) توسيع trg_restaurant_settings_suspend_guard ليشمل subscription_tier —
--    نفس دالة 20260728120000 (استثناء auth.role() = 'service_role' أو
--    is_super_admin() فقط)، بدون إعادة إنشاء الـ trigger نفسه (CREATE OR
--    REPLACE FUNCTION يكفي، الدالة مربوطة أصلاً بـ
--    trg_restaurant_settings_suspend_guard). ملاحظة: لأن التريغر BEFORE
--    ويرفض الـ UPDATE بالكامل عبر RAISE EXCEPTION، أي طلب يحاول تغيير
--    subscription_tier مع حقل آخر مسموح بنفس الاستدعاء سيُرفض بالكامل —
--    سلوك متسق مع is_suspended/is_deleted الحاليين، ليس تراجعاً.
CREATE OR REPLACE FUNCTION prevent_non_super_admin_suspend_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
      OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier)
     AND NOT is_super_admin()
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'فقط سوبر أدمن يقدر يبدّل حالة تعليق/حذف/باقة المطعم';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) دالة مساعدة تُستخدم بسياسة RLS أدناه — بلا SECURITY DEFINER لأن
--    restaurant_settings مقروءة أصلاً بسياسة عامة (restaurant_settings_
--    select_public USING (true))، نفس منطق is_restaurant_active بـ
--    20260720090000.
CREATE OR REPLACE FUNCTION is_professional_package(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_settings
    WHERE restaurant_id = p_restaurant_id AND subscription_tier = 'professional'
  );
$$ LANGUAGE sql STABLE;

-- 3) فرض الباقة على قراءة سجل التدقيق مباشرة — src/app/admin/audit/page.tsx
--    يقرأ staff_actions_log مباشرة عبر Supabase client (لا يوجد API route
--    وسيط لهذا الجدول)، فـ RLS هي خط الدفاع الوحيد الممكن هنا. owner/manager
--    بباقة standard يفقدون حق القراءة بالكامل؛ super_admin يبقى بلا قيد.
DROP POLICY IF EXISTS "staff_actions_log: privileged read" ON staff_actions_log;
CREATE POLICY "staff_actions_log: privileged read"
  ON staff_actions_log FOR SELECT
  USING ((is_privileged_of(restaurant_id) AND is_professional_package(restaurant_id)) OR is_super_admin());

-- ────────────────────────────────────────────────────────────
-- ملاحظة معمارية مقصودة: قسم "المخزون" (/admin/inventory) يُقيَّد بالباقة
-- المحترفين أيضاً، لكن بخلاف staff_actions_log لا نُعدِّل أي RLS على
-- inventory_items / menu_recipes / stock_movements / inventory_categories.
-- هذه الجداول تُستخدَم مباشرة أيضاً من صفحتي المنيو (src/app/admin/menu/page.tsx)
-- والطلبات (src/app/admin/dashboard/page.tsx — خصم المخزون التلقائي عند إتمام
-- طلب)، وكلاهما يجب أن يبقيا مفتوحين بالكامل بالباقة العادية. تقييد RLS هنا
-- سيكسر إتمام الطلبات وإدارة المنيو. الإنفاذ الفعلي لقسم المخزون هو حارس
-- واجهة (RequireProfessionalPackage) + فحص isProfessionalPackage() داخل
-- /api/inventory/list و/api/inventory/waste فقط (كلاهما يستخدمان
-- supabaseAdmin/service role المتجاوز لـ RLS أصلاً، فالفحص بالكود هو خط
-- الدفاع الحقيقي الوحيد لهذين المسارين تحديداً — وليس مجرد تناسق واجهة).
-- قيد معروف مقبول: owner/cashier لمطعم standard يقدر تقنياً (أي عميل HTTP
-- مباشر بمفتاح anon + جلسة شرعية) يقرأ/يعدّل جداول المخزون مباشرة عبر
-- Supabase client، لكن هذا ليس تصعيد صلاحيات جديد — نفس الحساب يملك أصلاً
-- صلاحية RLS شرعية وكاملة على هذه الجداول بحكم عمله بالطلبات/المنيو
-- المفتوحين بكل الباقات؛ التقييد هنا ميزة/UX gating لواجهة مخزون متخصصة،
-- وليس عزل بيانات حساسة.
-- ────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
