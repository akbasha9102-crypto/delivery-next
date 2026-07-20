-- ============================================================
-- السماح لمسار service role الشرعي (super-admin API) بتبديل is_suspended
-- ============================================================
-- شغّل هذا الملف يدوياً عبر Supabase SQL Editor (نفس نمط كل migrations
-- هذا المشروع — لا يُطبَّق تلقائياً). كل الأوامر آمنة لإعادة التشغيل.
--
-- الخلفية:
--  trg_restaurant_settings_suspend_guard (من 20260720090000) يشترط
--  is_super_admin() = TRUE لأي تغيير على is_suspended. لكن is_super_admin()
--  تتحقق من auth.jwt() -> 'user_metadata' ->> 'super_admin' — أي جلسة
--  Supabase Auth حقيقية. "سوبر أدمن" بهذا المشروع ليس مستخدم Supabase Auth
--  إطلاقاً: مصادقته عبر كوكي منفصل sa_session يُقارَن بـ
--  SUPER_ADMIN_SESSION_TOKEN (env)، تحققه isAuthed() بمسارات
--  src/app/api/super-admin/*. المسار الشرعي الوحيد لتبديل is_suspended هو
--  src/app/api/super-admin/restaurants/route.ts (PATCH) عبر supabaseAdmin
--  (service role، src/lib/supabase/admin.ts) — لا يُستخدم مفتاح service role
--  إطلاقاً من المتصفح، فقط من كود خادم Next.js محمي بـ isAuthed().
--
--  النتيجة: is_super_admin() تبقى دائماً FALSE على هذا المسار (لا JWT
--  مستخدم مطلقاً)، فالـ trigger يرفض حتى الطلب الشرعي — تحققنا من هذا
--  عملياً: حتى تحديث مباشر عبر service role key فشل بنفس رسالة الخطأ.
--
--  الإصلاح: نضيف استثناء auth.role() = 'service_role' (دالة مدمجة قياسية
--  بكل مشروع Supabase، جزء من bootstrap الخاص بـ PostgREST/Supabase Auth،
--  تُعيد 'service_role' حصراً لمفتاح service role، و'authenticated' لأي
--  مستخدم Supabase Auth مسجّل دخول حقيقي، و'anon' لمفتاح anon).
--  لا نحذف is_super_admin() — نُبقيها OR إضافية لأي مسار مستقبلي محتمل
--  يستخدم Supabase Auth حقيقياً لسوبر أدمن.
--
--  لماذا هذا آمن ولا يفتح ثغرة: owner/manager/cashier الحقيقيون يمرّون
--  دائماً عبر Supabase Auth بجلسة عادية (role = authenticated)، أبداً
--  service_role (مفتاح service role لا يُسرَّب للمتصفح ولا يُستخدم إلا من
--  كود الخادم). لذا يبقون محظورين تماماً من تبديل is_suspended بأنفسهم —
--  وهذا بالضبط الغرض الأمني الأصلي للـ trigger (منع فك التعليق الذاتي،
--  موثّق بتعليق 20260720090000) ولا ينكسر بهذا التعديل. لا حاجة لأي تعديل
--  على سياسات RLS (restaurant_settings_write تبقى كما هي بالكامل) لأن
--  service role يتجاوز RLS بطبيعته أصلاً — التعديل هنا يخص فقط منطق
--  الـ trigger الذي يعمل بغض النظر عن RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_non_super_admin_suspend_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     AND NOT is_super_admin()
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'فقط سوبر أدمن يقدر يبدّل حالة تعليق المطعم';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ملاحظة: الـ trigger نفسه (trg_restaurant_settings_suspend_guard) لا يحتاج
-- إعادة إنشاء — CREATE OR REPLACE FUNCTION يكفي لأنه نفس الدالة المربوطة.

NOTIFY pgrst, 'reload schema';
