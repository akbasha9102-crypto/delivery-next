-- ============================================================
-- RBAC v2 — الخطوة الأخيرة: حذف restaurant_staff والبنية القديمة نهائياً
-- ============================================================
-- ⚠️ لا تشغّل هذا الملف إلا بعد التأكد يدوياً من كل التالي، بالترتيب:
--
--   1) تشغيل 20260710120000 → 20260710124000 كاملة عبر SQL Editor.
--   2) تفعيل custom_access_token_hook من Supabase Dashboard
--      (Authentication → Hooks → Customize Access Token).
--   3) تسجيل خروج/دخول فعلي لحساب مالك واحد وكاشير واحد على الأقل،
--      والتأكد أن /admin يعمل طبيعياً لكليهما (يعني الـ JWT صار يحمل
--      app_metadata.role الصحيح).
--   4) تشغيل: npm run migrate-drivers-to-auth — والتأكد من رسالة
--      "لا يوجد سائقون بحاجة لنقل" (أو نجاح كل سطر بدون ❌).
--   5) تسجيل دخول فعلي لسائق واحد على الأقل عبر /driver والتأكد أنه
--      يفتح /driver/dashboard بنجاح.
--   6) نقل أي push_subscription قديم على restaurant_staff (owner/manager
--      فعّلوا تنبيهات الموافقة الفورية قبل هذا التاريخ) يدوياً لـ
--      user_roles.push_subscription (العمود مضاف بـ migration
--      20260710125000، وnotify-owner-push.ts/push-subscribe يقرآن/يكتبان
--      عليه فعلاً منذ ذلك التاريخ) — وإلا يفقد هؤلاء الاشتراك القديم
--      تحديداً (المستخدمون الجدد بعد ذلك التاريخ غير متأثرين).
--
-- تخطّي أي خطوة أعلاه = احتمال حقيقي لقفل مالك/كاشير/سائق حقيقي خارج
-- حسابه. لا يوجد تراجع سهل بعد تشغيل DROP TABLE (البيانات تُفقَد فعلياً).
-- ============================================================

DROP FUNCTION IF EXISTS get_staff_role(UUID);
DROP FUNCTION IF EXISTS resolve_actor_label(UUID);

-- إعادة تعريف resolve_actor_label لتقرأ user_roles بدل restaurant_staff
-- (تستخدمها triggers تسجيل تعديل الأسعار/الإعدادات — يجب أن تبقى موجودة)
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

-- الأعمدة القديمة التي كانت تشير لـ restaurant_staff(id) — أصبحت غير
-- مستخدمة بالكود (كل الكتابات الجديدة تستخدم الأعمدة الموازية بـ _user_id)
ALTER TABLE cashier_shifts    DROP COLUMN IF EXISTS staff_id;
ALTER TABLE approval_requests DROP COLUMN IF EXISTS requested_by;
ALTER TABLE approval_requests DROP COLUMN IF EXISTS resolved_by;
ALTER TABLE staff_actions_log DROP COLUMN IF EXISTS staff_id;
ALTER TABLE stock_movements   DROP COLUMN IF EXISTS performed_by_staff_id;

ALTER TABLE cashier_shifts    ALTER COLUMN staff_user_id      SET NOT NULL;
ALTER TABLE approval_requests ALTER COLUMN requested_by_user_id SET NOT NULL;

ALTER TABLE cashier_shifts    DROP CONSTRAINT IF EXISTS cashier_shifts_has_staff;
ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_has_requester;

DROP TABLE IF EXISTS restaurant_staff CASCADE;
