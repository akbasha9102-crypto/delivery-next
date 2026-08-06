-- إصلاح تسريب بيانات: جدول order_messages (رسائل تواصل زبون↔مطعم على طلب
-- معيّن) أُنشئ بـ RLS مفعّل لكنه بلا أي قيد فعلي — الثلاث سياسات كلها
-- USING(true)/WITH CHECK(true) (راجع migration 20260624182550_order_messages.sql)،
-- أي زائر anon يقدر يقرأ/يكتب/يعدّل رسائل أي طلب بأي مطعم عبر
-- GET/POST/PATCH /rest/v1/order_messages مباشرة.
--
-- خلافاً لـ order_feedback (له مسار كتابة عامة شرعية من صفحة /track بلا
-- تسجيل دخول)، هذا الجدول غير مستخدَم إطلاقاً بالواجهة حالياً (تأكيد عبر
-- grep على src/ بالكامل: صفر استدعاءات) — ميزة "شات الطلب" لم تُشحَن بعد.
-- لذلك نغلق الثلاث عمليات بالكامل على الموظفين المخوَّلين بالمطعم صاحب
-- الرسالة (owner/manager/cashier) أو سوبر-أدمن فقط، بلا أي استثناء لـ
-- public/anon.
--
-- ملاحظة لو فُعِّلت هذه الميزة مستقبلاً: وصول الزبون (anon) لرسائله يجب أن
-- يمر عبر مسار API بمفتاح service-role (نفس نمط /api/track و/api/track/edit
-- المستخدَم حالياً لعزل بيانات الطلبات)، وليس عبر سياسة RLS مباشرة تسمح
-- لـ anon بالوصول — لا تُعِد فتح هذا الجدول لـ anon مباشرة عند تفعيل الميزة.

DROP POLICY IF EXISTS "allow_read_order_messages" ON order_messages;
DROP POLICY IF EXISTS "allow_insert_order_messages" ON order_messages;
DROP POLICY IF EXISTS "allow_update_order_messages" ON order_messages;

CREATE POLICY "order_messages: privileged or cashier select"
  ON order_messages FOR SELECT
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

CREATE POLICY "order_messages: privileged or cashier insert"
  ON order_messages FOR INSERT
  WITH CHECK (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

CREATE POLICY "order_messages: privileged or cashier update"
  ON order_messages FOR UPDATE
  USING (is_privileged_or_cashier_of(restaurant_id) OR is_super_admin());

NOTIFY pgrst, 'reload schema';
